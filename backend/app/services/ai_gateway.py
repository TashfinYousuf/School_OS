# backend/app/services/ai_gateway.py
import os
import re
import json
import logging
import httpx
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Tuple, Type
from pydantic import BaseModel, ValidationError
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv(), override=True)

from app.models.ai_governance import TenantAIBudget, AIUsageLog
from app.schemas.ai import (
    ValidatedMCQItem,
    QuestionPaperGenerateRequest,
    QuestionPaperStructure,
    CreativeQuestionStem,
    LessonBlueprintGenerateRequest,
    LessonBlueprintStructure,
    LessonActivityItem,
    SocraticDialogueRequest,
    SocraticDialogueResponse,
)

logger = logging.getLogger("educationos.ai.gateway")


# ========================================================================================
# Exceptions
# ========================================================================================

class AIGenerationError(Exception):
    """Domain exception raised when AI gateway operations fail."""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class AIBudgetExceededError(AIGenerationError):
    """Raised when tenant exceeds monthly token limit or budget ceiling."""
    pass


class PromptInjectionDetected(AIGenerationError):
    """Raised when malicious prompt injection vector is intercepted."""
    pass


# Backward compatibility alias
ValidatedMCQ = ValidatedMCQItem


# ========================================================================================
# Provider Abstraction Interface
# ========================================================================================

class BaseAIProvider(ABC):
    """Abstract interface for all LLM providers (Gemini, Groq, OpenAI)."""

    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @abstractmethod
    def generate_text(self, prompt: str, system_prompt: str, temperature: float = 0.2) -> Tuple[str, int, int]:
        """Returns (response_text, prompt_tokens, completion_tokens)."""
        pass

    @abstractmethod
    def generate_json(self, prompt: str, system_prompt: str, temperature: float = 0.2) -> Tuple[Any, int, int]:
        """Returns (parsed_json_obj, prompt_tokens, completion_tokens)."""
        pass


class GeminiProvider(BaseAIProvider):
    """Google Gemini GenAI Provider (Primary)."""

    def __init__(self, api_key: Optional[str] = None):
        raw = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""
        self.api_key = str(raw).strip().strip('"').strip("'")
        self._client = None

    @property
    def name(self) -> str:
        return "gemini-2.5-flash"

    def _get_client(self):
        if not self._client:
            if len(self.api_key) < 10:
                raise ValueError("Gemini API key is not configured or invalid.")
            from google import genai
            self._client = genai.Client(api_key=self.api_key)
        return self._client

    def generate_text(self, prompt: str, system_prompt: str, temperature: float = 0.2) -> Tuple[str, int, int]:
        from google.genai import types
        client = self._get_client()
        chat = client.chats.create(
            model="gemini-2.5-flash",
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=temperature
            )
        )
        res = chat.send_message(prompt)
        text = res.text or ""
        # Estimation if token usage not directly returned by client
        p_tokens = len(prompt.split()) + len(system_prompt.split())
        c_tokens = len(text.split())
        return text, p_tokens, c_tokens

    def generate_json(self, prompt: str, system_prompt: str, temperature: float = 0.2) -> Tuple[Any, int, int]:
        from google.genai import types
        client = self._get_client()
        chat = client.chats.create(
            model="gemini-2.5-flash",
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=temperature,
                response_mime_type="application/json"
            )
        )
        res = chat.send_message(prompt)
        text = res.text or "{}"
        parsed = MultiModelAIGateway.extract_clean_json(text)
        p_tokens = len(prompt.split()) + len(system_prompt.split())
        c_tokens = len(text.split())
        return parsed, p_tokens, c_tokens


class GroqProvider(BaseAIProvider):
    """Groq Cloud Llama-3.3 70B Versatile Provider (Secondary Fallback)."""

    def __init__(self, api_key: Optional[str] = None):
        raw = api_key or os.getenv("GROQ_API_KEY") or os.getenv("OPENROUTER_API_KEY") or ""
        self.api_key = str(raw).strip().strip('"').strip("'")

    @property
    def name(self) -> str:
        return "groq-llama-3.3-70b"

    def generate_text(self, prompt: str, system_prompt: str, temperature: float = 0.2) -> Tuple[str, int, int]:
        if len(self.api_key) < 10:
            raise ValueError("Groq API key is not configured or invalid.")

        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "llama-3.3-70b-versatile",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            "temperature": temperature
        }
        with httpx.Client(timeout=25.0) as client:
            resp = client.post(url, headers=headers, json=payload)
            if resp.status_code != 200:
                raise ValueError(f"Groq API error ({resp.status_code}): {resp.text}")
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            usage = data.get("usage", {})
            return content, usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0)

    def generate_json(self, prompt: str, system_prompt: str, temperature: float = 0.2) -> Tuple[Any, int, int]:
        if len(self.api_key) < 10:
            raise ValueError("Groq API key is not configured or invalid.")

        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "llama-3.3-70b-versatile",
            "messages": [
                {"role": "system", "content": system_prompt + "\nOutput valid JSON ONLY."},
                {"role": "user", "content": prompt}
            ],
            "temperature": temperature,
            "response_format": {"type": "json_object"}
        }
        with httpx.Client(timeout=25.0) as client:
            resp = client.post(url, headers=headers, json=payload)
            if resp.status_code != 200:
                raise ValueError(f"Groq API error ({resp.status_code}): {resp.text}")
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            parsed = MultiModelAIGateway.extract_clean_json(content)
            usage = data.get("usage", {})
            return parsed, usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0)


# ========================================================================================
# Unified Gateway & Governance Engine
# ========================================================================================

class MultiModelAIGateway:
    """
    Enterprise Unified AI Gateway for EducationOS:
    - Multi-provider fallback chain (Gemini -> Groq -> Honest failure).
    - Hard tenant AI budget gating and token consumption metering.
    - OWASP LLM01 prompt injection defense & input sanitization.
    - Strict Pydantic schema validation for pedagogical artifacts.
    - Human-in-the-loop draft invariant enforcement.
    """

    PROMPT_INJECTION_PATTERNS = [
        re.compile(r"ignore\s+(all\s+)?(previous|prior)\s+instructions", re.IGNORECASE),
        re.compile(r"system\s*prompt\s*:", re.IGNORECASE),
        re.compile(r"bypass\s+(all\s+)?constraints", re.IGNORECASE),
        re.compile(r"\b(dan\s+mode|jailbreak|developer\s+mode)\b", re.IGNORECASE),
        re.compile(r"reveal\s+(your\s+)?instructions", re.IGNORECASE),
        re.compile(r"disregard\s+safety", re.IGNORECASE),
    ]

    def __init__(self, providers: Optional[List[BaseAIProvider]] = None):
        if providers is not None:
            self.providers = providers
        else:
            self.providers = [
                GeminiProvider(),
                GroqProvider(),
            ]

    @staticmethod
    def extract_clean_json(raw_text: str) -> Any:
        """Robustly extracts JSON object or array from markdown-fenced text."""
        cleaned = re.sub(r"^```(?:json)?|```$", "", raw_text.strip(), flags=re.MULTILINE).strip()
        # Find earliest JSON structure: array [ ... ] or object { ... }
        match_arr = re.search(r'\[.*\]', cleaned, re.DOTALL)
        match_obj = re.search(r'\{.*\}', cleaned, re.DOTALL)

        candidate = cleaned
        if match_arr and (not match_obj or match_arr.start() < match_obj.start()):
            candidate = match_arr.group(0)
        elif match_obj:
            candidate = match_obj.group(0)

        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            # Fallback direct parse attempt
            return json.loads(cleaned)

    @classmethod
    def sanitize_input(cls, text: str) -> str:
        """
        Sanitizes user input:
        1. Checks for malicious prompt injection signatures.
        2. Neutralizes script tags, HTML entities, and XML delimiters.
        3. Wraps within untrusted data boundaries.
        """
        if not text:
            return ""

        for pattern in cls.PROMPT_INJECTION_PATTERNS:
            if pattern.search(text):
                raise PromptInjectionDetected(
                    "Security Violation: Malicious prompt injection pattern detected in input.",
                    details={"pattern": pattern.pattern}
                )

        # Sanitize HTML / Script / XML tag injections
        sanitized = re.sub(r"<[^>]*>", "", text)
        sanitized = re.sub(r"[<>]", "", sanitized)
        sanitized = re.sub(r"javascript:|data:text/html", "", sanitized, flags=re.IGNORECASE)
        sanitized = re.sub(r"\s+", " ", sanitized)
        return sanitized.strip()

    @staticmethod
    def check_budget_and_reserve(
        db: Any,
        tenant_id: str,
        estimated_tokens: int = 1500
    ) -> TenantAIBudget:
        """
        Enforces tenant hard budget and monthly token quota limits.
        """
        tid = str(tenant_id)
        budget = db.query(TenantAIBudget).filter(TenantAIBudget.tenant_id == tid).first()
        if not budget:
            budget = TenantAIBudget(
                tenant_id=tid,
                monthly_token_limit=2_000_000,
                used_tokens_current_cycle=0,
                monthly_budget_usd=25,
                is_hard_locked=False,
            )
            db.add(budget)
            db.commit()
            db.refresh(budget)

        if budget.is_hard_locked:
            raise AIBudgetExceededError(
                "Institutional AI access is administratively locked for this workspace."
            )

        if budget.used_tokens_current_cycle + estimated_tokens > budget.monthly_token_limit:
            raise AIBudgetExceededError(
                f"Monthly AI token ceiling exceeded: limit={budget.monthly_token_limit}, "
                f"used={budget.used_tokens_current_cycle}, requested={estimated_tokens}."
            )

        return budget

    @staticmethod
    def record_usage(
        db: Any,
        tenant_id: str,
        user_id: str,
        feature: str,
        model_name: str,
        prompt_tokens: int,
        completion_tokens: int
    ) -> AIUsageLog:
        """
        Atomically records AI token consumption in immutable audit log and updates tenant budget.
        """
        tid = str(tenant_id)
        uid = str(user_id)
        total_tokens = prompt_tokens + completion_tokens

        # 1. Update budget
        budget = db.query(TenantAIBudget).filter(TenantAIBudget.tenant_id == tid).first()
        if budget:
            budget.used_tokens_current_cycle += total_tokens

        # 2. Append immutable usage log
        log_entry = AIUsageLog(
            tenant_id=tid,
            user_id=uid,
            model_name=model_name,
            feature=feature,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
        )
        db.add(log_entry)
        db.commit()
        return log_entry

    def execute_with_failover(
        self,
        prompt: str,
        system_prompt: str,
        is_json: bool = False,
        db: Optional[Any] = None,
        tenant_id: Optional[str] = None,
        user_id: Optional[str] = None,
        feature: str = "general",
        estimated_tokens: int = 1500
    ) -> Tuple[Any, str]:
        """
        Executes query through provider failover chain with budget checking and audit logging.
        Returns (result, provider_name).
        """
        # 1. Check budget if DB and tenant provided
        if db and tenant_id:
            self.check_budget_and_reserve(db, tenant_id, estimated_tokens)

        errors = []
        for provider in self.providers:
            try:
                if is_json:
                    result, p_tokens, c_tokens = provider.generate_json(prompt, system_prompt)
                else:
                    result, p_tokens, c_tokens = provider.generate_text(prompt, system_prompt)

                # Record usage upon success
                if db and tenant_id and user_id:
                    self.record_usage(db, tenant_id, user_id, feature, provider.name, p_tokens, c_tokens)

                return result, provider.name
            except Exception as exc:
                err_msg = f"{provider.name} failed: {str(exc)}"
                logger.warning(err_msg)
                errors.append(err_msg)

        raise AIGenerationError(
            "AI generation failed across all registered providers.",
            details={"errors": errors}
        )

    # ------------------------------------------------------------------------------------
    # Domain Pedagogical Generators
    # ------------------------------------------------------------------------------------

    def generate_exam_mcqs(
        self,
        subject: str,
        topic: str,
        question_count: int,
        difficulty: str,
        program_name: Optional[str] = None,
        program_context: Optional[str] = None,
        db: Optional[Any] = None,
        tenant_id: Optional[str] = None,
        user_id: Optional[str] = None,
        **kwargs: Any
    ) -> List[Dict[str, Any]]:
        """
        Generates validated MCQs adhering to NCTB standards and language invariants.
        """
        safe_subject = self.sanitize_input(subject)[:80]
        safe_topic = self.sanitize_input(topic)[:120]
        safe_diff = self.sanitize_input(difficulty)[:50]
        context_str = program_name or program_context or kwargs.get("class_name") or "Standard Curriculum"
        safe_context = self.sanitize_input(context_str)[:100]

        system_prompt = (
            "You are the Chief Academic Curriculum Examiner for EducationOS. "
            "Generate academic questions strictly for the specified subject and topic. "
            "Output schema must strictly be a JSON array of objects: "
            "[{\"id\": \"q_0\", \"question\": \"...\", \"options\": [\"A\", \"B\", \"C\", \"D\"], "
            "\"correct_option\": \"A\", \"explanation\": \"...\"}]. "
            "Provide exactly 4 distinct options. correct_option must strictly match one option. "
            "Zero Banglish: Use pure Bengali script (বাংলা) or formal English."
        )

        prompt = (
            f"<user_input>\n"
            f"Context: {safe_context}\n"
            f"Subject: {safe_subject}\n"
            f"Topic: {safe_topic}\n"
            f"Grade / Difficulty: {safe_diff}\n"
            f"</user_input>\n"
            f"Total MCQs Required: {question_count}\n"
        )

        raw_result, _ = self.execute_with_failover(
            prompt=prompt,
            system_prompt=system_prompt,
            is_json=True,
            db=db,
            tenant_id=tenant_id,
            user_id=user_id,
            feature="mcq_generator",
            estimated_tokens=question_count * 200
        )

        # Handle wrapped list
        items = raw_result
        if isinstance(raw_result, dict):
            for v in raw_result.values():
                if isinstance(v, list):
                    items = v
                    break

        if not isinstance(items, list):
            raise AIGenerationError("Invalid output format: expected JSON array of questions.")

        validated = []
        for idx, it in enumerate(items):
            it["id"] = f"q_{idx}"
            validated.append(ValidatedMCQItem(**it).model_dump())

        return validated

    def generate_question_paper(
        self,
        db: Any,
        tenant_id: str,
        user_id: str,
        request: QuestionPaperGenerateRequest,
        curriculum_context: Optional[str] = None
    ) -> QuestionPaperStructure:
        """
        Generates full question paper with MCQs and Creative Questions (CQ).
        Enforces human-in-the-loop invariant: Status is always 'Draft'.
        """
        safe_cls = self.sanitize_input(request.class_name)
        safe_subj = self.sanitize_input(request.subject)
        safe_topic = self.sanitize_input(request.topic)

        system_prompt = (
            "You are a Senior NCTB Board Question Setter. "
            "Create a rigorous exam paper adhering to national curriculum standards. "
            "Output must be a JSON object conforming strictly to schema: "
            "{\n"
            "  \"title\": \"Exam Title\",\n"
            "  \"class_name\": \"...\",\n"
            "  \"subject\": \"...\",\n"
            "  \"total_marks\": 50,\n"
            "  \"duration\": \"1.5 Hours\",\n"
            "  \"instructions\": \"Answer all questions.\",\n"
            "  \"mcqs\": [{\"id\": \"q_0\", \"question\": \"...\", \"options\": [\"A\",\"B\",\"C\",\"D\"], \"correct_option\": \"A\", \"explanation\": \"...\"}],\n"
            "  \"creative_questions\": [{\"stem_scenario\": \"...\", \"sub_questions\": [{\"part\": \"a\", \"question\": \"...\", \"marks\": 1}, {\"part\": \"b\", \"question\": \"...\", \"marks\": 2}, {\"part\": \"c\", \"question\": \"...\", \"marks\": 3}, {\"part\": \"d\", \"question\": \"...\", \"marks\": 4}]}],\n"
            "  \"answer_key\": {\"q_0\": \"A\"}\n"
            "}"
        )

        grounding = curriculum_context or "<curriculum_grounding source=\"NCTB\" count=\"0\" />"
        prompt = (
            f"Curriculum Reference Material:\n{grounding}\n\n"
            f"<user_input>\n"
            f"Class: {safe_cls}\n"
            f"Subject: {safe_subj}\n"
            f"Chapter / Topic: {safe_topic}\n"
            f"Total Marks: {request.total_marks}\n"
            f"Duration: {request.duration}\n"
            f"MCQ Count: {request.mcq_count}\n"
            f"CQ Count: {request.cq_count}\n"
            f"</user_input>"
        )

        data, _ = self.execute_with_failover(
            prompt=prompt,
            system_prompt=system_prompt,
            is_json=True,
            db=db,
            tenant_id=tenant_id,
            user_id=user_id,
            feature="question_paper_generator",
            estimated_tokens=3000
        )

        if not isinstance(data, dict):
            raise AIGenerationError("Invalid output structure: Expected JSON object for question paper.")

        # Institutional safeguard: Status MUST remain Draft until human educator approves
        data["status"] = "Draft"
        data["class_name"] = safe_cls
        data["subject"] = safe_subj
        data["total_marks"] = request.total_marks
        data["duration"] = request.duration

        try:
            return QuestionPaperStructure(**data)
        except ValidationError as e:
            raise AIGenerationError(f"Question paper validation failed: {str(e)}", details={"errors": e.errors()})

    def generate_lesson_blueprint(
        self,
        db: Any,
        tenant_id: str,
        user_id: str,
        request: LessonBlueprintGenerateRequest,
        curriculum_context: Optional[str] = None
    ) -> LessonBlueprintStructure:
        """
        Generates modern pedagogical lesson plan with interactive learning activities.
        Enforces human-in-the-loop invariant: Status is always 'Draft'.
        """
        safe_cls = self.sanitize_input(request.class_name)
        safe_subj = self.sanitize_input(request.subject)
        safe_topic = self.sanitize_input(request.topic)

        system_prompt = (
            "You are an Expert Instructional Designer and Master Educator. "
            "Design an interactive, competency-based lesson plan. "
            "Output must be a valid JSON object matching this schema: "
            "{\n"
            "  \"topic\": \"...\",\n"
            "  \"class_name\": \"...\",\n"
            "  \"subject\": \"...\",\n"
            "  \"duration_minutes\": 45,\n"
            "  \"learning_objectives\": [\"Objective 1\", \"Objective 2\"],\n"
            "  \"materials_needed\": [\"Board\", \"Demonstration kit\"],\n"
            "  \"activities\": [\n"
            "     {\"phase\": \"Warm-up (5 mins)\", \"duration_minutes\": 5, \"teacher_action\": \"...\", \"student_action\": \"...\"},\n"
            "     {\"phase\": \"Core Instruction\", \"duration_minutes\": 20, \"teacher_action\": \"...\", \"student_action\": \"...\"},\n"
            "     {\"phase\": \"Guided Practice\", \"duration_minutes\": 15, \"teacher_action\": \"...\", \"student_action\": \"...\"},\n"
            "     {\"phase\": \"Formative Assessment\", \"duration_minutes\": 5, \"teacher_action\": \"...\", \"student_action\": \"...\"}\n"
            "  ],\n"
            "  \"assessment_strategy\": \"Exit ticket and active questioning\",\n"
            "  \"homework\": \"...\"\n"
            "}"
        )

        grounding = curriculum_context or "<curriculum_grounding count=\"0\" />"
        prompt = (
            f"Curriculum Reference Material:\n{grounding}\n\n"
            f"<user_input>\n"
            f"Class: {safe_cls}\n"
            f"Subject: {safe_subj}\n"
            f"Topic: {safe_topic}\n"
            f"Duration: {request.duration_minutes} minutes\n"
            f"Target Competency: {request.target_competency or 'Standard Competency'}\n"
            f"</user_input>"
        )

        data, _ = self.execute_with_failover(
            prompt=prompt,
            system_prompt=system_prompt,
            is_json=True,
            db=db,
            tenant_id=tenant_id,
            user_id=user_id,
            feature="lesson_blueprint_generator",
            estimated_tokens=2500
        )

        if not isinstance(data, dict):
            raise AIGenerationError("Invalid output structure: Expected JSON object for lesson blueprint.")

        data["status"] = "Draft"
        data["class_name"] = safe_cls
        data["subject"] = safe_subj
        data["duration_minutes"] = request.duration_minutes

        try:
            return LessonBlueprintStructure(**data)
        except ValidationError as e:
            raise AIGenerationError(f"Lesson blueprint validation failed: {str(e)}", details={"errors": e.errors()})

    def generate_socratic_guidance(
        self,
        db: Any,
        tenant_id: str,
        user_id: str,
        request: SocraticDialogueRequest,
        curriculum_context: Optional[str] = None
    ) -> SocraticDialogueResponse:
        """
        Socratic pedagogical guidance tutor.
        Never directly reveals homework/exam answers; asks guided probing questions.
        """
        safe_subj = self.sanitize_input(request.subject)
        safe_topic = self.sanitize_input(request.topic)
        safe_query = self.sanitize_input(request.student_query)

        system_prompt = (
            "You are the EducationOS Socratic Pedagogical AI Tutor. "
            "Pedagogical Mandate: NEVER directly reveal solutions, direct calculation answers, or write essays for students. "
            "Instead, identify the underlying concept, provide a gentle scaffold or hint appropriate to hint_level, "
            "and ask a probing question that stimulates the student's critical thinking. "
            "Output MUST be a JSON object: "
            "{\n"
            "  \"pedagogical_concept\": \"Core Concept Name\",\n"
            "  \"guiding_response\": \"Empathetic guiding explanation\",\n"
            "  \"probing_question\": \"What do you think happens if...?\",\n"
            "  \"hint_level\": 1,\n"
            "  \"is_solution_revealed\": false\n"
            "}"
        )

        grounding = curriculum_context or "<curriculum_grounding count=\"0\" />"
        prompt = (
            f"Curriculum Reference:\n{grounding}\n\n"
            f"<user_input>\n"
            f"Subject: {safe_subj}\n"
            f"Topic: {safe_topic}\n"
            f"Student Query: {safe_query}\n"
            f"Current Step: {request.current_step}\n"
            f"</user_input>"
        )

        data, _ = self.execute_with_failover(
            prompt=prompt,
            system_prompt=system_prompt,
            is_json=True,
            db=db,
            tenant_id=tenant_id,
            user_id=user_id,
            feature="socratic_tutor",
            estimated_tokens=1200
        )

        if not isinstance(data, dict):
            raise AIGenerationError("Invalid output structure: Expected JSON object for Socratic guidance.")

        # Enforce pedagogical constraint
        data["is_solution_revealed"] = False
        data["hint_level"] = request.current_step

        try:
            return SocraticDialogueResponse(**data)
        except ValidationError as e:
            raise AIGenerationError(f"Socratic dialogue validation failed: {str(e)}", details={"errors": e.errors()})


ai_gateway = MultiModelAIGateway()
