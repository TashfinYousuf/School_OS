// frontend/app/forgot-password/page.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Mail, ArrowRight, CheckCircle2, AlertCircle, Loader2, KeyRound } from "lucide-react";
import { useInstitution } from "@/lib/institution";

export default function ForgotPasswordPage() {
  const { name: institutionName } = useInstitution();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
      const res = await fetch(`${apiBase}/api/v1/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Unable to process password reset request.");
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-[#0a0a0c] text-gray-900 dark:text-gray-100 font-sans">
      <div className="w-full max-w-md bg-white dark:bg-[#121216] border border-gray-200 dark:border-white/10 rounded-3xl p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <KeyRound size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold">Reset Password</h1>
            <p className="text-xs text-gray-500">{institutionName || "EducationOS"}</p>
          </div>
        </div>

        {submitted ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-200 text-sm flex items-start gap-3">
              <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-600" />
              <div>
                <p className="font-semibold">Instructions Dispatched</p>
                <p className="text-xs mt-1 text-emerald-700 dark:text-emerald-300">
                  If an account exists for <strong>{email}</strong>, password reset instructions have been sent. Please check your inbox and spam folder.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 dark:border-white/5 flex justify-center">
              <Link
                href="/login"
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5"
              >
                Return to Sign In <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Enter your registered email address. We will dispatch a single-use verification link to reset your account password.
            </p>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@school.edu.bd"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Send Reset Link"}
            </button>

            <div className="pt-4 border-t border-gray-100 dark:border-white/5 flex justify-center">
              <Link
                href="/login"
                className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Remembered your password? <span className="text-blue-600 dark:text-blue-400 font-semibold">Sign In</span>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

