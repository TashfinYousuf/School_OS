"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  School, GraduationCap, Users, ShieldAlert, 
  Loader2, ArrowRight, Lock, Mail, Phone, Hash, Building2, PlusCircle, CheckCircle2 
} from "lucide-react";
import { useLanguage } from "@/components/providers";

export default function UnifiedAuthPage() {
  const router = useRouter();
  const { language, toggleLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState<"staff" | "guardian" | "register">("staff");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Staff Credentials
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");

  // Guardian Credentials
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");

  // New School Registration Form
  const [schoolForm, setSchoolForm] = useState({
    school_name: "",
    admin_name: "",
    admin_email: "",
    admin_password: "",
    contact_phone: "",
    address: ""
  });

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/auth/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: staffEmail, password: staffPassword })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Invalid email or password");

      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user_role", data.role.toLowerCase());
      localStorage.setItem("user_name", data.name);
      localStorage.setItem("tenant_id", data.tenant_id);

      router.push("/dashboard");
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuardianLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/auth/guardian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admission_number: admissionNumber, phone_number: guardianPhone })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Authentication failed");

      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user_role", "guardian");
      localStorage.setItem("user_name", data.name);
      localStorage.setItem("tenant_id", data.tenant_id);
      if (data.student_id) localStorage.setItem("student_id", data.student_id);

      router.push("/dashboard");
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/auth/register-school", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schoolForm)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Registration failed");

      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user_role", "admin");
      localStorage.setItem("user_name", data.name);
      localStorage.setItem("tenant_id", data.tenant_id);

      router.push("/dashboard");
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* Background Ambient Glows */}
      <div className="fixed top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-600/10 blur-[150px] rounded-full pointer-events-none" />

      {/* Language Switcher Button */}
      <div className="absolute top-6 right-6 z-20">
        <button
          onClick={toggleLanguage}
          className="px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0f0f11] text-xs font-semibold text-gray-700 dark:text-gray-300 shadow-sm"
        >
          {language === "EN" ? "বাংলা" : "English"}
        </button>
      </div>

      <div className="w-full max-w-lg bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6 animate-in fade-in duration-300">
        
        {/* Brand Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex p-3 bg-blue-50 dark:bg-white/5 rounded-2xl border border-blue-100 dark:border-white/10 text-blue-600 dark:text-purple-400 mb-1">
            <School size={28} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">SchoolOS Portal</h1>
          <p className="text-xs text-gray-500">Autonomous Multi-Tenant Educational Operating System</p>
        </div>

        {/* 3-Tier Mode Selector */}
        <div className="flex p-1 bg-gray-100 dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/5 text-xs">
          <button
            type="button"
            onClick={() => { setActiveTab("staff"); setErrorMsg(null); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-semibold transition-all ${
              activeTab === "staff"
                ? "bg-white dark:bg-[#1a1a1e] text-blue-600 dark:text-white shadow-sm"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <GraduationCap size={14} /> Staff / Teacher
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("student" as any); setErrorMsg(null); }}
            className={`py-2 px-2 rounded-xl font-semibold transition-all ${
              activeTab === ("student" as any) ? "bg-white dark:bg-[#1a1a1e] text-purple-600 dark:text-white shadow-sm" : "text-gray-500"
            }`}
          >
            <Users size={14} /> Student
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("guardian"); setErrorMsg(null); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-semibold transition-all ${
              activeTab === "guardian"
                ? "bg-white dark:bg-[#1a1a1e] text-green-600 dark:text-white shadow-sm"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <Users size={14} /> Parent Portal
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("register"); setErrorMsg(null); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-semibold transition-all ${
              activeTab === "register"
                ? "bg-white dark:bg-[#1a1a1e] text-purple-600 dark:text-white shadow-sm"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <Building2 size={14} /> New School
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
            <ShieldAlert size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. Staff / Teacher Login Form */}
        {activeTab === "staff" && (
          <form onSubmit={handleStaffLogin} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-gray-700 dark:text-gray-300">Institutional Email</label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <input
                  type="email"
                  required
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  placeholder="admin@school.com or teacher@school.com"
                  className="w-full pl-9 pr-3 py-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-gray-700 dark:text-gray-300">Password</label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <input
                  type="password"
                  required
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              Login to Workspace
            </button>
          </form>
        )}

        {activeTab === ("student" as any) && (
          <form onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            setErrorMsg(null);
            try {
              const res = await fetch("http://127.0.0.1:8000/api/v1/login/student", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ admission_number: admissionNumber, password: staffPassword || "123456" })
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.detail || "Authentication failed");
              localStorage.setItem("token", data.access_token);
              localStorage.setItem("user_role", "student");
              localStorage.setItem("user_name", data.name);
              localStorage.setItem("tenant_id", data.tenant_id);
              router.push("/dashboard");
            } catch (err: any) {
              setErrorMsg(err.message);
            } finally {
              setLoading(false);
            }
          }} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-gray-700 dark:text-gray-300">Admission ID / Roll</label>
              <input
                required
                value={admissionNumber}
                onChange={(e) => setAdmissionNumber(e.target.value)}
                placeholder="e.g. KS-2026-001"
                className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-mono"
              />
            </div>
            <div>
              <label className="font-semibold text-gray-700 dark:text-gray-300">Student Access PIN / Password</label>
              <input
                type="password"
                required
                value={staffPassword}
                onChange={(e) => setStaffPassword(e.target.value)}
                placeholder="Default PIN: 123456"
                className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              Enter Student Workspace
            </button>
          </form>
        )}

        {/* 2. Guardian Portal Form */}
        {activeTab === "guardian" && (
          <form onSubmit={handleGuardianLogin} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-gray-700 dark:text-gray-300">Student Admission ID</label>
              <div className="relative mt-1">
                <Hash className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <input
                  type="text"
                  required
                  value={admissionNumber}
                  onChange={(e) => setAdmissionNumber(e.target.value)}
                  placeholder="e.g. KS-2026-001"
                  className="w-full pl-9 pr-3 py-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-green-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-gray-700 dark:text-gray-300">Registered Guardian Mobile Number</label>
              <div className="relative mt-1">
                <Phone className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <input
                  type="text"
                  required
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)}
                  placeholder="017XXXXXXXX"
                  className="w-full pl-9 pr-3 py-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-green-500 font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              Access Child's Portal
            </button>
          </form>
        )}

        {/* 3. Register New School Tenant Form */}
        {activeTab === "register" && (
          <form onSubmit={handleRegisterSchool} className="space-y-3 text-xs">
            <div>
              <label className="font-semibold text-gray-700 dark:text-gray-300">Institution / School Name *</label>
              <input
                required
                value={schoolForm.school_name}
                onChange={(e) => setSchoolForm({ ...schoolForm, school_name: e.target.value })}
                placeholder="e.g. Kids Shine International School"
                className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-purple-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-300">Administrator Name *</label>
                <input
                  required
                  value={schoolForm.admin_name}
                  onChange={(e) => setSchoolForm({ ...schoolForm, admin_name: e.target.value })}
                  placeholder="Principal / Admin"
                  className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-300">Contact Phone *</label>
                <input
                  required
                  value={schoolForm.contact_phone}
                  onChange={(e) => setSchoolForm({ ...schoolForm, contact_phone: e.target.value })}
                  placeholder="017XXXXXXXX"
                  className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-300">Admin Email (Login ID) *</label>
                <input
                  type="email"
                  required
                  value={schoolForm.admin_email}
                  onChange={(e) => setSchoolForm({ ...schoolForm, admin_email: e.target.value })}
                  placeholder="admin@school.edu.bd"
                  className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-300">Admin Password *</label>
                <input
                  type="password"
                  required
                  value={schoolForm.admin_password}
                  onChange={(e) => setSchoolForm({ ...schoolForm, admin_password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-gray-700 dark:text-gray-300">Campus Address *</label>
              <input
                required
                value={schoolForm.address}
                onChange={(e) => setSchoolForm({ ...schoolForm, address: e.target.value })}
                placeholder="Main Campus, City"
                className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <PlusCircle size={16} />}
              Onboard Institution & Setup Tenant
            </button>
          </form>
        )}

        <div className="pt-2 text-[11px] text-gray-400 text-center">
          <span>Enterprise Multi-Tenant Row Level Isolation (RLS) Enforced.</span>
        </div>

      </div>
    </div>
  );
}