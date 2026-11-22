"use client";

import { useEffect, useState, Suspense } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  Lock,
  Mail,
  KeyRound,
  Fingerprint,
  Loader2,
  ArrowRight,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Copy,
  ArrowLeft,
} from "lucide-react";
import { fetchWithTenant, clearSession } from "@/lib/api-client";
import ThemeToggle from "@/components/ThemeToggle";

type AuthStep = "CREDENTIALS" | "MFA_CHALLENGE" | "RECOVERY_CODE";

function formatError(body: any): string {
  const d = body?.detail;
  if (!d) return "Authentication failed. Please verify your credentials.";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    return d.map((e: any) => e?.msg || JSON.stringify(e)).join(" • ");
  }
  return String(d);
}

function PlatformLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<AuthStep>("CREDENTIALS");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);

  // If already logged in as superadmin, redirect to platform console
  useEffect(() => {
    const token = localStorage.getItem("access_token") || localStorage.getItem("token");
    const role = (localStorage.getItem("user_role") || "").toLowerCase();
    if (token && role === "superadmin") {
      router.replace("/dashboard/platform");
    }
  }, [router]);

  function persistPlatformSession(data: any) {
    clearSession();
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("access_token", data.access_token);
    if (data.refresh_token) {
      localStorage.setItem("refresh_token", data.refresh_token);
    }
    localStorage.setItem("user_role", "superadmin");
    localStorage.setItem("user_name", data.name || "Platform Owner");
    localStorage.setItem("tenant_id", String(data.tenant_id || "c0000000-0000-0000-0000-000000000001"));
    if (data.user?.id) {
      localStorage.setItem("user_id", String(data.user.id));
    }
    window.dispatchEvent(new Event("auth-changed"));
  }

  // 1. Initial Email + Password submission
  async function handleCredentialsSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetchWithTenant("/api/v1/auth/platform/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(formatError(data));
      }

      // Check if MFA challenge is required
      if (data?.mfa_required && data?.mfa_token) {
        setMfaToken(data.mfa_token);
        setStep("MFA_CHALLENGE");
        setLoading(false);
        return;
      }

      // Direct login if MFA is not enabled (failsafe)
      if (data?.access_token) {
        persistPlatformSession(data);
        router.push("/dashboard/platform");
        return;
      }

      throw new Error("Invalid response received from authentication service.");
    } catch (err: any) {
      setErrorMsg(err?.message || "Authentication failed.");
      setLoading(false);
    }
  }

  // 2. TOTP Code Verification
  async function handleMfaSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading || !totpCode.trim()) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetchWithTenant("/api/v1/auth/mfa/verify", {
        method: "POST",
        body: JSON.stringify({ mfa_token: mfaToken, code: totpCode.trim() }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(formatError(data) || "Invalid 6-digit verification code.");
      }

      if (data?.access_token) {
        persistPlatformSession(data);
        router.push("/dashboard/platform");
        return;
      }

      throw new Error("Authentication response was missing authorization token.");
    } catch (err: any) {
      setErrorMsg(err?.message || "Invalid verification code.");
      setLoading(false);
    }
  }

  // 3. Recovery Code Verification
  async function handleRecoverySubmit(e: FormEvent) {
    e.preventDefault();
    if (loading || !recoveryCode.trim()) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetchWithTenant("/api/v1/auth/mfa/verify", {
        method: "POST",
        body: JSON.stringify({ mfa_token: mfaToken, code: recoveryCode.trim() }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(formatError(data) || "Invalid emergency recovery code.");
      }

      if (data?.access_token) {
        persistPlatformSession(data);
        router.push("/dashboard/platform");
        return;
      }

      throw new Error("Authentication response was missing authorization token.");
    } catch (err: any) {
      setErrorMsg(err?.message || "Invalid or previously used recovery code.");
      setLoading(false);
    }
  }

  // 4. WebAuthn Passkey Login
  async function handlePasskeyLogin() {
    if (passkeyLoading) return;
    if (!email.trim()) {
      setErrorMsg("Please enter your Platform Owner email address before using Passkey.");
      return;
    }

    if (typeof window === "undefined" || !window.PublicKeyCredential) {
      setErrorMsg("WebAuthn Passkeys are not supported by this browser.");
      return;
    }

    setPasskeyLoading(true);
    setErrorMsg(null);

    try {
      const challengeRes = await fetchWithTenant("/api/v1/auth/passkey/login-challenge", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const challengeData = await challengeRes.json().catch(() => null);
      if (!challengeRes.ok) {
        throw new Error(formatError(challengeData) || "Failed to initiate passkey challenge.");
      }

      // Convert server challenge string to BufferSource
      const challengeBytes = Uint8Array.from(atob(challengeData.challenge.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
      const allowCredentials = (challengeData.allowCredentials || []).map((c: any) => ({
        id: Uint8Array.from(atob(c.id.replace(/-/g, "+").replace(/_/g, "/")), (ch) => ch.charCodeAt(0)),
        type: c.type || "public-key",
      }));

      const assertion = (await navigator.credentials.get({
        publicKey: {
          challenge: challengeBytes,
          rpId: window.location.hostname === "localhost" ? "localhost" : window.location.hostname,
          userVerification: "preferred",
          allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
          timeout: 60000,
        },
      })) as PublicKeyCredential;

      if (!assertion) {
        throw new Error("Passkey authentication was cancelled.");
      }

      const rawIdBase64 = btoa(String.fromCharCode(...new Uint8Array(assertion.rawId)));
      const verifyRes = await fetchWithTenant("/api/v1/auth/passkey/login-verify", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          credential_id: rawIdBase64,
        }),
      });

      const verifyData = await verifyRes.json().catch(() => null);
      if (!verifyRes.ok) {
        throw new Error(formatError(verifyData) || "Passkey signature verification failed.");
      }

      if (verifyData?.access_token) {
        persistPlatformSession(verifyData);
        router.push("/dashboard/platform");
        return;
      }

      throw new Error("Authentication response was missing token.");
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setErrorMsg("Passkey prompt was cancelled or timed out.");
      } else {
        setErrorMsg(err?.message || "Passkey login failed.");
      }
    } finally {
      setPasskeyLoading(false);
    }
  }

  function copyCliCommand() {
    navigator.clipboard.writeText("python -m app.cli.bootstrap_platform_owner --email " + (email || "owner@educationos.internal") + " --rotate-credentials");
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 3000);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Top Utility Controls */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <Link
          href="/login"
          className="px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-300 hover:text-white hover:bg-slate-900 transition-colors"
        >
          Institutional Login
        </Link>
        <ThemeToggle />
      </div>

      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Container */}
      <div className="w-full max-w-md text-center mb-8 relative z-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-4 shadow-inner">
          <ShieldCheck size={28} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Platform Control Plane</h1>
        <p className="text-sm text-slate-400 mt-1">EducationOS Root Owner & Infrastructure Authentication</p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl relative z-10">
        {errorMsg && (
          <div className="mb-6 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3 text-red-300 text-xs leading-relaxed animate-in fade-in duration-200">
            <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: CREDENTIALS */}
        {step === "CREDENTIALS" && (
          <form onSubmit={handleCredentialsSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Owner Email Address
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-slate-500">
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="platform.admin@educationos.internal"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-slate-500">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              Authenticate Platform Session
            </button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-900 px-2 text-slate-500">Or Hardware Key</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handlePasskeyLogin}
              disabled={passkeyLoading}
              className="w-full py-2.5 px-4 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-slate-200 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {passkeyLoading ? <Loader2 size={16} className="animate-spin" /> : <Fingerprint size={16} className="text-indigo-400" />}
              Sign in with Passkey / Security Key
            </button>
          </form>
        )}

        {/* STEP 2: TOTP MFA CHALLENGE */}
        {step === "MFA_CHALLENGE" && (
          <form onSubmit={handleMfaSubmit} className="space-y-5 animate-in fade-in duration-200">
            <div className="text-center pb-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 mb-2">
                <KeyRound size={24} />
              </div>
              <h2 className="text-lg font-semibold text-white">Two-Factor Challenge</h2>
              <p className="text-xs text-slate-400 mt-1">
                Enter the 6-digit verification code from your authenticator application.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 text-center">
                6-Digit Authenticator Code
              </label>
              <input
                type="text"
                autoFocus
                required
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                className="w-full py-3 bg-slate-950 border border-indigo-500/40 rounded-xl text-center text-2xl font-mono tracking-widest text-white placeholder-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
              />
            </div>

            <button
              type="submit"
              disabled={loading || totpCode.length !== 6}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Verify Code & Access Platform
            </button>

            <div className="flex flex-col gap-2 pt-2 text-center text-xs">
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setStep("RECOVERY_CODE");
                }}
                className="text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Lost access to authenticator? Use an emergency recovery code
              </button>
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setStep("CREDENTIALS");
                }}
                className="text-slate-500 hover:text-slate-400 flex items-center justify-center gap-1 transition-colors"
              >
                <ArrowLeft size={12} /> Back to email & password
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: RECOVERY CODE FALLBACK */}
        {step === "RECOVERY_CODE" && (
          <form onSubmit={handleRecoverySubmit} className="space-y-5 animate-in fade-in duration-200">
            <div className="text-center pb-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 mb-2">
                <ShieldCheck size={24} />
              </div>
              <h2 className="text-lg font-semibold text-white">Emergency Recovery Access</h2>
              <p className="text-xs text-slate-400 mt-1">
                Enter one of your 10 single-use recovery codes generated during platform bootstrap.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 text-center">
                Single-Use Recovery Code
              </label>
              <input
                type="text"
                autoFocus
                required
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX-XXXX"
                className="w-full py-3 bg-slate-950 border border-amber-500/40 rounded-xl text-center text-lg font-mono tracking-wider text-amber-200 placeholder-slate-700 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !recoveryCode.trim()}
              className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20 disabled:opacity-50 transition-all"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Authenticate via Recovery Code
            </button>

            <div className="flex flex-col gap-2 pt-2 text-center text-xs">
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setStep("MFA_CHALLENGE");
                }}
                className="text-slate-400 hover:text-slate-300 transition-colors"
              >
                Back to 6-digit Authenticator Code
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="w-full max-w-md flex justify-between items-center text-xs text-slate-500 mt-6 px-2">
        <Link href="/login" className="hover:text-slate-400 transition-colors flex items-center gap-1">
          <ArrowLeft size={12} /> School Staff Login
        </Link>
        <span>EducationOS v2.4 Platform Control</span>
      </div>

      {/* FORGOT PASSWORD MODAL */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
                <HelpCircle size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Platform Owner Credential Recovery</h3>
                <p className="text-xs text-slate-400">Zero-Trust Operational Security Policy</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Platform Super Admin accounts are deliberately isolated from public self-service email resets to protect multi-tenant infrastructure against account takeover.
            </p>

            {/* 
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 mb-4">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Administrative CLI Rotation Command</span>
                <button
                  type="button"
                  onClick={copyCliCommand}
                  className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors normal-case"
                >
                  <Copy size={12} />
                  {copiedCli ? "Copied" : "Copy command"}
                </button>
              </div>
              
              <code className="text-xs text-emerald-400 font-mono block break-all">
                python -m app.cli.bootstrap_platform_owner --email {email || "owner@educationos.internal"} --rotate-credentials
              </code>
            </div>
            */}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-all"
              >
                Close Guidance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlatformLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500 text-sm">Loading Platform Console...</div>}>
      <PlatformLoginForm />
    </Suspense>
  );
}

