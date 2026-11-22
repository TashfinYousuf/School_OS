"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "next-themes";
import { useLanguage } from "@/components/providers";
import { 
  Building2, Palette, Sparkles, Shield, X, Save, 
  Loader2, Sun, Moon, Monitor, CheckCircle2, Download, UploadCloud, FileSpreadsheet 
} from "lucide-react";
import { fetchWithTenant } from "@/lib/api-client";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"general" | "appearance" | "ai" | "security">("general");
  const { theme, setTheme } = useTheme();
  const { language } = useLanguage();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [profile, setProfile] = useState({
    school_name: "",
    tagline: "",
    eiin_or_code: "",
    address: "",
    contact_phone: "",
    contact_email: "",
    academic_year: "2026"
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const res = await fetchWithTenant("/api/v1/institution/profile");
        if (res.ok) {
          setProfile(await res.json());
        }
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [isOpen]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetchWithTenant("/api/v1/institution/profile", {
        method: "PATCH",
        body: JSON.stringify(profile)
      });
      if (res.ok) {
        setFeedback(language === "EN" ? "Settings saved successfully." : "সেটিংস সফলভাবে সংরক্ষিত হয়েছে।");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setFeedback(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetchWithTenant("/api/v1/institution/import-students-csv", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Import failed");
      setFeedback(`Imported ${data.imported_records} students successfully.`);
    } catch (err: any) {
      setFeedback(`Error: ${err.message}`);
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const downloadSampleCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "first_name,last_name,admission_number,class_name,roll_number,guardian_name,guardian_phone\n" +
      "Aarav,Rahman,KS-001,Class 1,01,Rafiqul Islam,01711223344";
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "student_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!mounted || !isOpen) return null;

  // 🚀 createPortal mounts the modal directly to <body> at z-99999
  return createPortal(
    <div className="fixed inset-0 z-99999 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-16 px-6 border-b border-gray-100 dark:border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 font-bold text-lg text-gray-900 dark:text-white">
            <Building2 className="text-blue-600 dark:text-purple-400" size={20} />
            <span>{language === "EN" ? "Settings & Preferences" : "সেটিংস ও কনফিগারেশন"}</span>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Tabs */}
          <div className="w-full md:w-60 p-4 border-r border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 space-y-1 shrink-0">
            {[
              { id: "general", label: "Institution Profile", icon: Building2 },
              { id: "appearance", label: "Appearance & Theme", icon: Palette },
              { id: "ai", label: "AI Engine Config", icon: Sparkles },
              { id: "security", label: "Roles & Security", icon: Shield }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === tab.id
                      ? "bg-blue-600 text-white shadow-sm dark:bg-white/10 dark:text-white"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
                  }`}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Content */}
          <div className="flex-1 p-6 md:p-8 overflow-y-auto custom-scrollbar">
            {feedback && (
              <div className="mb-6 p-3.5 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-2xl text-blue-700 dark:text-blue-400 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 size={16} /> {feedback}
              </div>
            )}

            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="animate-spin text-blue-600" size={28} />
              </div>
            ) : (
              <>
                {/* 1. Institution Profile Tab */}
                {activeTab === "general" && (
                  <div className="space-y-6">
                    <form onSubmit={handleProfileSave} className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Institution Name</label>
                        <input
                          required
                          value={profile.school_name}
                          onChange={(e) => setProfile({...profile, school_name: e.target.value})}
                          className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">EIIN / Code</label>
                          <input
                            value={profile.eiin_or_code}
                            onChange={(e) => setProfile({...profile, eiin_or_code: e.target.value})}
                            className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm text-gray-900 dark:text-white outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Academic Year</label>
                          <input
                            value={profile.academic_year}
                            onChange={(e) => setProfile({...profile, academic_year: e.target.value})}
                            className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm text-gray-900 dark:text-white outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Tagline / Motto</label>
                        <input
                          value={profile.tagline}
                          onChange={(e) => setProfile({...profile, tagline: e.target.value})}
                          className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm text-gray-900 dark:text-white outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Address</label>
                        <input
                          value={profile.address}
                          onChange={(e) => setProfile({...profile, address: e.target.value})}
                          className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm text-gray-900 dark:text-white outline-none"
                        />
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          type="submit"
                          disabled={saving}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm disabled:opacity-50"
                        >
                          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Profile
                        </button>
                      </div>
                    </form>

                    {/* Bulk Onboarding (CSV) */}
                    <div className="pt-6 border-t border-gray-100 dark:border-white/10">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
                        <FileSpreadsheet size={14} /> Bulk Student Onboarding (CSV)
                      </h4>
                      <p className="text-xs text-gray-500 mb-4">Upload a filled CSV file to onboard students and link their guardians at once.</p>
                      
                      <div className="flex items-center gap-3">
                        <button
                          onClick={downloadSampleCSV}
                          className="px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-medium hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-1.5 text-gray-700 dark:text-gray-400"
                        >
                          <Download size={14} /> Sample CSV
                        </button>
                        <label className="cursor-pointer bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm">
                          {importing ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />} Upload Spreadsheet
                          <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Appearance Tab */}
                {activeTab === "appearance" && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Theme & Display</h3>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => setTheme("light")}
                        className={`p-4 rounded-2xl border text-center transition-all ${theme === "light" ? "border-blue-600 bg-blue-50 text-blue-700 font-bold" : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400"}`}
                      >
                        <Sun className="mx-auto mb-2" size={20} /> Light
                      </button>
                      <button
                        onClick={() => setTheme("dark")}
                        className={`p-4 rounded-2xl border text-center transition-all ${theme === "dark" ? "border-purple-600 bg-purple-500/10 text-purple-400 font-bold" : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400"}`}
                      >
                        <Moon className="mx-auto mb-2" size={20} /> Dark
                      </button>
                      <button
                        onClick={() => setTheme("system")}
                        className={`p-4 rounded-2xl border text-center transition-all ${theme === "system" ? "border-gray-600 bg-gray-100 dark:bg-white/10 font-bold text-gray-900 dark:text-white" : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400"}`}
                      >
                        <Monitor className="mx-auto mb-2" size={20} /> Auto
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. AI Engine Tab */}
                {activeTab === "ai" && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">AI Copilot Parameters</h3>
                    <div className="p-4 bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-2xl space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-gray-900 dark:text-white">Active Core Model</span>
                        <span className="font-mono bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2.5 py-1 rounded-md font-bold">Gemini 2.5 Flash</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-gray-900 dark:text-white">Human-in-the-loop Guardrail</span>
                        <span className="text-green-600 font-bold">Mandatory (L2 Safe)</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Roles & Security Tab */}
                {activeTab === "security" && (
                  <div className="space-y-3 text-xs text-gray-600 dark:text-gray-400">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Enterprise Security Policy</h3>
                    <p>• Multi-Tenant Row Level Isolation (RLS) is strictly enforced per institutional UUID.</p>
                    <p>• Unauthorized public registrations are permanently restricted.</p>
                    <p>• All teacher and student profiles must be provisioned directly by institution administrators.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}