"use client";

import { useEffect, useState, Suspense } from "react";
import type { FormEvent, InputHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  School, GraduationCap, BookOpen, Users, ShieldAlert, Loader2, ArrowRight,
  Lock, Mail, Phone, Hash, Building2, KeyRound,
} from "lucide-react";
import { useLanguage } from "@/components/providers";
import ThemeToggle from "@/components/ThemeToggle";
import { fetchWithTenant } from "@/lib/api-client";

type Tab = "staff" | "student" | "guardian";

const SESSION_KEYS = [
  "token",
  "access_token",
  "refresh_token",
  "user_role",
  "user_name",
  "tenant_id",
  "student_id",
  "active_workspace_id",
  "school_name",
  "institution_name",
  "school_code"
];

const ALLOWED_ROLES: Record<Tab, string[]> = {
  staff: ["admin", "teacher", "superadmin"],
  student: ["student"],
  guardian: ["guardian"],
};

const TABS: { id: Tab; label: string; icon: ReactNode; on: string }[] = [
  { id: "staff", label: "Staff", icon: <GraduationCap size={14} />, on: "text-blue-600" },
  { id: "student", label: "Student", icon: <BookOpen size={14} />, on: "text-purple-600" },
  { id: "guardian", label: "Parent", icon: <Users size={14} />, on: "text-green-600" },
];

function formatApiError(body: any): string | null {
  const d = body?.detail;
  if (!d) return null;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    return d.map((e: any) => {
      const field = Array.isArray(e?.loc) ? e.loc.filter((p: any) => p !== "body").join(".") : "";
      return field ? `${field}: ${e?.msg}` : String(e?.msg ?? "Invalid request");
    }).join(" • ");
  }
  return null;
}

/**
 * Validates and sanitizes return_to / next parameter to prevent open-redirect attacks.
 * Only allows relative paths starting with a single '/' and rejects protocols or double slashes.
 */
function getSafeReturnUrl(param: string | null, defaultRoute: string): string {
  if (!param) return defaultRoute;
  const trimmed = param.trim();
  if (
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.startsWith("/\\") &&
    !trimmed.includes(":") &&
    !trimmed.includes("javascript:")
  ) {
    return trimmed;
  }
  return defaultRoute;
}

async function postAuth(path: string, body: Record<string, unknown>): Promise<any> {
  let res: Response;
  try {
    res = await fetchWithTenant(`/api/v1/auth/${path}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Cannot reach the server. Check your connection and try again.");
  }
  let data: any = null;
  try { data = await res.json(); } catch { /* non-JSON error page */ }

  if (res.status === 429) {
    const wait = parseInt(res.headers.get("Retry-After") || "", 10);
    throw new Error(wait ? `Too many attempts. Try again in ${Math.ceil(wait / 60)} min.` : "Too many attempts. Please wait a few minutes.");
  }
  if (!res.ok) throw new Error(formatApiError(data) || `Request failed (${res.status})`);
  return data;
}

function persistSession(data: any, role: string) {
  SESSION_KEYS.forEach((k) => localStorage.removeItem(k));
  localStorage.setItem("token", data.access_token);
  localStorage.setItem("access_token", data.access_token);
  if (data.refresh_token) {
    localStorage.setItem("refresh_token", data.refresh_token);
  }
  localStorage.setItem("user_role", role);
  localStorage.setItem("user_name", data.name ?? "");
  localStorage.setItem("tenant_id", String(data.tenant_id ?? ""));
  if (data.student_id) localStorage.setItem("student_id", String(data.student_id));
  if (data.active_workspace_id) localStorage.setItem("active_workspace_id", String(data.active_workspace_id));
  window.dispatchEvent(new Event("auth-changed"));
}

function Field({ id, label, icon, ...rest }: { id: string; label: string; icon?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="font-semibold text-gray-700 dark:text-gray-400">{label}</label>
      <div className="relative mt-1">
        {icon && <span className="absolute left-3 top-2.5 text-gray-400">{icon}</span>}
        <input
          id={id}
          {...rest}
          className={`w-full ${icon ? "pl-9" : "pl-3"} pr-3 py-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-blue-500`}
        />
      </div>
    </div>
  );
}

function SubmitBtn({ loading, cls, icon, children }: { loading: boolean; cls: string; icon: ReactNode; children: ReactNode }) {
  return (
    <button type="submit" disabled={loading}
      className={`w-full text-white py-2.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 ${cls}`}>
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

function UnifiedAuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, toggleLanguage } = useLanguage();

  const [activeTab, setActiveTab] = useState<Tab>("staff");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const initialSchoolCode = searchParams.get("school_code") || searchParams.get("code") || "";
  const [schoolCode, setSchoolCode] = useState(initialSchoolCode);

  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [studentAdmission, setStudentAdmission] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [guardianIdentifier, setGuardianIdentifier] = useState("");
  const [guardianPassword, setGuardianPassword] = useState("");

  const returnTo = searchParams.get("return_to") || searchParams.get("next");

  // Check if user is already authenticated -> redirect immediately to appropriate dashboard or return_to
  useEffect(() => {
    const token = localStorage.getItem("access_token") || localStorage.getItem("token");
    const role = (localStorage.getItem("user_role") || "").toLowerCase();
    if (token) {
      const defaultDest = role === "student" ? "/dashboard/students" : role === "guardian" ? "/dashboard/guardians" : "/dashboard";
      router.replace(getSafeReturnUrl(returnTo, defaultDest));
    }
  }, [router, returnTo]);

  // School code is only populated if provided via explicit invitation URL search params
  useEffect(() => {
    if (initialSchoolCode) {
      setSchoolCode(initialSchoolCode);
    }
  }, [initialSchoolCode]);

  const scope = () => (schoolCode.trim() ? { school_code: schoolCode.trim() } : {});

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    setErrorMsg(null);
    setStaffPassword("");
    setStudentPassword("");
    setGuardianPassword("");
  }

  async function submit(tab: Tab, path: string, body: Record<string, unknown>) {
    if (loading) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await postAuth(path, body);
      const role = String(data?.role ?? "").toLowerCase();
      if (!data?.access_token || !ALLOWED_ROLES[tab].includes(role)) {
        throw new Error(role ? `This account (${role}) cannot sign in on this tab.` : "Unexpected response from the server.");
      }
      persistSession(data, role);
      
      const defaultDest =
        role === "superadmin"
          ? "/dashboard/platform"
          : role === "student"
          ? "/dashboard/students"
          : role === "guardian"
          ? "/dashboard/guardians"
          : "/dashboard";
      router.push(getSafeReturnUrl(returnTo, defaultDest));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const schoolCodeField = (
    <Field id="school-code" label="School code (optional)" icon={<KeyRound size={16} />}
      value={schoolCode} onChange={(e) => setSchoolCode(e.target.value)}
      placeholder="Only if your school gave you one" maxLength={64} autoComplete="off" />
  );

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="fixed top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-600/10 blur-[150px] rounded-full pointer-events-none" />

      {/* Top Utility Controls: Theme & Language */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <ThemeToggle />
        <button
          type="button"
          onClick={toggleLanguage}
          className="px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-semibold bg-white dark:bg-black/40 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-sm"
          title="Toggle Language"
        >
          {language === "EN" ? "বাংলা" : "English"}
        </button>
      </div>

      <div className="max-w-md w-full bg-white dark:bg-[#111] border border-gray-100 dark:border-white/10 rounded-3xl p-8 shadow-xl relative z-10 space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 mb-2 group">
            <div className="w-8 h-8 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30 group-hover:scale-105 transition-transform">
              <School size={20} />
            </div>
            <span className="font-bold text-lg text-gray-900 dark:text-white">Education OS</span>
          </Link>
          {/* <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
            {language === "EN" ? "Welcome Back" : "স্বাগতম"}
          </h1> */}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {language === "EN" ? "Sign in to access your institutional workspace" : "আপনার প্রাতিষ্ঠানিক পোর্টালে প্রবেশ করুন"}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-3 p-1 bg-gray-100 dark:bg-white/5 rounded-2xl text-xs font-semibold">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => switchTab(t.id)}
              className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                activeTab === t.id
                  ? "bg-white dark:bg-black/80 shadow-sm text-gray-900 dark:text-white"
                  : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Error Callout */}
        {errorMsg && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
            <ShieldAlert size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Staff Login Form */}
        {activeTab === "staff" && (
          <form className="space-y-4 text-xs"
            onSubmit={(e: FormEvent) => { e.preventDefault(); void submit("staff", "staff", { email: staffEmail.trim(), password: staffPassword, ...scope() }); }}>
            <Field id="staff-email" label="Official Email / ID" icon={<Mail size={16} />} type="email" required
              autoComplete="username" maxLength={254} value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)}
              placeholder="admin@school.edu.bd or teacher@school.edu.bd" />
            <Field id="staff-password" label="Password" icon={<Lock size={16} />} type="password" required
              autoComplete="current-password" maxLength={128} value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)}
              placeholder="••••••••" />
            {schoolCodeField}
            <SubmitBtn loading={loading} cls="bg-blue-600 hover:bg-blue-700" icon={<ArrowRight size={16} />}>
              Sign In as Staff
            </SubmitBtn>
          </form>
        )}

        {/* Student Login Form */}
        {activeTab === "student" && (
          <form className="space-y-4 text-xs"
            onSubmit={(e: FormEvent) => { e.preventDefault(); void submit("student", "student", { admission_number: studentAdmission.trim(), password: studentPassword, ...scope() }); }}>
            <Field id="student-admission" label="Student Admission ID" icon={<Hash size={16} />} required autoComplete="username"
              maxLength={32} value={studentAdmission} onChange={(e) => setStudentAdmission(e.target.value)} placeholder="e.g. KS-2026-001" />
            <Field id="student-password" label="Student Password" icon={<Lock size={16} />} type="password" required
              autoComplete="current-password" maxLength={128} value={studentPassword} onChange={(e) => setStudentPassword(e.target.value)}
              placeholder="••••••••" />
            {schoolCodeField}
            <SubmitBtn loading={loading} cls="bg-purple-600 hover:bg-purple-700" icon={<ArrowRight size={16} />}>
              Enter Student Workspace
            </SubmitBtn>
            <div className="pt-2 text-center">
              <Link href="/activate" className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline">
                {language === "EN" ? "First time here? Activate your student account →" : "প্রথমবার আসছেন? আপনার স্টুডেন্ট অ্যাকাউন্ট সক্রিয় করুন →"}
              </Link>
            </div>
          </form>
        )}

        {/* Guardian Login Form */}
        {activeTab === "guardian" && (
          <form className="space-y-4 text-xs"
            onSubmit={(e: FormEvent) => { e.preventDefault(); void submit("guardian", "guardian/login", { identifier: guardianIdentifier.trim(), password: guardianPassword, ...scope() }); }}>
            <Field id="guardian-identifier" label={language === "EN" ? "Registered Mobile Number or Email" : "নিবন্ধিত মোবাইল নম্বর বা ইমেইল"} icon={<Phone size={16} />} required
              autoComplete="username" maxLength={128} value={guardianIdentifier} onChange={(e) => setGuardianIdentifier(e.target.value)} placeholder="e.g. 017XXXXXXXX or parent@gmail.com" />
            <Field id="guardian-password" label={language === "EN" ? "Guardian Password" : "অভিভাবক পাসওয়ার্ড"} icon={<Lock size={16} />} type="password" required
              autoComplete="current-password" maxLength={128} value={guardianPassword} onChange={(e) => setGuardianPassword(e.target.value)}
              placeholder="••••••••" />
            {schoolCodeField}
            <SubmitBtn loading={loading} cls="bg-green-600 hover:bg-green-700" icon={<ArrowRight size={16} />}>
              Access Child's Portal
            </SubmitBtn>
            <div className="pt-2 text-center">
              <Link href="/activate" className="text-[11px] text-green-600 dark:text-green-400 hover:underline">
                {language === "EN" ? "Received an invitation token? Activate your account →" : "অ্যাক্টিভেশন টোকেন পেয়েছেন? অ্যাকাউন্ট সক্রিয় করুন →"}
              </Link>
            </div>
          </form>
        )}

        {/* Canonical Link to Onboarding (No Duplicate Form) */}
        <div className="mt-6 pt-5 border-t border-gray-100 dark:border-white/10 text-center space-y-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {language === "EN" 
              ? "Registering a new school, college, or academy?" 
              : "নতুন কোনো স্কুল, কলেজ অথবা একাডেমি যুক্ত করতে চান?"}
          </p>
          <Link
            href="/onboard"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-indigo-400 hover:underline"
          >
            <Building2 size={14} />
            <span>
              {language === "EN" 
                ? "Start Institutional Onboarding & Free Trial →" 
                : "প্রাতিষ্ঠানিক অনবোর্ডিং শুরু করুন →"}
            </span>
          </Link>
        </div>

        <div className="pt-2 text-[11px] text-gray-400 text-center">
          <span>Protected by cryptographically isolated tenant boundaries.</span>
        </div>
      </div>
    </div>
  );
}

export default function UnifiedAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center p-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Loader2 size={16} className="animate-spin text-blue-600" />
            <span>Loading authentication portal...</span>
          </div>
        </div>
      }
    >
      <UnifiedAuthForm />
    </Suspense>
  );
}
