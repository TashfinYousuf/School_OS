# EducationOS — Student Learning Studio Product Specification
**Document ID:** `docs/STUDENT_LEARNING_STUDIO_PRODUCT_SPEC.md`  
**Date:** 2026-11-11  
**Status:** ARCHITECTURAL SPECIFICATION & GOVERNANCE  
**Auditors:** Principal Product Architect, Learning Experience Designer, AI Engineer  

---

## 1. Product Vision & Pedagogical Philosophy

The EducationOS Student Learning Studio is a digital learning companion engineered to foster critical thinking, deep conceptual mastery, and disciplined study habits.

**Guiding Pedagogical Principle: "Teach, Don't Just Answer"**
- The AI companion acts as a Socratic tutor. It guides the student through scaffolding questions, intuitive analogies, and hints—never simply providing the direct answer to homework or exam problems.
- Supports bilingual learning in Bengali and English (Bangla curriculum alignment).

---

## 2. Core Functional Modules

```
┌────────────────────────────────────────────────────────────────────────┐
│                   LEARNING STUDIO MODULE ARCHITECTURE                  │
│                                                                        │
│   ┌───────────────────────────┐       ┌────────────────────────────┐   │
│   │   1. Socratic AI Tutor    │       │   2. Study Room Workspace  │   │
│   │   Interactive Scaffolding │       │   Focus Timer, Goals, Note │   │
│   └───────────────────────────┘       └────────────────────────────┘   │
│   ┌───────────────────────────┐       ┌────────────────────────────┐   │
│   │   3. Practice Center      │       │   4. Adaptive Flashcards   │   │
│   │   Topic MCQs & Feedback   │       │   Spaced-Repetition System │   │
│   └───────────────────────────┘       └────────────────────────────┘   │
│   ┌───────────────────────────┐       ┌────────────────────────────┐   │
│   │   5. Quiz & Exam Prep     │       │   6. Multimodal Doubt Solv │   │
│   │   Timed Curriculum Quizzes│       │   OCR & Math Step Analysis │   │
│   └───────────────────────────┘       └────────────────────────────┘   │
│   ┌───────────────────────────┐       ┌────────────────────────────┐   │
│   │   7. Document & RAG Study │       │   8. Debate & Critical     │   │
│   │   Authorized Class Chunks │       │   Structured Argumentation │   │
│   └───────────────────────────┘       └────────────────────────────┘   │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │   9. Personal Learning Analytics & Mastery Tracker             │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

### Module Breakdown:
1. **Socratic AI Tutor (`/student/learning/tutor`):**
   - Step-by-step guidance. Identifies the exact misconception or missing step.
   - Grounded in NCTB textbooks and curriculum standards.
2. **Study Room (`/student/learning/study-room`):**
   - Personal focus workspace with Pomodoro timer (25/5 min).
   - Session goal setting and markdown study note-taking.
3. **Practice Center (`/student/learning/practice`):**
   - Topic-specific MCQs and conceptual questions.
   - Instant feedback with detailed explanations of wrong options.
4. **Adaptive Flashcards (`/student/learning/flashcards`):**
   - Leitner / spaced-repetition scheduling algorithm.
   - AI-assisted card generation from class syllabus.
5. **Quiz & Exam Prep (`/student/learning/quizzes`):**
   - Timed quizzes matching school exam patterns.
   - Post-quiz diagnostic: identifies weak sub-topics for targeted revision.
6. **Multimodal Doubt Solver (`/student/learning/doubt-solver`):**
   - Text or image-based problem input.
   - Optical Character Recognition (OCR) of handwritten math or Bengali text.
   - Socratic breakdown of the problem.
7. **Document & Curriculum RAG Analysis:**
   - Grounded in `curriculum_chunks` table.
   - Strictly scoped to the student's enrolled grade level and subjects.
8. **Debate & Critical Thinking (`/student/learning/debate`):**
   - Structured debate bot: student presents arguments; AI counters with evidence-based counterarguments.
9. **Personal Learning Analytics:**
   - Daily study streak tracker, topics practiced, accuracy rate, and mastery badges.

---

## 3. Data Isolation & Privacy Guardrails

1. **Strict Student Scoping:** A student's study notes, flashcards, practice attempts, and chat sessions are strictly private to that student (`student_id == authenticated_student_id`).
2. **Zero Cross-Student Retrieval:** AI vector search and document retrieval filter strictly by `(tenant_id = :tid OR is_global_curriculum = TRUE) AND class_name = :student_class`. A student cannot access study notes or exam drafts belonging to other students or teachers.
3. **Age-Appropriate Safety Filter:** Content moderation filters out profanity, non-educational topics, and inappropriate content.

---

## 4. AI Cost Control & Token Budgeting

All Learning Studio AI calls traverse the centralized server-side AI Gateway:
- **Tenant Monthly Budget:** Checks `tenant_ai_budgets.allocated_tokens_monthly`. If exceeded, non-critical AI tutor requests are throttled or placed in queue.
- **Per-Student Rate Limits:** Maximum 10 requests per minute; maximum 50 queries per day.
- **Token Accounting:** Every invocation records prompt and completion tokens in `ai_usage_logs` linked to `user_id` and `tenant_id`.

