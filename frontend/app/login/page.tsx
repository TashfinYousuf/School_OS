"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Mail, Lock, Building, ArrowRight, Loader2, School } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    schoolName: "",
    tenantId: "",
    email: "",
    password: "",
  });

  // অটো-রিডাইরেক্ট (লগিন করা থাকলে)
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      router.push("/dashboard");
    }
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isLogin) {
        const formBody = new URLSearchParams();
        formBody.append("username", formData.email);
        formBody.append("password", formData.password);

        const response = await fetch("http://127.0.0.1:8000/api/v1/login/access-token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formBody.toString(),
        });

        if (response.ok) {
          const data = await response.json();
          localStorage.setItem("token", data.access_token);
          router.push("/dashboard");
        } else {
          setError("Invalid email or password.");
        }
      } else {
        const response = await fetch("http://127.0.0.1:8000/api/v1/schools/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.schoolName,
            tenant_id: formData.tenantId,
            admin_email: formData.email,
            admin_password: formData.password,
          }),
        });

        if (response.ok) {
          setIsLogin(true);
          setError("School registered successfully! Please log in.");
        } else {
          setError("Registration failed. Tenant ID or email might already exist.");
        }
      }
    } catch (err) {
      setError("Server connection failed. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center relative overflow-hidden selection:bg-purple-500/30">
      
      {/* --- Ambient AI Glow Backgrounds --- */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-600/10 blur-[150px] rounded-full pointer-events-none" />
      
      {/* Grid Pattern overlay for tech vibe */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none"></div>

      <div className="w-full max-w-md px-4 relative z-10">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-white/5 border border-white/10 rounded-2xl mb-4 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
            <School className="text-purple-400 w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">SchoolOS</h1>
          <p className="text-gray-400 text-sm">
            The AI-Native Education Operating System
          </p>
        </div>

        {/* Glassmorphism Auth Card */}
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] p-8 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          
          {/* Tabs */}
          <div className="flex bg-white/5 p-1 rounded-xl mb-6">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 text-sm font-medium py-2 rounded-lg transition-all ${
                isLogin ? "bg-white/10 text-white shadow-sm" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 text-sm font-medium py-2 rounded-lg transition-all ${
                !isLogin ? "bg-white/10 text-white shadow-sm" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Register
            </button>
          </div>

          {error && (
            <div className={`p-3 rounded-lg text-sm mb-4 border ${error.includes("successfully") ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400 ml-1">School Name</label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      required
                      name="schoolName"
                      value={formData.schoolName}
                      onChange={handleChange}
                      type="text"
                      placeholder="Kids Shine Academy"
                      className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                    />
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400 ml-1">Tenant ID (Unique URL identifier)</label>
                  <div className="relative">
                    <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      required
                      name="tenantId"
                      value={formData.tenantId}
                      onChange={handleChange}
                      type="text"
                      placeholder="kidsshine"
                      className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400 ml-1">Admin Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  required
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  type="email"
                  placeholder="admin@schoolos.com"
                  className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center ml-1">
                <label className="text-xs font-medium text-gray-400">Password</label>
                {isLogin && <a href="#" className="text-xs text-purple-400 hover:text-purple-300">Forgot Password?</a>}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  required
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  type="password"
                  placeholder="••••••••"
                  className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-medium py-2.5 rounded-xl mt-6 transition-all shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_rgba(139,92,246,0.5)] flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isLogin ? "Sign In" : "Create Account"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-gray-500 mt-8">
          By continuing, you agree to the SchoolOS Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}