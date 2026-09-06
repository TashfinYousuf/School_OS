"use client";

import { useState } from "react";
import { useLanguage } from "@/components/providers";
import { 
  Bell, Sparkles, Printer, Copy, Check, 
  Share2, MessageCircle, Globe, FileText, Save, Loader2, AlertCircle 
} from "lucide-react";

export default function NoticeComposerPage() {
  const { language } = useLanguage();
  const [rawPrompt, setRawPrompt] = useState("");
  const [urgency, setUrgency] = useState("Normal");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"official" | "sms" | "social">("official");
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Generated Notice State
  const [noticeData, setNoticeData] = useState<{
    memo_no: string;
    raw_prompt: string;
    title: string;
    official_notice: string;
    guardian_sms: string;
    social_copy: string;
  } | null>(null);

  const handleCompose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawPrompt.trim()) return;

    setGenerating(true);
    setFeedback(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/notices/compose", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          raw_prompt: rawPrompt, 
          title: "Kids Shine International School", // 🚀 Backend schema match
          urgency 
        })
      });

      if (!res.ok) throw new Error("Failed to compose notice");
      const data = await res.json();
      setNoticeData(data);
    } catch (err: any) {
      setFeedback(err.message || "Communication with Notice Engine failed");
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!noticeData) return;
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/notices/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(noticeData)
      });
      if (res.ok) {
        setFeedback(language === "EN" ? "Notice published to school archives!" : "বিজ্ঞপ্তিটি সফলভাবে আর্কাইভে সংরক্ষিত হয়েছে!");
      }
    } catch (err) {
      setFeedback("Failed to publish notice.");
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      
      {/* Screen Controls (Hidden when printing A4 Notice) */}
      <div className="print:hidden space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-white/[0.08] pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <Bell className="text-blue-600 dark:text-purple-400" />
              {language === "EN" ? "Notice Composer & Multi-Channel Publisher" : "নোটিশ কম্পোজার ও মাল্টি-চ্যানেল ডিস্ট্রিবিউটর"}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Kids Shine International School • Single-prompt official notice, SMS, and portal drafting.
            </p>
          </div>

          {noticeData && (
            <div className="flex items-center gap-3">
              <button
                onClick={handlePublish}
                disabled={saving}
                className="bg-gray-100 dark:bg-white/10 text-gray-800 dark:text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-200 dark:hover:bg-white/20 transition-all flex items-center gap-2"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {language === "EN" ? "Publish Notice" : "প্রকাশ করুন"}
              </button>
              <button
                onClick={handlePrint}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 shadow-sm"
              >
                <Printer size={16} />
                {language === "EN" ? "Print Official Notice (A4)" : "অফিসিয়াল প্রিন্ট (A4)"}
              </button>
            </div>
          )}
        </div>

        {feedback && (
          <div className="p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl text-blue-700 dark:text-blue-400 text-sm font-medium flex items-center gap-2">
            <Sparkles size={16} /> {feedback}
          </div>
        )}

        {/* Input Box: Principal's Raw Instruction */}
        <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/[0.08] p-6 rounded-3xl shadow-sm">
          <form onSubmit={handleCompose} className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {language === "EN" ? "Instruction / Raw Announcement Prompt" : "বিজ্ঞপ্তির মূল নির্দেশনা বা বিষয়"}
              </label>
              <textarea
                rows={3}
                value={rawPrompt}
                onChange={(e) => setRawPrompt(e.target.value)}
                placeholder={language === "EN" 
                  ? "e.g., School will remain closed on Sunday due to extreme heatwave. Regular classes will resume from Monday." 
                  : "উদাহরণ: আগামী রবিবার তীব্র তাপদাহের কারণে স্কুল বন্ধ থাকবে, সোমবার থেকে যথারীতি ক্লাস চলবে..."}
                className="w-full mt-2 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-2xl p-4 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 resize-none leading-relaxed"
              />
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-400">
                <span>Urgency:</span>
                {["Normal", "High", "Emergency"].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setUrgency(lvl)}
                    className={`px-3 py-1 rounded-lg border text-xs transition-all ${
                      urgency === lvl 
                        ? "bg-blue-50 dark:bg-blue-500/20 border-blue-500 text-blue-600 dark:text-blue-400 font-bold" 
                        : "border-gray-200 dark:border-white/10 text-gray-500"
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={generating || !rawPrompt.trim()}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {generating ? "Drafting 3 Channels..." : "Compose Multi-Channel Notice"}
              </button>
            </div>
          </form>
        </div>

        {/* Generated Channels View */}
        {noticeData && (
          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/[0.08] rounded-3xl overflow-hidden shadow-sm">
            
            {/* Channel Tabs */}
            <div className="flex border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] p-2 gap-2">
              <button
                onClick={() => setActiveTab("official")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "official"
                    ? "bg-white dark:bg-[#0f0f11] text-blue-600 dark:text-blue-400 shadow-sm border border-gray-200 dark:border-white/10"
                    : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <FileText size={16} /> 1. Official Letter (A4 Print)
              </button>

              <button
                onClick={() => setActiveTab("sms")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "sms"
                    ? "bg-white dark:bg-[#0f0f11] text-green-600 dark:text-green-400 shadow-sm border border-gray-200 dark:border-white/10"
                    : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <MessageCircle size={16} /> 2. Guardian WhatsApp / SMS
              </button>

              <button
                onClick={() => setActiveTab("social")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "social"
                    ? "bg-white dark:bg-[#0f0f11] text-purple-600 dark:text-purple-400 shadow-sm border border-gray-200 dark:border-white/10"
                    : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <Globe size={16} /> 3. Facebook & Website Portal
              </button>
            </div>

            {/* Tab Contents */}
            <div className="p-6">
              
              {activeTab === "official" && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span>Memo: {noticeData.memo_no}</span>
                    <span className="text-gray-400 italic">Editable text (Reflects on print)</span>
                  </div>
                  <input
                    value={noticeData.title}
                    onChange={(e) => setNoticeData({...noticeData, title: e.target.value})}
                    className="w-full bg-transparent font-bold text-lg text-gray-900 dark:text-white outline-none border-b border-gray-200 dark:border-white/10 pb-2"
                  />
                  <textarea
                    rows={12}
                    value={noticeData.official_notice}
                    onChange={(e) => setNoticeData({...noticeData, official_notice: e.target.value})}
                    className="w-full bg-transparent border-none outline-none font-serif text-sm leading-relaxed text-gray-800 dark:text-gray-200 resize-none pt-2"
                  />
                </div>
              )}

              {activeTab === "sms" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-green-600 uppercase tracking-wider">SMS / WhatsApp Message</span>
                    <button
                      onClick={() => copyToClipboard(noticeData.guardian_sms)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/10 text-xs font-semibold hover:bg-gray-200"
                    >
                      {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                      {copied ? "Copied" : "Copy Text"}
                    </button>
                  </div>
                  <textarea
                    rows={5}
                    value={noticeData.guardian_sms}
                    onChange={(e) => setNoticeData({...noticeData, guardian_sms: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-2xl p-4 text-sm text-gray-900 dark:text-white outline-none resize-none leading-relaxed"
                  />
                  <p className="text-xs text-gray-400">Directly copyable for sending via WhatsApp groups or SMS Gateway.</p>
                </div>
              )}

              {activeTab === "social" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">Facebook & Notice Board Copy</span>
                    <button
                      onClick={() => copyToClipboard(noticeData.social_copy)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/10 text-xs font-semibold hover:bg-gray-200"
                    >
                      {copied ? <Check size={14} className="text-purple-500" /> : <Copy size={14} />}
                      {copied ? "Copied" : "Copy Post"}
                    </button>
                  </div>
                  <textarea
                    rows={8}
                    value={noticeData.social_copy}
                    onChange={(e) => setNoticeData({...noticeData, social_copy: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-2xl p-4 text-sm text-gray-900 dark:text-white outline-none resize-none leading-relaxed font-sans"
                  />
                </div>
              )}

            </div>

          </div>
        )}

      </div>

      {/* ================= OFFICIAL PRINT-ONLY SHEET (A4 Standard) ================= */}
      {noticeData && (
        <div className="hidden print:block font-serif text-black p-8 bg-white max-w-[210mm] mx-auto leading-normal">
          {/* Institutional Pad Header */}
          <div className="text-center border-b-2 border-black pb-4 mb-6">
            <h1 className="text-2xl font-black uppercase tracking-wider">Kids Shine International School</h1>
            <p className="text-xs italic mt-0.5">Towards a Bright Future • School Code: KS-091</p>
            <p className="text-[11px] mt-1 text-gray-700">Kandirpar, Cumilla, Bangladesh • Contact: +88017XXXXXXXX</p>
          </div>

          <div className="flex justify-between text-xs font-semibold mb-6">
            <span>স্মারক নং: {noticeData.memo_no}</span>
            <span>তারিখ: {new Date().toLocaleDateString("bn-BD")}</span>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-lg font-bold underline inline-block">{noticeData.title}</h2>
          </div>

          {/* Body */}
          <div className="whitespace-pre-wrap text-sm leading-relaxed mb-16 text-justify">
            {noticeData.official_notice}
          </div>

          {/* Signature Block */}
          <div className="flex justify-end pt-12">
            <div className="text-center">
              <div className="w-48 border-t border-black mb-1"></div>
              <span className="font-bold text-xs block">অধ্যক্ষ / প্রধান শিক্ষক</span>
              <span className="text-[11px] text-gray-700 block">Kids Shine International School</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}