"use client";

import { useState, useEffect, Suspense, FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  School,
  Lock,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Loader2,
  ShieldCheck,
  Eye,
  EyeOff,
} from "lucide-react";
import { fetchWithTenant } from "@/lib/api-client";
import { useLanguage } from "@/components/providers";

function ActivationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useLanguage();

  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    role: string;
    username: string;
    message: string;
  } | null>(null);

  const [invitationInfo, setInvitationInfo] = useState<{
    targetRole?: string;
    identifier?: string;
  } | null>(null);

  useEffect(() => {
    const urlToken = searchParams.get("token");
    if (urlToken) {
      const clean = urlToken.trim();
      setToken(clean);
      fetchWithTenant(`/api/v1/auth/invitation-status?token=${encodeURIComponent(clean)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.valid) {
            setInvitationInfo({
              targetRole: data.target_role,
              identifier: data.identifier,
            });
          }
        })
        .catch(() => {});
    }
  }, [searchParams]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanToken = token.trim();
    if (!cleanToken) {
      setErrorMsg("Please enter your activation invitation token.");
      return;
    }

    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match. Please re-enter.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetchWithTenant("/api/v1/auth/activate", {
        method: "POST",
        body: JSON.stringify({
          token: cleanToken,
          password: password,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const detail = data?.detail;
        if (typeof detail === "string") {
          throw new Error(detail);
        } else if (Array.isArray(detail)) {
          throw new Error(detail.map((err: any) => err.msg).join(", "));
        }
        throw new Error(`Activation failed (HTTP ${res.status}).`);
      }

      setSuccessData({
        role: data.role || "user",
        username: data.username || "Account",
        message: data.message || "Account activated successfully.",
      });
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during account activation."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="fixed top-[-20%] left-[-10%] w-[500px] h-[500px] bg-emerald-600/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-md w-full bg-white dark:bg-[#111] border border-gray-100 dark:border-white/10 rounded-3xl p-8 shadow-xl relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 mb-2 group">
            <div className="w-8 h-8 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30 group-hover:scale-105 transition-transform">
              <School size={20} />
            </div>
            <span className="font-bold text-lg text-gray-900 dark:text-white">
              EducationOS
            </span>
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
            {language === "EN" ? "Account Activation" : "অ্যাকাউন্ট অ্যাক্টিভেশন"}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {language === "EN"
              ? "Establish your secure permanent password using your school invitation link."
              : "স্কুল থেকে প্রাপ্ত অ্যাক্টিভেশন লিংকের মাধ্যমে আপনার স্থায়ী পাসওয়ার্ড সেট করুন।"}
          </p>
        </div>

        {/* Success View */}
        {successData ? (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl text-center space-y-2">
              <div className="w-10 h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 size={24} />
              </div>
              <h2 className="text-sm font-bold text-emerald-900 dark:text-emerald-300">
                {language === "EN"
                  ? "Account Successfully Activated!"
                  : "অ্যাকাউন্ট সফলভাবে সক্রিয় করা হয়েছে!"}
              </h2>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                {successData.message}
              </p>
              <div className="pt-2 text-[11px] font-mono text-emerald-800 dark:text-emerald-300">
                Identifier: <strong>{successData.username}</strong>
              </div>
            </div>

            <Link
              href={`/login?tab=${successData.role === "student" ? "student" : successData.role === "guardian" ? "guardian" : "staff"}`}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <span>
                {language === "EN"
                  ? "Proceed to Sign In"
                  : "লগইন পেজে এগিয়ে যান"}
              </span>
              <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          /* Activation Form */
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {invitationInfo && (
              <div className="p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl text-blue-800 dark:text-blue-300 text-xs flex items-center justify-between">
                <div>
                  <span className="font-semibold capitalize">{invitationInfo.targetRole} Portal:</span>{" "}
                  <strong className="font-mono">{invitationInfo.identifier}</strong>
                </div>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-blue-200/50 dark:bg-blue-500/20 rounded font-semibold">
                  Valid Token
                </span>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Token Field */}
            <div>
              <label
                htmlFor="activation-token"
                className="font-semibold text-gray-700 dark:text-gray-400 block mb-1"
              >
                {language === "EN"
                  ? "Invitation / Activation Token"
                  : "অ্যাক্টিভেশন টোকেন"}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400">
                  <KeyRound size={16} />
                </span>
                <input
                  id="activation-token"
                  type="text"
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste or enter activation token"
                  className="w-full pl-9 pr-3 py-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            {/* New Password */}
            <div>
              <label
                htmlFor="new-password"
                className="font-semibold text-gray-700 dark:text-gray-400 block mb-1"
              >
                {language === "EN" ? "New Permanent Password" : "নতুন স্থায়ী পাসওয়ার্ড"}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400">
                  <Lock size={16} />
                </span>
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full pl-9 pr-10 py-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-400"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirm-password"
                className="font-semibold text-gray-700 dark:text-gray-400 block mb-1"
              >
                {language === "EN"
                  ? "Confirm Permanent Password"
                  : "পাসওয়ার্ড নিশ্চিত করুন"}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400">
                  <Lock size={16} />
                </span>
                <input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  maxLength={128}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type password"
                  className="w-full pl-9 pr-10 py-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Security Guarantee Note */}
            <div className="p-3 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-xl text-[11px] text-gray-500 flex items-start gap-2">
              <ShieldCheck size={16} className="text-emerald-500 shrink-0 mt-0.5" />
              <span>
                {language === "EN"
                  ? "Single-use cryptographic token. Your password will be salted and hashed with Argon2id/Bcrypt. School administrators cannot view your password."
                  : "একক-ব্যবহারযোগ্য টোকেন। আপনার পাসওয়ার্ড নিরাপদে এনক্রিপ্ট হবে। স্কুল অ্যাডমিন বা শিক্ষকরা আপনার পাসওয়ার্ড দেখতে পারবেন না।"}
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full text-white py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ShieldCheck size={16} />
              )}
              <span>
                {language === "EN"
                  ? "Activate Account & Save Password"
                  : "অ্যাকাউন্ট সক্রিয় করুন ও পাসওয়ার্ড সংরক্ষণ করুন"}
              </span>
            </button>

            {/* Back to Login Link */}
            <div className="pt-3 text-center">
              <Link
                href="/login"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                <span>
                  {language === "EN"
                    ? "Already activated? Sign In"
                    : "ইতিমধ্যে সক্রিয়? লগইন করুন"}
                </span>
                <ArrowRight size={12} />
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function AccountActivationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center p-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Loader2 size={16} className="animate-spin text-blue-600" />
            <span>Loading activation page...</span>
          </div>
        </div>
      }
    >
      <ActivationForm />
    </Suspense>
  );
}

