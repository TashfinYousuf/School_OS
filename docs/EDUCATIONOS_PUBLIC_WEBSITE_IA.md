# EducationOS — Public Website & Commercial Brand Information Architecture (Stage 12.5)

**Document Version:** 1.0.0-PROD  
**Author:** Principal Product Architect & User Experience Lead  
**Target Milestone:** Stage 12.5 Implementation  
**Execution Mode:** Gated Architectural Plan (Awaiting Authorization)

---

## 1. Information Architecture & Route Tree

EducationOS requires a cohesive, public commercial website serving prospective school founders, principals, coaching academy directors, teachers, guardians, and enterprise investors.

```
/ (Root Commercial Homepage)
├── /about                     # Founding Story, Mission, Vision 2030, Leadership
├── /solutions
│   ├── /school                # K-12 Formal School Operating System
│   ├── /academy               # Coaching Center, Model Test & Batch Engine
│   └── /unified               # Combined Trust / Dual-Entity Campus Operating System
├── /features                  # Interactive Module Catalog & Feature Comparison
├── /pricing                   # Public Price List, Tier Matrix, Interactive ROI Calculator
├── /security                  # AEGIS-X Sentinel, PostgreSQL RLS, Compliance & Data Locality
├── /technology                # AI Gateway, Offline Sync Architecture, Tech Stack
├── /contact                   # Enterprise Inquiries, Campus Demo Booking, Offices
├── /docs                      # User Manuals, API Specs, Integration Guides
├── /help                      # Knowledge Base, Searchable FAQs, System Status Link
├── /legal
│   ├── /privacy               # Comprehensive Privacy Policy (Bangladesh & International)
│   ├── /terms                 # Commercial Terms of Service
│   ├── /user-agreement        # Acceptable Use Policy & End-User License Agreement
│   ├── /cookies               # Cookie Declaration & Tracking Governance
│   ├── /copyright             # IP & Intellectual Property Declarations
│   └── /refund                # 14-Day Refund & Cancellation Policy
├── /onboard                   # Self-Service 7-Step Commercial Onboarding Journey
└── /login                     # Unified Institutional Role-Based Sign-In
```

---

## 2. Page Specifications & Content Strategy

### 2.1 Commercial Homepage (`/`)
- **Hero Section:**
  - Value Proposition: *"The Autonomous Education Operating System for High-Performing Institutions."*
  - Subhead: *"Seamlessly unify student admissions, biometric attendance, double-entry fee ledgers, NCTB pass/fail grading, and AI-powered lesson planning under a single secure platform."*
  - Dual CTAs: Primary: `Start 30-Day Free Trial` (`/onboard`) | Secondary: `Explore Live Demo` (Modal / Video walkthrough) | Tertiary: `Institutional Login` (`/login`).
  - Trust Badges: *"Built for Bangladesh National Curriculum (NCTB) • IPEMIS & BANBEIS Compliant • AEGIS-X Sentinel Protected"*.
- **Institutional Persona Selector:**
  - Interactive tabs switching value propositions for:
    - *Principals & Founders:* Board reporting, cash leak prevention, teacher efficiency.
    - *Teachers:* 1-tap roll call, automated voice diary, exam question paper generator.
    - *Parents & Students:* Instant WhatsApp attendance alerts, A4 term report cards, Socratic AI doubt solver.
    - *Academy Directors:* Concurrency-safe model tests, instant merit rank percentiles, batch fee installments.
- **Interactive Solutions Showcase:**
  - Split cards detailing *SchoolOS*, *AcademyOS*, and *Unified Workspace*.
- **Live ROI & Time-Savings Calculator:**
  - Slider adjusting student body count (100 to 5,000) showing estimated monthly hours saved in report card tabulation, fee reconciliation, and parent communication.
- **Enterprise Security & Reliability Bar:**
  - 99.9% uptime SLA, PostgreSQL Row Level Security, HMAC-SHA256 encrypted payments, local and cloud backup redundancy.
- **Conversion CTA & Pre-Footer:**
  - Callout: *"Transform your campus in under 15 minutes with zero hardware setup."*

### 2.2 Solutions Pages (`/solutions/*`)
- **SchoolOS (`/solutions/school`):**
  - Focus: Formal K-12 management, classroom routines, teacher collisions prevention, government IPEMIS payload generation, annual term exams, student welfare flags.
- **AcademyOS (`/solutions/academy`):**
  - Focus: High-velocity coaching centers (e.g. Udvash/Omni model), multi-batch enrollment, negative marking (-0.25), central merit lists, SMS notifications, tuition installments.
- **Unified Campus (`/solutions/unified`):**
  - Focus: Dual-mode institutions operating both a morning K-12 school and an evening coaching academy under one physical campus, sharing teacher identities but segregating financial ledgers.

### 2.3 Public Pricing & Interactive Calculator (`/pricing`)
- **Billing Period Toggle:** Monthly vs Annual Billing (Annual highlights *"2 Months Free — 12 months for the price of 10"*).
- **Currency Toggle:** BDT (৳) for domestic institutions, USD ($) for international/English medium schools.
- **Plan Comparison Grid:**
  - *School Starter (৳990/mo):* Up to 100 students, daily attendance, single-counter fee receipts, NCTB report cards, 30 AI questions/mo.
  - *School Growth (৳2,490/mo):* Up to 500 students, WhatsApp attendance alerts, Teacher voice diary, 100 AI questions/mo.
  - *School Professional (৳5,990/mo):* Up to 1,500 students, OMR sheet scanner, multi-branch administration, audit ledger, 300 AI questions/mo.
  - *Academy Growth (৳3,990/mo):* Up to 600 batch enrollments, timed live exams, central merit lists, 200 AI questions/mo.
  - *Unified Pro (৳9,990/mo):* Combined school + academy workspaces, unlimited branches, dedicated SLA, 2,000 AI questions/mo.
  - *Enterprise Custom (Contact Us):* Dedicated infrastructure, custom white-label mobile app, custom ERP integration.
- **Granular Add-on Selector:**
  - Extra AI Exam Questions (৳500 per 500 questions).
  - WhatsApp Notification Credits (৳0.35 per verified template alert).
  - AEGIS-X Security Pro (৳1,000/mo for SOC2 compliance logging and IP geofencing).

### 2.4 Security, Privacy & Technology Hub (`/security`, `/technology`)
- **Architecture Highlights:**
  - Native PostgreSQL Row Level Security (RLS) enforcing strict tenant isolation at the kernel database level.
  - End-to-end cryptographic integrity: bcrypt/Argon2 password hashing, rotated JWT tokens, SHA-256 webhook signatures.
  - OWASP Top 10 API & LLM defense implementations (anti-prompt injection firewalls, rate limiting).
  - Data Locality & Resilience: Automated daily database snapshots, multi-region failover capabilities.

### 2.5 Documentation & Help Center (`/docs`, `/help`)
- **Structured Knowledge Base:**
  - Getting Started: School registration, importing students via CSV, inviting faculty.
  - Operations Guides: Running digital roll calls, issuing monthly fee receipts, generating report cards.
  - Video Tutorials: Step-by-step 2-minute walkthroughs in Bengali and English.
  - Searchable FAQ Accordion.

### 2.6 Comprehensive Legal & Compliance Suite (`/legal/*`)
- **Privacy Policy (`/legal/privacy`):**
  - Compliant with Bangladesh ICT Act, Digital Security Act, and international data minimization standards.
  - Explicit declaration of student and guardian PII handling: Data is owned exclusively by the institution; EducationOS never sells, monetizes, or uses student records for advertising.
- **Terms of Service (`/legal/terms`):**
  - SLA commitments (99.9% availability), permitted usage, data retention upon subscription expiration (90 days preservation before archival).
- **User Agreement (`/legal/user-agreement`):**
  - Ethical standards, acceptable use for students, teachers, and guardians.
- **Cookie Policy (`/legal/cookies`):**
  - Functional session cookies only; zero third-party advertising tracking cookies.
- **Refund & Cancellation Policy (`/legal/refund`):**
  - 14-day money-back guarantee for initial subscriptions; prorated cancellation policy for annual plans.

---

## 3. Verified Trust Footer & Official Resources

The global public footer must project absolute legitimacy and institutional prestige. It must contain exclusively verified, authentic channels and official educational resources:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     EDUCATIONOS FOOTER                                      │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│  [EducationOS Logo]          SOLUTIONS          RESOURCES            LEGAL & COMPLIANCE     │
│  The Autonomous Institutional SchoolOS K-12      Documentation        Privacy Policy        │
│  Operating System.           AcademyOS Coaching  Help Center          Terms of Service      │
│                              Unified Campus      API Reference        User Agreement        │
│  Contact: +880 1700-000000   Pricing & Calculator System Status       Cookie Declaration    │
│  Email: contact@schoolos.app Multi-Branch        NCTB Grading Engine  Refund & Cancellation │
│  Campus: Nazrul Avenue,                          IPEMIS Connector                           │
│  Kandirpar, Cumilla-3500                                                                    │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│  REGULATORY & OFFICIAL EDUCATION STANDARDS (BANGLADESH):                                    │
│  • Ministry of Education (moedu.gov.bd)    • Directorate of Secondary & Higher Education     │
│  • National Curriculum & Textbook Board (NCTB) • BANBEIS Educational Database Registry      │
│  • Integrated Primary Education Management Information System (IPEMIS)                     │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│  SECURITY & COMPLIANCE:                                                                     │
│  • AEGIS-X Sentinel Core   • PostgreSQL Native RLS   • ISO 27001 Aligned   • 256-bit SSL   │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│  © 2026 EducationOS Technologies. All rights reserved. Built with pride for modern campuses.│
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Public Support AI Assistant Architecture

To assist prospective clients, guide onboarding administrators, and triage support queries without creating security vulnerabilities, EducationOS introduces a **Sandboxed Public Support AI Assistant**.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                PUBLIC SUPPORT AI ASSISTANT                              │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│  [User Query] ──► [OWASP LLM01 Sanitizer] ──► [Intent Classifier]                        │
│                                                       │                                 │
│         ┌─────────────────────────────────────────────┴─────────────────────┐           │
│         ▼                                                                   ▼           │
│   [Product FAQ & Docs RAG]                                         [Ticket Escalation]  │
│   (Read-Only Public Vector Store)                                   (POST /api/support) │
│         │                                                                   │           │
│         ▼                                                                   ▼           │
│   [Gemini 2.5 Flash / Groq] ──────────────────────────► [Safe Markdown Response Widget]│
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Strict Security & Isolation Invariants
1. **Zero Access to Tenant Databases:** The public AI agent has no SQL connection, no SQLAlchemy session, and no access to `Student`, `User`, `FeePayment`, or `InstitutionSubscription` tables.
2. **Read-Only Public Knowledge Base:** RAG knowledge is derived strictly from public documentation, feature specs, pricing catalogues, and help articles.
3. **OWASP LLM01 Prompt Injection Firewall:** Incoming messages are filtered through the regex and token sanitizer in `app/services/ai_gateway.py` before hitting LLM inference.
4. **Tool Restrictions:** The agent possesses exactly one tool: `create_support_ticket(name, email, institution_name, phone, query_category, message)`. It has no other external tools.
5. **Rate Limiting:** IP-based token bucket limiter (maximum 15 queries per hour per IP) with CAPTCHA challenge after 10 continuous requests.

---

## 5. Technical Implementation & Performance Standards

### 5.1 Design System & Typography
- **Design Tokens:** Strict adherence to Tailwind CSS v4 variables with dark/light theme persistence (`next-themes`).
- **Typography:** Geist Sans for crisp UI hierarchy, Geist Mono for code/identifiers, and Tiro Bangla / Hind Siliguri for authentic Bengali typography.
- **Icons:** Pure Lucide React (`lucide-react`) icons.
- **Zero Bootstrap Duplication:** Verified zero imported Bootstrap stylesheets or classes.

### 5.2 Core Web Vitals & Accessibility Targets
- **Largest Contentful Paint (LCP):** $\le 1.8\text{ seconds}$ on 4G mobile networks.
- **First Input Delay (FID) / INP:** $\le 100\text{ ms}$.
- **Cumulative Layout Shift (CLS):** $\le 0.05$.
- **Accessibility:** 100% WCAG 2.1 Level AA conformance:
  - Color contrast ratio $\ge 4.5:1$ for normal text, $\ge 3:1$ for large headings.
  - Full keyboard accessibility (`Tab`, `Shift+Tab`, `Enter`, `Escape`) across all interactive menus and dialogs.
  - Explicit ARIA labels (`aria-expanded`, `aria-controls`, `aria-label`) on all navigation triggers.
