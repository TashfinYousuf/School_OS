# EDUCATIONOS — COMPLETE INSTITUTIONAL PRODUCT GUIDE
## Comprehensive Architecture, Core Workflows, Pedagogical AI & Ecosystem Operations

**Document Version:** 2026.1-ENTERPRISE  
**Classification:** Institutional Standard Documentation  
**Product Identity:** AI-Powered Intelligent Education Ecosystem  

---

## 1. Brand Story, Mission & Vision

### 1.1 The Institutional Reality
Schools, colleges, and coaching academies operate at the intersection of human aspiration and administrative complexity. While classrooms inspire young minds, the backstage of educational administration is weighed down by fragmented tools:
- Paper registers that decay and waste instructional hours.
- Disconnected spreadsheets prone to formula corruption and financial leakage.
- Exam question preparation that repeats identical questions year after year due to lack of time.
- Terminal result processing that delays student feedback by weeks.
- Anxious parents waiting outside school gates for updates on attendance and safety.

### 1.2 Our Mission
To liberate educators from administrative friction by providing an intelligent, connected, and localized operating ecosystem that elevates institutional standards and enriches student learning.

### 1.3 Our Vision
An educational ecosystem where every administrative interaction is instant, every classroom workflow is connected, decision-making is guided by real-time intelligence, and schools seamlessly evolve with technology without continuous disruption.

---

## 2. The Ecosystem Architecture

EducationOS is engineered as a unified, reactive multi-tenant platform built on five architectural layers:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           STAKEHOLDER CLIENTS                           │
│     Leadership  •  Administrators  •  Educators  •  Students  •  Parents │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Responsive PWA (Service Worker / IndexedDB)
┌────────────────────────────────────▼────────────────────────────────────┐
│                       UNIFIED APPLICATION WORKSPACES                    │
│      School Workspace    •    Academy Workspace    •    Dual Workspace  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ High-Speed REST / HTTP2 API
┌────────────────────────────────────▼────────────────────────────────────┐
│                       INTELLIGENT APPLICATION CORE                      │
│   Auth & RBAC  •  Admissions  •  Attendance  •  Grading  •  Ledgers     │
└──────────────┬───────────────────────────────────────────┬──────────────┘
               │                                           │
┌──────────────▼──────────────┐             ┌──────────────▼──────────────┐
│     MULTI-MODEL AI GATEWAY  │             │   ASYNC WORKER SUBSYSTEM    │
│  Gemini / Groq LLM Routing  │             │  RAG Indexer • Outbox Queue │
│  Pedagogical Pydantic Rules │             │  SKIP LOCKED DB Workers     │
└──────────────┬──────────────┘             └──────────────┬──────────────┘
               │                                           │
┌──────────────▼───────────────────────────────────────────▼──────────────┐
│                    POSTGRESQL MULTI-TENANT STORAGE                      │
│        Native Row Level Security (RLS)  •  Tenant Isolation Engine      │
│        Uploaded Assets Storage (S3 / Cloudflare R2 / Local Disk)        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Comprehensive Module Inventory

### 3.1 Core Platform Modules (Included in Platform Base)

#### A. Institutional Administration & Campus Structure (`core_admin`)
- **Multi-Campus Hierarchy:** Configure main campuses and branch locations with localized contact metadata.
- **Academic Calendar & Routines:** Define terms, examination windows, national holidays, shift timings, and period schedules.
- **Append-Only System Audit Logs:** Every critical administrative action (role changes, fee edits, marks modifications) is recorded in an immutable audit ledger (`audit_logs`) tracking actor, timestamp, IP, and event payload.

#### B. Student 360 & Dual-Model Admissions (`core_students`)
- **Student Digital Twin:** Centralized 360-degree student record encompassing bio-demographics, guardian linkages, attendance percentage, fee payment history, disciplinary notes, and terminal report cards.
- **Model A (Direct Admission):** Instant enrollment workflow generating unique sequential institutional admission numbers (e.g., `KS-2026-001`).
- **Model B (Entrance Examination Screening):** Generates admit cards, entrance exam roll numbers, seat allocations, test score tabulation, and merit-based selection transitions.
- **Class Roster Bulk Import:** CSV and Excel upload parsing with automated duplicate admission ID validation.

#### C. Faculty Roster & Workload Coordination (`core_teachers`)
- **Staff Profiles & Qualifications:** Maintain educator credentials, subject specializations, phone verification, and department assignments.
- **Class Routine Assignment:** Maps educators to specific sections, subjects, and periods, preventing timetable scheduling conflicts.
- **Teacher Attendance Roll Call:** Tracks faculty daily reporting and classroom period presence.

#### D. Guardian & Parent Mobile Portal (`core_guardians`)
- **Multi-Child Unified Access:** Single parent login securely maps to multiple siblings enrolled across different classes and sections.
- **Attendance Transparency:** Daily roll-call presence, lateness, or absence visible immediately.
- **Digital Fee Inspection:** Real-time visibility into paid tuition receipts, outstanding balances, and official fee structures.

#### E. Smart Attendance & Offline Resilience (`core_attendance`)
- **1-Tap Roster Calling:** Intuitive, touch-optimized classroom list allowing teachers to mark Present, Absent, or Late in under 30 seconds.
- **Offline Mutation Queue:** In poor network conditions, attendance entries are cryptographically queued in browser IndexedDB with unique idempotency keys (`ATT_{class}_{date}`). Submissions flush automatically upon network re-establishment without duplicate creation.
- **Printable A4 Monthly Register:** Publication-grade monthly attendance percentage sheets formatted for institutional archiving and board inspections.

#### F. Examinations & NCTB Grading Engine (`core_exams`, `core_results`)
- **National Curriculum 7-Tier Standard:** Pre-configured letter grade evaluation conforming strictly to Bangladesh Board requirements:
  - $80–100\%$: $A+$ (GPA 5.0)
  - $70–79\%$: $A$ (GPA 4.0)
  - $60–69\%$: $A-$ (GPA 3.5)
  - $50–59\%$: $B$ (GPA 3.0)
  - $40–49\%$: $C$ (GPA 2.0)
  - $33–39\%$: $D$ (GPA 1.0)
  - $0–32\%$: $F$ (GPA 0.0, Failed)
- **Continuous Assessment (CA) Weightage:** Seamless aggregation of formative class assessments, mid-terms, and terminal final examinations.
- **1-Click A4 Progress Report Cards:** Generates downloadable, print-ready terminal result cards complete with institutional crest, principal’s signature line, position in class, and subject mark breakdowns.

#### G. Institutional Noticeboard & Bulletins (`core_notices`)
- **Targeted Audience Publishing:** Draft notices for Everyone, Guardians Only, Faculty Only, or Students Only.
- **Print Notice Pad:** Formats circulars into standard official A4 memorandum layouts.

---

### 3.2 Optional Paid Modules & Service Expansions

#### A. AI Copilot & Question Paper Composer (`module_ai_assistant`)
- Composes syllabus-grounded MCQ papers and Creative Question stems in pure Bengali and English. Includes 250,000 monthly Gemini API tokens and syllabus chunk RAG indexing.

#### B. Advanced Finance & Fee Collection (`module_advanced_finance`)
- **Dual-Copy Receipts:** Instant student copy and office copy receipts printed on standard half-A4 or thermal receipt printers.
- **Multi-Channel Tracking:** Reconciles physical cash drawers, direct bank deposits, and mobile banking references (bKash, Nagad, Rocket).
- **Fee Head Management:** Customizable heads for Monthly Tuition, Admission Fees, Session Charges, Laboratory, Library, and Uniforms.
- **Defaulter & Due Management:** Real-time due lists filterable by class and section with one-click reminder preparation.

#### C. Hosted Institutional Public Website (`module_school_website`)
- Modern, responsive, public-facing school portal featuring About Us, Principal’s Message, Photo Gallery, Noticeboard, Faculty Directory, and Online Admission Inquiries.

#### D. Custom Domain & Managed SSL (`module_custom_domain`)
- Automated DNS mapping for official academic domains (`yourschool.edu.bd`) with automated Let's Encrypt wildcard TLS certification.

#### E. Automated WhatsApp & SMS Absence Alerts (`module_whatsapp_alerts`)
- Dispatches instant automated alerts to verified guardian mobile numbers when a student is recorded absent during morning roll call.

---

## 4. The Pedagogical AI Architecture

EducationOS implements **Pedagogical AI** designed specifically for educational rigor, avoiding the hallucinations and security risks of generic consumer chatbots:

### 4.1 Multi-Model Gateway & Resilience
- **Model Routing:** Routes heavy analytical tasks (exam question generation, syllabus parsing) through Google Gemini, with automatic fallback failover to Groq/Llama-3.3 for high-availability reliability.
- **Strict Pydantic Validation:** LLM responses are parsed strictly into strongly-typed Pydantic schemas. Unstructured or malformed outputs are rejected and regenerated before presentation.
- **OWASP LLM01 Injection Defenses:** Pre-screens user prompts against prompt injection heuristics, jailbreaks, and instructions attempting to override curriculum rules.

### 4.2 Curriculum RAG (Retrieval-Augmented Generation)
- **Multilingual Token Chunking:** Splits national textbooks and institutional syllabi into semantic units, respecting both English sentence boundaries and Bengali sentence markers (Dari `।`, Double Dari `॥`).
- **Semantic Vector Embeddings:** Textbook chunks are embedded into high-dimensional vector representations, enabling teachers to generate questions strictly from uploaded chapters rather than general internet data.
- **Strict Human Invariant:** All AI-composed exam questions, lesson blueprints, and notices are initialized as `Draft`. They cannot be published or distributed without educator review and signature.

### 4.3 Socratic Learning Studio
- **Pedagogical Mandate:** When students interact with the AI tutor, the system is strictly instructed *never* to write essays or solve math problems directly. It provides contextual scaffolding, gentle hints, and probing conceptual questions that prompt the student to discover the answer independently.

---

## 5. Technology Stack & Enterprise Reliability

| Tier | Technology | Technical Purpose | Institutional Benefit |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | Next.js 16 (App Router), React 19 | Server-side rendering & static generation | Sub-second page loads, zero UI lag |
| **Language & Typing** | TypeScript 5 | Strict static typing throughout | Zero runtime type errors, stable UI |
| **Backend Framework** | FastAPI (Python 3.12) | High-concurrency async REST API | Handles thousands of concurrent roll calls |
| **Database Engine** | PostgreSQL 16/17 (Supabase) | ACID relational data integrity | Prevents financial record corruption |
| **Security Mechanism** | Native PostgreSQL RLS | Kernel-level row isolation | Complete cross-school data quarantine |
| **Object Storage** | Cloudflare R2 / AWS S3 | Encrypted object storage | Secure, cost-effective document storage |
| **Offline Engine** | Service Worker + IndexedDB | Local caching & mutation queues | Continuous operation during internet outages |
| **Styling & Theme** | Tailwind CSS + next-themes | Dynamic Dark/Light mode | Comfortable reading in any lighting condition |

---

## 6. Frequently Asked Questions (FAQ)

#### Q1: Does EducationOS require expensive on-premise servers?
**No.** EducationOS is cloud-hosted and accessible securely from any standard web browser on desktop PCs, laptops, tablets, or smartphones. Your institution incurs zero server maintenance or hardware replacement costs.

#### Q2: What happens if our school internet connection drops during morning roll call?
Teachers can continue taking attendance without interruption. Thanks to our Progressive Web App (PWA) architecture, the roll call is securely saved in the device's local memory (IndexedDB) and automatically uploads to the central database the moment connection is restored.

#### Q3: Can teachers edit AI-generated question papers before giving them to students?
**Yes, absolutely.** EducationOS enforces a strict *Human-in-the-Loop* principle. Every question paper generated by the AI is created as a `Draft`. Teachers can edit questions, change options, swap marks, or delete questions before approving and publishing the paper.

#### Q4: How is our school's student and financial data kept separate from other institutions?
We use PostgreSQL Native Row-Level Security (RLS). Unlike basic software that separates schools with simple software filters, our database engine itself blocks any user from querying rows that do not belong to their unique institutional ID. Cross-tenant data leakage is physically prevented by the database engine.

#### Q5: Can we migrate our existing student data from Excel or spreadsheets?
**Yes.** EducationOS includes an intuitive CSV/Excel bulk import tool with automated column mapping and error-checking. Our technical onboarding team also assists in formatting and safely importing your historical records.

