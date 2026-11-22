// frontend/lib/institution.tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchWithTenant } from "./api-client";

export const AUTH_CHANGED = "auth-changed";
const cacheKey = (tid: string) => `institution:${tid}`;

export interface Institution {
  tenant_id: string; name: string; address?: string | null; phone?: string | null;
  email?: string | null; school_code?: string | null; academic_year?: string | null; logo_url?: string | null;
}
interface Ctx { institution: Institution | null; name: string; phone: string; address: string; loading: boolean; refresh: () => Promise<void> }

const InstitutionContext = createContext<Ctx>({ institution: null, name: "", phone: "", address: "", loading: true, refresh: async () => {} });
export const useInstitution = () => useContext(InstitutionContext);

export function clearInstitutionCache() {
  Object.keys(localStorage).filter((k) => k.startsWith("institution:")).forEach((k) => localStorage.removeItem(k));
}

export function InstitutionProvider({ children }: { children: ReactNode }) {
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = localStorage.getItem("access_token") || localStorage.getItem("token");
    const tenantId = localStorage.getItem("tenant_id");
    if (!token || !tenantId) { setInstitution(null); setLoading(false); return; }

    try {                                    // ei tenant er nijer cache theke instant paint
      const cached = localStorage.getItem(cacheKey(tenantId));
      setInstitution(cached ? (JSON.parse(cached) as Institution) : null);
    } catch { setInstitution(null); }

    try {
      const res = await fetchWithTenant("/api/v1/institution/profile");
      if (res.ok) {
        const data: Institution = await res.json();
        if (localStorage.getItem("tenant_id") === tenantId) {   // majhkhane school change hole dheri response phele dao
          setInstitution(data);
          localStorage.setItem(cacheKey(tenantId), JSON.stringify(data));
        }
      }
    } catch { /* cached value i thakuk */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const onAuth = () => { setLoading(true); void load(); };
    window.addEventListener(AUTH_CHANGED, onAuth);
    window.addEventListener("storage", onAuth);       // onno tab e login/logout hole
    return () => { window.removeEventListener(AUTH_CHANGED, onAuth); window.removeEventListener("storage", onAuth); };
  }, [load]);

  const value = useMemo<Ctx>(() => ({ institution, name: institution?.name ?? "", phone: institution?.phone ?? "", address: institution?.address ?? "", loading, refresh: load }), [institution, loading, load]);
  return <InstitutionContext.Provider value={value}>{children}</InstitutionContext.Provider>;
}