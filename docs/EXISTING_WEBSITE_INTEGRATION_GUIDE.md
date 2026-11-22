# EducationOS — Integration Guide for Institutions with Existing Websites
**Document ID:** `docs/EXISTING_WEBSITE_INTEGRATION_GUIDE.md`  
**Generated:** 2026-11-11  
**Author:** Principal Integration Architect & Application Security Engineer  
**Scope:** Stage 6 Integration Options for Established School Websites  

---

## 1. Overview & Architectural Principles

Established institutions often have existing marketing websites (e.g. built on WordPress, Joomla, or custom HTML/PHP) and do not wish to abandon their existing brand presence or SEO history.

EducationOS provides three secure, non-destructive integration patterns that seamlessly connect existing school websites to the EducationOS institutional portal without requiring complex database migrations.

---

## 2. Three Integration Patterns

### Option A: Dedicated Portal Subdomain (Recommended)
- **URL Structure:** `https://portal.kidsshine.edu.bd`
- **Setup:** School IT adds a single DNS CNAME record:
  ```text
  portal.kidsshine.edu.bd.  IN  CNAME  ingress.educationos.app.
  ```
- **Experience:** Visitors click **"Student / Teacher Portal"** on the school's existing website and seamlessly transition to the branded EducationOS dashboard.
- **TLS / SSL:** Managed automatically via Cloudflare for SaaS or Let's Encrypt.

### Option B: Hosted EducationOS Tenant Subdomain
- **URL Structure:** `https://kidsshine.educationos.app`
- **Setup:** Zero DNS configuration required by the school.
- **Experience:** The school places direct login action links on their main homepage:
  - *"Parent Portal"* -> `https://kidsshine.educationos.app/login?tab=guardian`
  - *"Teacher Workspace"* -> `https://kidsshine.educationos.app/login?tab=staff`
  - *"Check Exam Results"* -> `https://kidsshine.educationos.app/login?tab=student`

### Option C: Secure Lightweight Embed Widgets
For schools wishing to display live notices or admission forms directly within their existing WordPress or static pages:

```html
<!-- Secure Notice Widget Embed -->
<div id="educationos-notice-feed" 
     data-tenant-id="0192e10c-396a-7253-b248-..."
     data-max-items="5">
</div>
<script src="https://static.educationos.app/widgets/notices.v1.js" async defer></script>
```

---

## 3. Security, Content Security Policy (CSP) & Iframe Protection

### 3.1 Prohibited Legacy Practice:
**Insecure full-page iframe embedding is strictly prohibited.** Wrapping the entire EducationOS application inside an external site's iframe exposes session tokens to clickjacking, CSS overlay attacks, and broken mobile cookie handling.

### 3.2 Security Protections Enforced:
1. **X-Frame-Options:** Set to `SAMEORIGIN` by default on all dashboard routes.
2. **Content-Security-Policy (CSP):**
   ```http
   Content-Security-Policy: frame-ancestors 'self' https://*.kidsshine.edu.bd;
   ```
3. **CORS Whitelisting:** Widget API endpoints (`/api/v1/notices/public-feed`) only respond to pre-approved origin domains configured in `/dashboard/settings?tab=security`.
4. **Zero Client PII in Widgets:** Public embed feeds return only published public announcements. No student names, contact numbers, or financial receipts are ever exposed via unauthenticated embed scripts.

