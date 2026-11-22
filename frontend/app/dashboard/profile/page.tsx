"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Shield,
  Lock,
  Mail,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogOut,
  KeyRound,
  Eye,
  EyeOff
} from "lucide-react";
import { useLanguage } from "@/components/providers";
import { useInstitution } from "@/lib/institution";
import { fetchWithTenant, clearSession, performLogout } from "@/lib/api-client";

export default function UserProfilePage() {
  const router = useRouter();
  const { language } = useLanguage();
  const { name: liveSchoolName } = useInstitution();

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [profileFeedback, setProfileFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [userData, setUserData] = useState<{
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    tenant_id: string;
  }>({
    id: "",
    email: "",
    first_name: "",
    last_name: "",
    role: "admin",
    tenant_id: ""
  });

  const [institutionName, setInstitutionName] = useState<string>(liveSchoolName || "School Administration");
  const [schoolCode, setSchoolCode] = useState<string>("ACTIVE");

  // Password fields
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      try {
        const storedRole = localStorage.getItem("user_role") || "admin";
        const storedName = localStorage.getItem("user_name") || "User";
        const storedSchool = liveSchoolName || localStorage.getItem("school_name") || "School Administration";
        const storedCode = localStorage.getItem("school_code") || "ACTIVE";
        const storedTenant = localStorage.getItem("tenant_id") || "";

        setInstitutionName(storedSchool);
        setSchoolCode(storedCode);

        // Fetch user info from backend
        const res = await fetchWithTenant("/api/v1/users/me");
        if (res.ok) {
          const data = await res.json();
          setUserData({
            id: data.id,
            email: data.email || "",
            first_name: data.first_name || storedName.split(" ")[0] || "",
            last_name: data.last_name || storedName.split(" ").slice(1).join(" ") || "",
            role: data.role || storedRole,
            tenant_id: data.tenant_id || storedTenant
          });
        } else {
          // Fallback to /api/v1/auth/me for student/guardian roles before local storage
          const authMeRes = await fetchWithTenant("/api/v1/auth/me");
          if (authMeRes.ok) {
            const data = await authMeRes.json();
            setUserData({
              id: data.id,
              email: data.email || "",
              first_name: data.first_name || storedName.split(" ")[0] || "",
              last_name: data.last_name || storedName.split(" ").slice(1).join(" ") || "",
              role: data.role || storedRole,
              tenant_id: data.tenant_id || storedTenant,
            });
          } else {
            setUserData({
              id: storedTenant,
              email: localStorage.getItem("user_email") || "",
              first_name: storedName.split(" ")[0] || "User",
              last_name: storedName.split(" ").slice(1).join(" ") || "",
              role: storedRole,
              tenant_id: storedTenant
            });
          }
        }
      } catch {
        // Fallback
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileFeedback(null);

    try {
      const res = await fetchWithTenant("/api/v1/users/me", {
        method: "PATCH",
        body: JSON.stringify({
          first_name: userData.first_name.trim(),
          last_name: userData.last_name.trim()
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || "Failed to update profile.");
      }

      const updated = await res.json();
      const fullName = `${updated.first_name} ${updated.last_name}`.trim();
      localStorage.setItem("user_name", fullName);
      window.dispatchEvent(new Event("auth-changed"));

      setProfileFeedback({
        type: "success",
        text: language === "EN" ? "Profile updated successfully." : "প্রোফাইল সফলভাবে আপডেট হয়েছে।"
      });
    } catch (err: unknown) {
      setProfileFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Unable to update profile."
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);

    if (newPassword !== confirmPassword) {
      setPasswordFeedback({
        type: "error",
        text: language === "EN" ? "New passwords do not match." : "নতুন পাসওয়ার্ড দুটি মিলছে না।"
      });
      return;
    }

    if (newPassword.length < 10) {
      setPasswordFeedback({
        type: "error",
        text: language === "EN" ? "Password must be at least 10 characters." : "পাসওয়ার্ড অন্তত ১০ অক্ষরের হতে হবে।"
      });
      return;
    }

    setChangingPassword(true);

    try {
      const res = await fetchWithTenant("/api/v1/users/me/change-password", {
        method: "POST",
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || "Failed to change password.");
      }

      setPasswordFeedback({
        type: "success",
        text: language === "EN" ? "Password changed successfully." : "পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে।"
      });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      setPasswordFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update password."
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSignOut = async () => {
    await performLogout();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20 text-gray-500">
        <Loader2 className="animate-spin text-blue-600 mr-2" size={20} />
        <span>Loading account profile...</span>
      </div>
    );
  }

  const initials = `${userData.first_name[0] || "U"}${userData.last_name[0] || ""}`.toUpperCase();

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-white/10 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1 rounded-full">
            Account Management
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white mt-2">
            {language === "EN" ? "User Profile & Security" : "ব্যবহারকারী প্রোফাইল ও নিরাপত্তা"}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage your personal identity, contact details, and account security.
          </p>
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-extrabold text-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 flex-shrink-0">
          {initials}
        </div>

        <div className="space-y-1 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {userData.first_name} {userData.last_name}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
              {userData.role}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
              Active
            </span>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-4 pt-1">
            <span className="flex items-center gap-1.5">
              <Mail size={13} className="text-gray-400" />
              {userData.email}
            </span>
            <span className="flex items-center gap-1.5">
              <Building2 size={13} className="text-gray-400" />
              {institutionName}
            </span>
            <span className="font-mono text-[11px] text-gray-400">
              Campus: {schoolCode}
            </span>
          </div>
        </div>
      </div>

      {/* Profile Form & Password Change Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Edit Personal Details */}
        <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100 dark:border-white/10">
            <User size={18} className="text-blue-600 dark:text-blue-400" />
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">
              {language === "EN" ? "Personal Details" : "ব্যক্তিগত তথ্য"}
            </h3>
          </div>

          {profileFeedback && (
            <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              profileFeedback.type === "success" 
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                : "bg-red-50 text-red-600 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
            }`}>
              {profileFeedback.type === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              <span>{profileFeedback.text}</span>
            </div>
          )}

          <form onSubmit={handleProfileSave} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-gray-700 dark:text-gray-400 mb-1.5">
                First Name
              </label>
              <input
                type="text"
                required
                value={userData.first_name}
                onChange={(e) => setUserData({ ...userData, first_name: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-blue-500 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-gray-700 dark:text-gray-400 mb-1.5">
                Last Name
              </label>
              <input
                type="text"
                required
                value={userData.last_name}
                onChange={(e) => setUserData({ ...userData, last_name: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-blue-500 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-gray-700 dark:text-gray-400 mb-1.5">
                Official Email (Read-Only)
              </label>
              <input
                type="email"
                disabled
                value={userData.email}
                className="w-full px-3.5 py-2.5 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-xl text-gray-500 cursor-not-allowed"
              />
              <span className="text-[10px] text-gray-400 mt-1 block">
                Email identifier is bound to your institutional tenancy.
              </span>
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {savingProfile ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              <span>{language === "EN" ? "Save Changes" : "সংরক্ষণ করুন"}</span>
            </button>
          </form>
        </div>

        {/* Change Password */}
        <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100 dark:border-white/10">
            <Lock size={18} className="text-purple-600 dark:text-purple-400" />
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">
              {language === "EN" ? "Change Password" : "পাসওয়ার্ড পরিবর্তন"}
            </h3>
          </div>

          {passwordFeedback && (
            <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              passwordFeedback.type === "success" 
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                : "bg-red-50 text-red-600 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
            }`}>
              {passwordFeedback.type === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              <span>{passwordFeedback.text}</span>
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-gray-700 dark:text-gray-400 mb-1.5">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showOldPw ? "text" : "password"}
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-3.5 pr-10 py-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-purple-500 text-gray-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowOldPw(!showOldPw)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showOldPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 dark:text-gray-400 mb-1.5">
                New Password (Min 10 Characters)
              </label>
              <div className="relative">
                <input
                  type={showNewPw ? "text" : "password"}
                  required
                  minLength={10}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Must contain letters and numbers"
                  className="w-full pl-3.5 pr-10 py-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-purple-500 text-gray-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 dark:text-gray-400 mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-purple-500 text-gray-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={changingPassword}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {changingPassword ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
              <span>{language === "EN" ? "Update Password" : "পাসওয়ার্ড আপডেট"}</span>
            </button>
          </form>
        </div>

      </div>

      {/* Active Session & Privacy Guard */}
      <div className="bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
        <div className="space-y-1">
          <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield size={16} className="text-emerald-500" />
            <span>Cryptographic Session Isolation</span>
          </div>
          <p className="text-gray-500 dark:text-gray-400 max-w-lg">
            Your login is secured via HMAC-SHA256 tokens and database session rotation. Terminating your session revokes access across all stored tokens immediately.
          </p>
        </div>

        <button
          onClick={handleSignOut}
          className="px-4 py-2 rounded-xl bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-700 dark:text-gray-200 font-semibold transition-colors flex-shrink-0"
        >
          End Current Session
        </button>
      </div>

    </div>
  );
}

