# EducationOS — Domain & DNS Architecture Configuration
**Document ID:** `docs/DOMAIN_AND_DNS_SETUP.md`  
**Generated:** 2026-11-11  
**Author:** Principal Infrastructure Engineer  
**Scope:** Stage 7 DNS Records, Cloudflare Edge WAF, Wildcard Certificates, and Subdomain Mapping  

---

## 1. Authoritative Domain Mapping

EducationOS employs a hierarchical domain structure that isolates public marketing traffic from sensitive API endpoints and tenant institutional workspaces:

| Logical Role | Domain Record | DNS Record Type | Target Destination | Proxied via Cloudflare |
| :--- | :--- | :---: | :--- | :---: |
| **Main Public Website** | `educationos.com` | `A` | Ingress Load Balancer IP (`104.21.x.x`) | **YES** |
| **Root Web Redirect** | `www.educationos.com` | `CNAME` | `educationos.com` | **YES** |
| **Institutional Dashboard**| `app.educationos.com` | `CNAME` | Frontend Service Ingress | **YES** |
| **Core API Gateway** | `api.educationos.com` | `CNAME` | FastAPI Backend Cluster Ingress | **YES** |
| **Public Documentation** | `docs.educationos.com` | `CNAME` | Static Docs Ingress | **YES** |
| **Tenant Subdomains** | `*.educationos.app` | `CNAME` | Ingress Multi-Tenant Router | **YES** |
| **Customer Custom Domain** | `portal.<school.edu.bd>`| `CNAME` | `ingress.educationos.app` | **YES (SSL for SaaS)** |

---

## 2. Cloudflare Security & TLS Configuration

1. **SSL/TLS Encryption Mode:** **Full (Strict)**  
   Requires a valid SSL certificate on the origin Nginx server; prevents man-in-the-middle interception between Cloudflare and origin servers.
2. **Minimum TLS Version:** **TLS 1.3** (TLS 1.0, 1.1, and 1.2 disabled for high security).
3. **HTTP Strict Transport Security (HSTS):**
   - `max-age=31536000` (1 Year)
   - `includeSubDomains=true`
   - `preload=true`
4. **Edge Web Application Firewall (WAF) Rules:**
   - Block malicious SQL injection patterns and cross-site scripting in request URIs.
   - Geofence administrative routes `/admin/*` to approved IP ranges.
   - Rate limit `/api/v1/auth/*` to max 10 requests per minute per IP to defeat credential stuffing.

---

## 3. Custom Domain Onboarding DNS Template

When an institution adds their official school domain (`portal.kidsshine.edu.bd`), their network administrator must configure the following records with their domain registrar:

```text
; 1. Verification Challenge (Proves Domain Ownership)
_educationos-challenge.portal.kidsshine.edu.bd.  IN  TXT   "edos_verify_9f81a7b3c2d4e5f6"

; 2. Routing CNAME Record
portal.kidsshine.edu.bd.                        IN  CNAME ingress.educationos.app.
```

