# EducationOS — Hosted Institutional Website Builder Specification
**Document ID:** `docs/INSTITUTION_WEBSITE_BUILDER_SPEC.md`  
**Generated:** 2026-11-11  
**Author:** SaaS Product Architect & Frontend UX Lead  
**Scope:** Stage 6 Hosted School Website CMS Module (`module_school_website`)  

---

## 1. Product Vision & Value Proposition

Many primary and secondary schools in Bangladesh lack a dedicated web development agency or hosting budget, yet require an official web presence to publish holiday notices, display campus photo galleries, and collect prospective student admissions inquiries.

The **EducationOS Hosted Website Builder** provides an intuitive, tenant-scoped Content Management System (CMS) that generates a fast, mobile-friendly, accessible school website at `<school-slug>.educationos.app` or the school's custom domain without requiring code.

---

## 2. Configurable Institutional Website Capabilities

Administrators manage their public website directly from `/dashboard/settings?tab=website`:

| Website Section | Configurable Fields & Controls | Storage / Data Source |
| :--- | :--- | :--- |
| **Header & Branding** | School crest/logo, official school name, tagline, primary brand color. | `school_profiles.logo_url`, `theme_color` |
| **Hero Section** | Banner image, welcome message from Principal, quick action buttons (Admit, Notice, Contact). | `tenant_website_settings.hero_json` |
| **About Campus** | History, founding year, EIIN number, board affiliation, mission statement. | `school_profiles.about_text` |
| **Official Notices** | Automatically displays notices marked as `is_public = True`. | `notices` table (filtered by `tenant_id`) |
| **Admission Inquiries** | Online application form capturing student name, class, guardian phone, and previous school. | `admissions` table (status = `INQUIRY`) |
| **Campus Gallery** | Categorized photo albums (Annual Sports, Science Fair, Cultural Day). | Private Object Storage with public CDN URLs |
| **Teacher Directory** | Teacher photos, designations, subjects taught, and contact emails (optional). | `teachers` table (filtered by `tenant_id`) |
| **Footer & Contact** | Campus physical address, phone, official email, Google Maps embed code. | `school_profiles.address`, `contact_phone` |
| **SEO Metadata** | Meta title, description, OpenGraph preview image for social sharing. | `tenant_website_settings.seo_meta` |

---

## 3. Security, Sandboxing & Tenant Isolation Invariants

1. **Strict Origin & Script Isolation:** The website builder does NOT allow arbitrary script injection (no raw `<script>` tags or inline `eval`). All styling is constrained to approved CSS tokens.
2. **Tenant Scoping:** All rendered notices, gallery photos, and teacher directories are filtered strictly by `tenant_id`. Cross-tenant data leakage is cryptographically prevented.
3. **Public Admission Form Rate Limiting:** Public student inquiry submissions are protected by IP rate-limiting (max 10 submissions per IP per hour) and honeypot bot detection.

