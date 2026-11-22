// frontend/app/verify-otp/page.tsx
"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ShieldCheck, CheckCircle2, AlertCircle, Loader2, ArrowRight, KeyRound } from "lucide-react";
import { fetchWithTenant } from "@/lib/api-client";

function VerifyOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const destination = searchParams.get("redirect") || "/dashboard";

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
      const res = await fetch(`${apiBase}/api/v1/auth/mfa/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mfa_token: token.trim(),
          code: code.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Invalid code. Please try again.");
      }

      const authData = await res.json();
      if (typeof window !== "undefined") {
        if (authData.access_token) {
          localStorage.setItem("access_token", authData.access_token);
          localStorage.setItem("token", authData.access_token);
        }
        if (authData.refresh_token) {
          localStorage.setItem("refresh_token", authData.refresh_token);
        }
        if (authData.role) {
          localStorage.setItem("user_role", authData.role);
        }
        if (authData.tenant_id) {
          localStorage.setItem("tenant_id", authData.tenant_id);
        }
        window.dispatchEvent(new Event("auth-changed"));
      }

      router.push(destination);
    } catch (err: any) {
      setError(err.message || "MFA validation failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white dark:bg-[#121216] border border-gray-200 dark:border-white/10 rounded-3xl p-8 shadow-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
          <KeyRound size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold">Two-Factor Authentication</h1>
          <p className="text-xs text-gray-500">Identity Verification</p>
        </div>
      </div>

      <form onSubmit={handleVerify} className="space-y-4">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Enter the 6-digit code from your authenticator app or an unused emergency recovery code.
        </p>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Authentication Code</label>
          <input
            type="text"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.trim())}
            placeholder="6-digit code or XXXX-XXXX"
            className="w-full text-center tracking-widest font-mono text-lg py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : "Verify & Sign In"}
        </button>

        <div className="pt-4 border-t border-gray-100 dark:border-white/5 flex justify-center">
          <Link
            href="/login"
            className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Cancel and return to <span className="text-blue-600 dark:text-blue-400 font-semibold">Sign In</span>
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-[#0a0a0c] text-gray-900 dark:text-gray-100 font-sans">
      <Suspense fallback={<div className="text-xs text-gray-500">Loading authentication session...</div>}>
        <VerifyOtpForm />
      </Suspense>
    </div>
  );
}

