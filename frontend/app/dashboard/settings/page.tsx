"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useLanguage } from "@/components/providers";
import { 
  Building2, Palette, Sparkles, Shield, Save, 
  Loader2, Sun, Moon, Monitor, CheckCircle2, Download, UploadCloud, FileSpreadsheet 
} from "lucide-react";

export default function SettingsFullPage() {
  const [activeTab, setActiveTab] = useState<"general" | "appearance" | "ai" | "security">("general");
  const { theme, setTheme } = useTheme();
  const { language } = useLanguage();

  const [loading, setLoading] = useState(true);
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
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("http://127.0.0.1:8000/api/v1/institution/profile", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          setProfile(await res.json());
        }
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/institution/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
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
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/institution/import-students-csv", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
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

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      <div className="border-b border-gray-200 dark:border-white/10 pb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2.5">
          <Building2 className="text-blue-600 dark:text-purple-400" />
          <span>{language === "EN" ? "Institution Settings" : "প্রাতিষ্ঠানিক সেটিংস"}</span>
        </h1>
        <p className="text-xs text-gray-500 mt-1">Configure multi-tenant branding, active academic session, and bulk onboarding.</p>
      </div>

      {feedback && (
        <div className="p-3.5 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-2xl text-blue-700 dark:text-blue-400 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 size={16} /> {feedback}
        </div>
      )}

      {/* Clean Pill Tabs */}
      <div className="flex gap-2 border-b border-gray-100 dark:border-white/10 pb-3">
        {[
          { id: "general", label: "Institution Profile", icon: Building2 },
          { id: "appearance", label: "Appearance", icon: Palette },
          { id: "ai", label: "AI Engine", icon: Sparkles },
          { id: "security", label: "Security & RLS", icon: Shield }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-sm dark:bg-white/10 dark:text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm">
        {activeTab === "general" && (
          <div className="space-y-6">
            <form onSubmit={handleProfileSave} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Institution Name</label>
                <input
                  required
                  value={profile.school_name}
                  onChange={(e) => setProfile({...profile, school_name: e.target.value})}
                  className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">EIIN / Code</label>
                  <input
                    value={profile.eiin_or_code}
                    onChange={(e) => setProfile({...profile, eiin_or_code: e.target.value})}
                    className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Academic Year</label>
                  <input
                    value={profile.academic_year}
                    onChange={(e) => setProfile({...profile, academic_year: e.target.value})}
                    className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Motto / Tagline</label>
                <input
                  value={profile.tagline}
                  onChange={(e) => setProfile({...profile, tagline: e.target.value})}
                  className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Address</label>
                <input
                  value={profile.address}
                  onChange={(e) => setProfile({...profile, address: e.target.value})}
                  className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm outline-none"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Profile
                </button>
              </div>
            </form>

            <div className="pt-6 border-t border-gray-100 dark:border-white/10">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                <FileSpreadsheet size={14} /> Bulk Onboarding (CSV)
              </h4>
              <div className="flex items-center gap-3">
                <button
                  onClick={downloadSampleCSV}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-medium hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-1.5"
                >
                  <Download size={14} /> Download Sample CSV
                </button>
                <label className="cursor-pointer bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm">
                  {importing ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />} Upload Spreadsheet
                  <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>
          </div>
        )}

        {activeTab === "appearance" && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Theme Selection</h3>
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => setTheme("light")}
                className={`p-5 rounded-2xl border text-center transition-all ${theme === "light" ? "border-blue-600 bg-blue-50 text-blue-700 font-bold" : "border-gray-200 dark:border-white/10"}`}
              >
                <Sun className="mx-auto mb-2" size={24} /> Light Mode
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`p-5 rounded-2xl border text-center transition-all ${theme === "dark" ? "border-purple-600 bg-purple-500/10 text-purple-400 font-bold" : "border-gray-200 dark:border-white/10"}`}
              >
                <Moon className="mx-auto mb-2" size={24} /> Dark Mode
              </button>
              <button
                onClick={() => setTheme("system")}
                className={`p-5 rounded-2xl border text-center transition-all ${theme === "system" ? "border-gray-600 bg-gray-100 dark:bg-white/10 font-bold" : "border-gray-200 dark:border-white/10"}`}
              >
                <Monitor className="mx-auto mb-2" size={24} /> System Auto
              </button>
            </div>
          </div>
        )}

        {activeTab === "ai" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-purple-300">AI Engine Configuration</h2>
              <p className="text-sm text-gray-400">Manage LLM parameters and RAG knowledge base settings.</p>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-white">Default Model Router</h4>
                  <p className="text-xs text-gray-400 mt-1">Automatically fallback to OpenAI if Gemini fails.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                </label>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Custom Prompt Instructions</label>
                <textarea 
                  rows={4}
                  defaultValue="You are the AI Principal of Kids Shine Academy. Always prioritize competency over traditional GPA. Tone: Professional, encouraging."
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-gray-300 outline-none focus:border-purple-500/50 transition-colors resize-none" 
                />
              </div>
            </div>
            
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">AI Engine Status</h3>
            <div className="p-4 bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-2xl space-y-2">
              <p><strong className="text-gray-900 dark:text-white">Active LLM:</strong> Gemini 2.5 Flash</p>
              <p><strong className="text-gray-900 dark:text-white">Governance:</strong> Human Approval Required for Sensitive Actions (L2)</p>
            </div>
          </div>
        )}

        {activeTab === "security" && (
          <div className="space-y-3 text-xs text-gray-500 dark:text-gray-400">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Security & Multi-Tenancy</h3>
            <p>• Data isolation is strictly mapped to the institutional tenant ID.</p>
            <p>• Open registration is permanently disabled to prevent unauthorized account creation.</p>
          </div>
        )}
      </div>
    </div>
  );
}