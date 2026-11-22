"use client";

import { useEffect, useState, useMemo } from "react";
import { useLanguage } from "@/components/providers";
import { safeFetch, fetchWithTenant } from "@/lib/api-client";
import { 
  School, Plus, Calendar, Users, Eye, 
  Trash2, Loader2, Sparkles, Send, Megaphone, 
  Search, Printer, X, ShieldAlert, CheckCircle2, FileText
} from "lucide-react";
import { useInstitution } from "@/lib/institution";
import { ResponsiveDialog } from "@/components/ui/ResponsiveDialog";

interface NoticeItem {
  id: string;
  title: string;
  content: string;
  target_audience: "ALL" | "PARENTS" | "TEACHERS" | "STUDENTS";
  published_at: string;
  expiry_date?: string;
}

export default function NoticeBoardPage() {
  const { language } = useLanguage();
  const { name , address, phone } = useInstitution();
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");
  const [userName, setUserName] = useState<string>("User");

  // Filtering & Search
  const [selectedAudience, setSelectedAudience] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [selectedNoticeForPrint, setSelectedNoticeForPrint] = useState<NoticeItem | null>(null);
  const [acknowledgedNotices, setAcknowledgedNotices] = useState<Record<string, boolean>>({});

  const handleAcknowledge = async (noticeId: string) => {
    try {
      const res = await fetchWithTenant(`/api/v1/notices/${noticeId}/acknowledge`, {
        method: "POST"
      });
      if (res.ok) {
        setAcknowledgedNotices((prev) => ({ ...prev, [noticeId]: true }));
      }
    } catch (err) {
      console.error("Acknowledge error:", err);
    }
  };
  
  // Submission & AI Generation
  const [submitting, setSubmitting] = useState(false);
  const [aiDrafting, setAiDrafting] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [targetAudience, setTargetAudience] = useState<"ALL" | "PARENTS" | "TEACHERS" | "STUDENTS">("ALL");

  useEffect(() => {
    const role = (localStorage.getItem("user_role") || "student").toLowerCase();
    const name = localStorage.getItem("user_name") || "User";
    setUserRole(role);
    setUserName(name);
    fetchNotices();
  }, []);

  const fetchNotices = async () => {
    setLoading(true);
    try {
      const { data } = await safeFetch<NoticeItem[]>("/api/v1/notices/");
      if (data) setNotices(data);
    } catch (err) {
      console.error("Notice fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetchWithTenant("/api/v1/notices/", {
        method: "POST",
        body: JSON.stringify({
          title,
          content,
          target_audience: targetAudience
        })
      });

      if (res.ok) {
        setTitle("");
        setContent("");
        setAiPrompt("");
        setShowModal(false);
        fetchNotices();
      } else {
        alert("Failed to publish notice");
      }
    } catch (err) {
      alert("Error publishing notice. Check backend connection.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNotice = async (id: string) => {
    if (!confirm(language === "EN" ? "Are you sure you want to delete this notice?" : "আপনি কি নিশ্চিত যে এই বিজ্ঞপ্তিটি মুছে ফেলতে চান?")) return;

    try {
      const res = await fetchWithTenant(`/api/v1/notices/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setNotices((prev) => prev.filter((n) => n.id !== id));
      } else {
        alert("Permission denied or server error.");
      }
    } catch (err) {
      alert("Network error deleting notice.");
    }
  };

  // AI Copilot Generator
  const handleGenerateAIDraft = async () => {
    if (!aiPrompt.trim()) {
      alert("অনুগ্রহ করে কী বিষয়ে নোটিশ ড্রাফট করতে চান তা সংক্ষেপে লিখুন।");
      return;
    }
    setAiDrafting(true);
    try {
      const res = await fetchWithTenant("/api/v1/ai/ask", {
        method: "POST",
        body: JSON.stringify({ 
          query: `Draft an official school notice for {${name}}. Subject/Requirement: ${aiPrompt}. Respond with Title on first line starting with 'TITLE:', followed by the official polite body text.` 
        })
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.answer || data.response || "";
        const lines = text.split("\n");
        const titleLine = lines.find((l: string) => l.startsWith("TITLE:"));
        if (titleLine) {
          setTitle(titleLine.replace("TITLE:", "").trim());
          setContent(lines.filter((l: string) => !l.startsWith("TITLE:")).join("\n").trim());
        } else {
          setTitle(aiPrompt);
          setContent(text);
        }
      }
    } catch (err) {
      alert("AI Assistant unavailable.");
    } finally {
      setAiDrafting(false);
    }
  };

  // Filtered List
  const filteredNotices = useMemo(() => {
    return notices.filter((n) => {
      const matchAudience = selectedAudience === "ALL" || n.target_audience === selectedAudience || n.target_audience === "ALL";
      const matchQuery = n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.content.toLowerCase().includes(searchQuery.toLowerCase());
      return matchAudience && matchQuery;
    });
  }, [notices, selectedAudience, searchQuery]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300 print:max-w-full">
      
      {/* 1. Header (Screen View) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-white/10 pb-5 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <Megaphone className="text-blue-600 dark:text-purple-400" size={24} />
            <span>{language === "EN" ? "Institutional Notice Board" : "প্রাতিষ্ঠানিক নোটিশ বোর্ড"}</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {language === "EN" ? "Official broadcast circulars, holiday memos, and academic bulletins." : "অফিশিয়াল পরিপত্র, ছুটির বিজ্ঞপ্তি এবং একাডেমিক ঘোষণা।"}
          </p>
        </div>

        {(userRole === "admin" || userRole === "superadmin") && (
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
          >
            <Plus size={16} />
            <span>{language === "EN" ? "Publish Circular" : "নতুন নোটিশ প্রকাশ করুন"}</span>
          </button>
        )}
      </div>

      {/* 2. Controls & Audience Filter Tabs (Screen View) */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 print:hidden">
        <div className="flex p-1 bg-gray-100 dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/5 text-xs">
          {(userRole === "student"
            ? ["ALL", "STUDENTS"]
            : userRole === "guardian"
            ? ["ALL", "PARENTS"]
            : ["ALL", "PARENTS", "TEACHERS", "STUDENTS"]
          ).map((aud) => (
            <button
              key={aud}
              onClick={() => setSelectedAudience(aud)}
              className={`px-3.5 py-1.5 rounded-xl font-semibold transition-all ${
                selectedAudience === aud 
                  ? "bg-white dark:bg-[#1a1a1e] text-blue-600 dark:text-white shadow-sm" 
                  : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              {aud === "ALL" ? (language === "EN" ? "All Notices" : "সকলের জন্য") : aud}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Notices..."
            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* 3. Notice Cards List */}
      {loading ? (
        <div className="p-12 text-center text-gray-400 flex items-center justify-center gap-2 print:hidden">
          <Loader2 className="animate-spin text-blue-600" size={20} />
          <span>Loading Notices...</span>
        </div>
      ) : filteredNotices.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-[#0f0f11] rounded-3xl border border-gray-200 dark:border-white/10 text-gray-400 text-xs print:hidden">
          No active notices published.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 print:hidden">
          {filteredNotices.map((n) => (
            <div 
              key={n.id} 
              className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 p-6 rounded-3xl shadow-sm hover:border-blue-500/40 transition-all space-y-3 relative group"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                      Audience: {n.target_audience}
                    </span>
                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                      <Calendar size={12} /> {new Date(n.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white pt-1">{n.title}</h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedNoticeForPrint(n)}
                    className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-400 rounded-xl transition-all"
                    title="Print Official Circular Pad"
                  >
                    <Printer size={15} />
                  </button>

                  {(userRole === "admin" || userRole === "superadmin") && (
                    <button
                      onClick={() => handleDeleteNotice(n.id)}
                      className="p-2 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 text-red-600 rounded-xl transition-all"
                      title="Delete Notice"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}

                  {(userRole === "student" || userRole === "guardian") && (
                    <button
                      onClick={() => handleAcknowledge(n.id)}
                      disabled={acknowledgedNotices[n.id]}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        acknowledgedNotices[n.id]
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                          : "bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                      }`}
                    >
                      <CheckCircle2 size={13} />
                      <span>{acknowledgedNotices[n.id] ? (language === "EN" ? "Acknowledged" : "পঠিত") : (language === "EN" ? "Mark Read" : "পড়েছি")}</span>
                    </button>
                  )}
                </div>
              </div>

              <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-line leading-relaxed">
                {n.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 4. Official Printable A4 Pad Modal */}
      <ResponsiveDialog
        isOpen={!!selectedNoticeForPrint}
        onClose={() => setSelectedNoticeForPrint(null)}
        title={language === "EN" ? "Official Circular Preview" : "অফিসিয়াল নোটিশ প্যাড"}
        size="xl"
      >
        {selectedNoticeForPrint && (
          <div className="bg-white text-black p-6 sm:p-10 rounded-2xl space-y-6 relative border print:border-none print:shadow-none print:p-0">
            {/* Header / Letterhead */}
            <div className="text-center space-y-1 border-b-2 border-black pb-4">
              <h2 className="text-xl font-black uppercase tracking-wider">{name}</h2>
              <p className="text-xs text-gray-600">{address}</p>
              <p className="text-xs text-gray-600">{phone}</p>
              <p className="text-[10px] font-mono text-gray-500">OFFICIAL CIRCULAR & BULLETIN</p>
            </div>

            {/* Circular Metadata */}
            <div className="flex justify-between items-center text-xs font-semibold pt-2">
              <span>Ref: CIR/{new Date().getFullYear()}/{selectedNoticeForPrint.id.substring(0, 5).toUpperCase()}</span>
              <span>Date: {new Date(selectedNoticeForPrint.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
            </div>

            {/* Title & Body */}
            <div className="space-y-3 pt-2">
              <h3 className="text-base font-bold text-center underline underline-offset-4 uppercase">
                {selectedNoticeForPrint.title}
              </h3>
              <p className="text-xs leading-relaxed whitespace-pre-line text-justify indent-6 font-serif">
                {selectedNoticeForPrint.content}
              </p>
            </div>

            {/* Signature Block */}
            <div className="pt-16 flex justify-between items-end text-xs">
              <div>
                <span className="block border-t border-black pt-1 font-bold">Administrative Officer</span>
                <span className="text-[10px] text-gray-500">Office of General Affairs</span>
              </div>
              <div className="text-right">
                <span className="block border-t border-black pt-1 font-bold">Principal / Head of School</span>
                <span className="text-[10px] text-gray-500">{name}</span>
              </div>
            </div>

            {/* Actions (Hidden on Print) */}
            <div className="flex justify-end gap-3 pt-4 border-t print:hidden">
              <button
                onClick={() => setSelectedNoticeForPrint(null)}
                className="px-4 py-2 rounded-xl text-gray-500 hover:bg-gray-100 text-xs font-semibold"
              >
                {language === "EN" ? "Close" : "বন্ধ করুন"}
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 rounded-xl bg-black text-white hover:opacity-80 text-xs font-semibold flex items-center gap-2"
              >
                <Printer size={14} />
                <span>{language === "EN" ? "Print A4" : "প্রিন্ট করুন (Print A4)"}</span>
              </button>
            </div>
          </div>
        )}
      </ResponsiveDialog>

      {/* 5. Publish Notice Modal (With AI Copilot Assistant) */}
      <ResponsiveDialog
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={language === "EN" ? "Draft & Publish Official Notice" : "নতুন বিজ্ঞপ্তি প্রস্তুত করুন"}
        size="md"
      >
        <div className="space-y-4">
          {/* AI Generator Trigger */}
          <div className="p-3.5 bg-purple-50/60 dark:bg-purple-500/5 border border-purple-200 dark:border-purple-500/10 rounded-2xl space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
              <Sparkles size={12} /> Gemini 2.5 AI Notice Copilot
            </span>
            <div className="flex gap-2">
              <input
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="যেমন: শব-ই-বরাত উপলক্ষে আগামী রবিবার স্কুল ছুটি"
                className="flex-1 px-3 py-2 bg-white dark:bg-black/40 border border-purple-200 dark:border-purple-500/20 rounded-xl text-xs outline-none"
              />
              <button
                type="button"
                disabled={aiDrafting}
                onClick={handleGenerateAIDraft}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
              >
                {aiDrafting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                <span>{language === "EN" ? "Draft" : "ড্রাফট"}</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleCreateNotice} className="space-y-3.5 text-xs">
            <div>
              <label className="font-semibold text-gray-700 dark:text-gray-400">
                {language === "EN" ? "Notice Title *" : "বিজ্ঞপ্তির শিরোনাম *"}
              </label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="যেমন: ঈদুল ফিতর উপলক্ষে বিদ্যালয় বন্ধ সংক্রান্ত বিজ্ঞপ্তি"
                className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none"
              />
            </div>

            <div>
              <label className="font-semibold text-gray-700 dark:text-gray-400">
                {language === "EN" ? "Target Audience" : "টার্গেট অডিয়েন্স"}
              </label>
              <select
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value as any)}
                className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none"
              >
                <option value="ALL">সকলের জন্য (ALL)</option>
                <option value="PARENTS">শুধুমাত্র অভিভাবক (PARENTS)</option>
                <option value="TEACHERS">শুধুমাত্র শিক্ষক (TEACHERS)</option>
                <option value="STUDENTS">শুধুমাত্র শিক্ষার্থী (STUDENTS)</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-gray-700 dark:text-gray-400">
                {language === "EN" ? "Notice Content Details *" : "বিজ্ঞপ্তির বিস্তারিত বিবরণ *"}
              </label>
              <textarea
                required
                rows={5}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="নোটিশের মূল বয়ান এখানে লিখুন..."
                className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none leading-relaxed"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 font-semibold"
              >
                {language === "EN" ? "Cancel" : "বাতিল"}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-2 disabled:opacity-50"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                <span>{language === "EN" ? "Publish Notice" : "প্রকাশ করুন"}</span>
              </button>
            </div>
          </form>
        </div>
      </ResponsiveDialog>

    </div>
  );
}