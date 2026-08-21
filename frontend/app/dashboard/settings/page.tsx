"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { Building, Sparkles, Shield, Database, Save, Loader2, Key, Palette, Sun, Moon, Monitor } from "lucide-react";

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const { theme, setTheme } = useTheme();

  const handleSave = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1000);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Tenant Settings</h1>
        <p className="text-gray-400 mt-1">Manage your institution's core configurations and AI behavior.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Settings Sidebar */}
        <aside className="w-full md:w-64 space-y-1">
          <button onClick={() => setActiveTab("appearance")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === "appearance" ? "bg-blue-50 text-blue-700 dark:bg-white/10 dark:text-white dark:border dark:border-white/10" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"}`}>
            <Palette size={16} /> Appearance & UX
          </button>

          <button 
            onClick={() => setActiveTab("general")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === "general" ? "bg-white/10 text-white border border-white/10" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"}`}
          >
            <Building size={16} /> Institution Profile
          </button>
          <button 
            onClick={() => setActiveTab("ai")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === "ai" ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"}`}
          >
            <Sparkles size={16} /> AI Engine Config
          </button>
          <button 
            onClick={() => setActiveTab("security")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === "security" ? "bg-white/10 text-white border border-white/10" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"}`}
          >
            <Shield size={16} /> Roles & Security
          </button>
        </aside>

        {/* Settings Content */}
        <div className="flex-1">
          <div className="bg-white/[0.02] border border-white/[0.08] backdrop-blur-xl rounded-3xl p-8 shadow-2xl">
            {activeTab === "appearance" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Appearance & Theme</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Customize the UI theme for your dashboard.</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                  <button onClick={() => setTheme("light")} className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all ${theme === "light" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300 bg-white"}`}>
                    <Sun className={`w-8 h-8 mb-3 ${theme === "light" ? "text-blue-600" : "text-gray-400"}`} />
                    <span className={`font-semibold ${theme === "light" ? "text-blue-700" : "text-gray-600"}`}>Light Mode</span>
                  </button>
                  <button onClick={() => setTheme("dark")} className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all ${theme === "dark" ? "border-purple-500 bg-purple-500/10" : "border-gray-200 dark:border-white/10 hover:border-purple-500/50 bg-white dark:bg-black/40"}`}>
                    <Moon className={`w-8 h-8 mb-3 ${theme === "dark" ? "text-purple-400" : "text-gray-400"}`} />
                    <span className={`font-semibold ${theme === "dark" ? "text-purple-300" : "text-gray-600 dark:text-gray-400"}`}>Dark Mode</span>
                  </button>
                  <button onClick={() => setTheme("system")} className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all ${theme === "system" ? "border-gray-500 bg-gray-100 dark:bg-white/10 dark:border-gray-400" : "border-gray-200 dark:border-white/10 hover:border-gray-400 bg-white dark:bg-black/40"}`}>
                    <Monitor className={`w-8 h-8 mb-3 ${theme === "system" ? "text-gray-800 dark:text-white" : "text-gray-400"}`} />
                    <span className={`font-semibold ${theme === "system" ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400"}`}>System Sync</span>
                  </button>
                </div>
              </div>
            )}
            
            {activeTab === "general" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-white">Institution Profile</h2>
                  <p className="text-sm text-gray-400">Update your school's directory information.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">School Name</label>
                    <input defaultValue="Kids Shine Academy" className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-blue-500/50 transition-colors" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Tenant ID (Immutable)</label>
                    <input disabled defaultValue="kidsshine" className="w-full bg-black/20 border border-white/5 rounded-xl p-3 text-sm text-gray-500 cursor-not-allowed" />
                  </div>
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
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-white/10 flex justify-end">
              <button 
                onClick={handleSave}
                disabled={loading}
                className="bg-white text-black hover:bg-gray-200 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save Changes
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}