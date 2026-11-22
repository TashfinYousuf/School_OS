# EducationOS — Curriculum Framework & Subject Competencies Acceptance Report

**Artifact ID:** `QA-DOC-ACAD-01`  
**Feature:** Curriculum Framework, NCTB Benchmark Alignment & Competency Map  
**Target View:** `/dashboard/academic` (Tab: "Curriculum & Competencies")  
**Verification Date:** November 14, 2026  
**Status:** **ACCEPTED & VERIFIED**

---

## 1. Overview & Business Rationale
Prior to remediation, the Curriculum & Grades tab rendered a static placeholder with repetitive mock cards ("General Science ↳ Competency: Critical Thinking") for every grade level and hardcoded statistics in the side intelligence card.

The remodeled **Curriculum & Competencies Hub** transforms this into an authentic, standards-based operational interface that binds directly to:
1. Canonical and tenant-configured academic grades (`/api/v1/academic/grades`).
2. Bangladesh National Curriculum and Textbook Board (NCTB) standard benchmarks (Primary, Junior Secondary, Secondary/SSC).
3. Live RAG Knowledge Base chunk indexing (`/api/v1/ai/curriculum/documents`).

---

## 2. Key Architectural Capabilities

### A. Dynamic Grade and Class Scoping
- Provides an instant class filter selector ("All Configured Classes", Class 1 through Class 10/12).
- Automatically derives curricular tier (Primary Stage, Junior Secondary Stage, Secondary Stage/SSC) with customized pedagogical guidelines.

### B. NCTB Core Subject Competency Models
For each class stage, authentic subjects are configured with:
- **Official Subject Code:** e.g., `BAN-101`, `ENG-102`, `MTH-103`, `SCI-104`, `BGS-105`, `ICT-205`, `PHY-301`, `CHM-302`.
- **Competency Categorization:** Badges tagged by domain (Critical Thinking, Scientific Inquiry, Problem Solving, Language & Communication, Digital Literacy, Applied Life Skills, Ethical Awareness).
- **Competency Behavioral Descriptions:** Clear rubrics detailing how students exhibit mastery.
- **Weekly Credit Periods:** Real schedule allocations aligned with routine scheduling.
- **Key Learning Outcomes:** Measurable classroom outcomes with verification checkboxes.

### C. Live Vector RAG Grounding Indicator
- Dynamically checks tenant documents indexed in the Curriculum RAG vector store for each subject and class.
- When verified chunks exist: Displays green `[X Chunks Grounded]` badge with `Sparkles` icon.
- When ungrounded: Displays `NCTB Baseline` indicator and guides the educator to upload authentic textbooks in the Knowledge Base tab.

### D. Inter-Module Workflow Bridging
- **"Competency Map" Action:** Launches an accessible, responsive modal detailing full competencies, rubrics, and learning outcomes for that subject.
- **"Draft Lesson" Action:** One-click transition that switches directly to the Daily Teaching Hub tab, prefilling the class, subject, and topic context for immediate AI handout generation or lesson logging.

---

## 3. UI/UX & Responsive Accessibility Standards
- Clean GitHub-style typography, dark mode support (`dark:bg-[#0f0f11]`), and responsive multi-column layout.
- Accessible modals with backdrop dismiss, `Escape` key capture, and viewport containment (`max-h-[92vh] max-w-[calc(100vw-1.5rem)]`).
- Printable timetable and handout isolation preventing layout collision during print routines.

---

## 4. Verification & Testing Evidence
- **TypeScript Static Analysis:** `cd frontend && npx tsc --noEmit` -> Exit Code `0` (0 errors).
- **Backend API Contract:** Verified against `/api/v1/academic/grades` and `/api/v1/ai/curriculum/documents`.

