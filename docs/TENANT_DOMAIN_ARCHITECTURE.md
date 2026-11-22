# EducationOS — Tenant Subdomain & Custom Domain Architecture
**Document ID:** `docs/TENANT_DOMAIN_ARCHITECTURE.md`  
**Generated:** 2026-11-11  
**Author:** Principal Infrastructure & Security Architect  
**Scope:** Stage 6 Multi-Tenant Domain Routing, Custom Domains, and Host Header Security  

---

## 1. Multi-Surface Domain Model

EducationOS strictly separates the public marketing platform from institutional workspaces and custom domains:

```
                                  [ Incoming Request ]
                                           │
                                           ▼
                            [ Nginx / Cloudflare Edge Router ]
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         ▼                                 ▼                                 ▼
[ Main Public Marketing ]        [ Tenant Subdomain ]              [ School Custom Domain ]
  educationos.com                  kidsshine.educationos.com         portal.kidsshine.edu.bd
  • Next.js Marketing Site         • School Workspace Portal         • Fully Branded School Portal
  • /onboard, /pricing, /about     • Scoped to Tenant ID             • Automatic TLS via Let's Encrypt
```

---

## 2. Tenant Subdomain Infrastructure

### 2.1 Subdomain Format:
`https://<school-slug>.educationos.app` (e.g. `kidsshine.educationos.app`)

### 2.2 Subdomain Invariants & Reserved Names Policy:
To prevent administrative hijacking and confusion, the following slugs are permanently reserved and rejected during onboarding:
`admin`, `api`, `app`, `auth`, `billing`, `cdn`, `dashboard`, `dev`, `docs`, `gateway`, `help`, `internal`, `mail`, `portal`, `root`, `secure`, `security`, `sre`, `staging`, `status`, `support`, `system`, `test`, `www`.

### 2.3 Safe Host Header Resolution:
**Never resolve tenant context solely from an untrusted client-supplied query parameter.**
The reverse proxy extracts the `Host` header, parses the subdomain slug, and verifies it against the `tenants` database table:
```python
# In TenantMiddleware / Router
host = request.headers.get("host", "").split(":")[0].lower()
if host.endswith(".educationos.app"):
    slug = host.replace(".educationos.app", "")
    tenant = db.query(Tenant).filter(Tenant.slug == slug, Tenant.is_active == True).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="School portal not found.")
    request.state.tenant_id = str(tenant.id)
```

---

## 3. Custom Domain Verification & TLS Provisioning Lifecycle

Schools wishing to utilize their official domain (e.g. `portal.school.edu.bd` or `www.school.edu.bd`) execute an automated 5-step verification challenge:

```
1. Admin enters custom domain in /dashboard/settings?tab=domain
         │
         ▼
2. Backend generates unique verification token:
   TXT Record: _educationos-challenge.<school-domain> -> edos_verify_9f81a7b3...
   CNAME Record: portal.<school-domain> -> ingress.educationos.app
         │
         ▼
3. School DNS administrator adds records with domain registrar
         │
         ▼
4. Backend verifies TXT challenge via DNS lookup (resolver.resolve)
         │
         ▼
5. Automated TLS certificate provisioned via Cloudflare SSL for SaaS / Caddy ACME
         │
         ▼
Domain Status: ACTIVE (Mapped to Tenant ID)
```

### 3.1 Domain Takeover Prevention:
- A custom domain cannot be bound to more than one tenant.
- If a tenant account is canceled or suspended, custom domain mappings are de-provisioned after 14 days to prevent stale domain hijacking.
- Inactive mappings are purged automatically.

