// frontend/app/verify-email/page.tsx
"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail, CheckCircle2, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { fetchWithTenant } from "@/lib/api-client";

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token") || "";

  const [otpCode, setOtpCode] = useState("");
  const [token, setToken] = useState(tokenFromUrl);
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRequestOtp = async () => {
    setRequesting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetchWithTenant("/api/v1/auth/email-verification/request", {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to dispatch verification code.");
      }
      setMessage("A 6-digit verification code has been dispatched to your email.");
    } catch (err: any) {
      setError(err.message || "Failed to request code.");
    } finally {
      setRequesting(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload: Record<string, string> = {};
      if (otpCode.trim()) payload.otp_code = otpCode.trim();
      if (token.trim()) payload.token = token.trim();

      const res = await fetchWithTenant("/api/v1/auth/email-verification/verify", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Verification failed. Code may be expired or incorrect.");
      }

      setVerified(true);
    } catch (err: any) {
      setError(err.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white dark:bg-[#121216] border border-gray-200 dark:border-white/10 rounded-3xl p-8 shadow-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-emerald-600/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
          <Mail size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold">Email Verification</h1>
          <p className="text-xs text-gray-500">Account Security</p>
        </div>
      </div>

      {verified ? (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-200 text-sm flex items-start gap-3">
            <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-600" />
            <div>
              <p className="font-semibold">Email Confirmed</p>
              <p className="text-xs mt-1 text-emerald-700 dark:text-emerald-300">
                Your email address has been verified successfully.
              </p>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-md"
          >
            Go to Dashboard <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <form onSubmit={handleVerify} className="space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Enter the 6-digit confirmation code sent to your registered email address.
          </p>

          {message && (
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs flex items-center gap-2">
              <CheckCircle2 size={14} />
              <span>{message}</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">6-Digit Code</label>
            <input
              type="text"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="w-full text-center tracking-[0.5em] font-mono text-lg py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading || otpCode.length < 6}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : "Confirm Code"}
          </button>

          <div className="pt-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-between text-xs text-gray-500">
            <span>Didn&apos;t get a code?</span>
            <button
              type="button"
              onClick={handleRequestOtp}
              disabled={requesting}
              className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline disabled:opacity-50"
            >
              {requesting ? "Sending..." : "Resend Code"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-[#0a0a0c] text-gray-900 dark:text-gray-100 font-sans">
      <Suspense fallback={<div className="text-xs text-gray-500">Loading verification session...</div>}>
        <VerifyEmailForm />
      </Suspense>
    </div>
  );
}

