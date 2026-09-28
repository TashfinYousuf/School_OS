import os
import re
import json
import httpx
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, field_validator
from dotenv import load_dotenv, find_dotenv

# 🚀 1. Guarantee .env is fully parsed at the very top of import cycle
load_dotenv(find_dotenv(), override=True)

from google import genai
from google.genai import types

class AIGenerationError(Exception):
    """Domain exception raised when all AI gateways fail or output invalid schema."""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class ValidatedMCQ(BaseModel):
    id: str
    question: str
    options: List[str]
    correct_option: str
    explanation: str

    @field_validator("options")
    @classmethod
    def validate_options(cls, v):
        if len(v) != 4:
            raise ValueError("Each MCQ must have exactly 4 options.")
        if len(set(opt.strip().lower() for opt in v)) != 4:
            raise ValueError("Options must be unique.")
        return v

    @field_validator("correct_option")
    @classmethod
    def validate_correct_option(cls, v, info):
        opts = [o.strip().lower() for o in info.data.get("options", [])]
        if v.strip().lower() not in opts and not any(v.strip().lower() == o[:len(v)] for o in opts):
            raise ValueError("Correct option must be one of the 4 provided options.")
        return v


class MultiModelAIGateway:
    """
    Enterprise-grade Multi-Provider Gateway:
    Primary: Google Gemini 2.5 Flash
    Secondary: Groq Cloud (Llama 3.3 70B Versatile) / OpenRouter
    Zero-Deception: Never returns preset fake Banglish questions.
    """

    def __init__(self):
        self.gemini_key = (
            os.getenv("GEMINI_API_KEY") or 
            os.getenv("GOOGLE_API_KEY") or 
            ""
        ).strip().strip('"').strip("'")
        
        self.groq_key = (
            os.getenv("GROQ_API_KEY") or 
            os.getenv("OPENROUTER_API_KEY") or 
            ""
        ).strip().strip('"').strip("'")

        self.gemini_client = genai.Client(api_key=self.gemini_key) if len(self.gemini_key) > 10 else None

    def _clean_json_text(self, text: str) -> List[Dict[str, Any]]:
        cleaned = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
        match = re.search(r'\[.*\]', cleaned, re.DOTALL)
        if match:
            cleaned = match.group(0)
        return json.loads(cleaned)

    def _call_gemini(self, prompt: str, system_prompt: str) -> List[Dict[str, Any]]:
        if not self.gemini_client:
            raise ValueError("Gemini API key is not configured.")
        
        chat = self.gemini_client.chats.create(
            model="gemini-2.5-flash",
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.2,
                response_mime_type="application/json"
            )
        )
        res = chat.send_message(prompt)
        return self._clean_json_text(res.text)

    def _call_groq_fallback(self, prompt: str, system_prompt: str) -> List[Dict[str, Any]]:
        if not self.groq_key or len(self.groq_key) < 10:
            raise ValueError("Secondary AI Gateway (Groq) is not configured.")

        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.groq_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "llama-3.3-70b-versatile",
            "messages": [
                {"role": "system", "content": system_prompt + " Output raw JSON array ONLY."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.2,
            "response_format": {"type": "json_object"}
        }

        with httpx.Client(timeout=25.0) as client:
            response = client.post(url, headers=headers, json=payload)
            if response.status_code != 200:
                raise ValueError(f"Groq API error ({response.status_code}): {response.text}")
            
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            parsed = json.loads(content)
            if isinstance(parsed, dict):
                # If wrapped in a key like {"questions": [...]}
                for v in parsed.values():
                    if isinstance(v, list):
                        return v
            return parsed if isinstance(parsed, list) else []

    def generate_exam_mcqs(
        self,
        subject: str,
        topic: str,
        question_count: int,
        difficulty: str,
        program_name: Optional[str] = None,
        program_context: Optional[str] = None,
        **kwargs: Any
    ) -> List[Dict[str, Any]]:
        # Safely resolve program context whether caller passes program_name or program_context
        resolved_context = (
            program_name or 
            program_context or 
            kwargs.get("class_name") or 
            "Academic Curriculum Assessment"
        )

        system_prompt = (
            f"You are the Chief Academic Curriculum Examiner for {program_context} in Bangladesh. "
            f"STRICT RULE 1: You must generate questions strictly for '{subject}' on topic '{topic}'. "
            f"STRICT RULE 2: Under no circumstance include other subjects (e.g. absolutely no Physics in a Chemistry/Language exam). "
            f"STRICT RULE 3: Provide 4 distinct options and clean scientific/academic explanation for each. "
            "Output schema must strictly be a JSON array of objects: "
            "[{\"id\": \"q_0\", \"question\": \"...\", \"options\": [\"A\", \"B\", \"C\", \"D\"], \"correct_option\": \"A\", \"explanation\": \"...\"}]."
        )

        prompt = (
            f"Academic Context: {program_context}\n"
            f"Subject: {subject}\n"
            f"Topic / Chapter: {topic}\n"
            f"Standard / Grade Level: {difficulty}\n"
            f"Total Questions Required: {question_count}\n"
        )

        questions_raw = []
        errors = []

        # 1. Attempt Primary: Gemini 2.5 Flash
        try:
            questions_raw = self._call_gemini(prompt, system_prompt)
        except Exception as e:
            errors.append(f"Primary (Gemini) failed: {str(e)}")

        # 2. Attempt Secondary: Groq Fallback if Primary Failed
        if not questions_raw:
            try:
                questions_raw = self._call_groq_fallback(prompt, system_prompt)
            except Exception as e:
                errors.append(f"Secondary (Groq) failed: {str(e)}")

        # 3. Absolute Zero Fake Fallback: Fail honestly if models fail
        if not questions_raw:
            raise AIGenerationError(
                message="AI Question Generation failed on both Primary (Gemini) and Secondary (Groq) models. "
                        "Please verify your API keys or create questions manually in Question Bank.",
                details={"errors": errors}
            )

        # Validate Schema
        validated = []
        for idx, item in enumerate(questions_raw):
            item["id"] = f"q_{idx}"
            validated.append(ValidatedMCQ(**item).model_dump())

        return validated

ai_gateway = MultiModelAIGateway()