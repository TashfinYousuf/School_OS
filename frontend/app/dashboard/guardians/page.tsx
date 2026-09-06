"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/providers";
import { 
  Users, Phone, MessageSquare, Search, 
  Send, ExternalLink, Loader2, Sparkles, X 
} from "lucide-react";

interface GuardianItem {
  id: string;
  guardian_name: string;
  phone_number: string;
  relationship: string;
  student_name: string;
  class_name: string;
  roll_number: string;
  admission_number: string;
}

export default function GuardianDirectoryPage() {
  const { language } = useLanguage();
  const [guardians, setGuardians] = useState<GuardianItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState("");

  // Template Modal State
  const [selectedGuardian, setSelectedGuardian] = useState<GuardianItem | null>(null);
  const [messageType, setMessageType] = useState<"absent" | "fee" | "meeting" | "custom">("absent");
  const [customMsg, setCustomMsg] = useState("");

  const classes = ["Play", "Nursery", "KG", "Class 1", "Class 2", "Class 3", "Class 4", "Class 5"];

  const fetchDirectory = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      let url = `http://127.0.0.1:8000/api/v1/guardians/directory?`;
      if (selectedClass) url += `class_name=${encodeURIComponent(selectedClass)}&`;
      if (search) url += `search=${encodeURIComponent(search)}&`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setGuardians(await res.json());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectory();
  }, [selectedClass, search]);

  const getTemplateText = () => {
    if (!selectedGuardian) return "";
    const name = selectedGuardian.student_name;
    const cls = selectedGuardian.class_name;
    
    switch (messageType) {
      case "absent":
        return `আসসালামু আলাইকুম। সম্মানিত অভিভাবক, আপনার সন্তান ${name} (শ্রেণি: ${cls}, আইডি: ${selectedGuardian.admission_number}) আজ বিদ্যালয়ে উপস্থিত নেই। কোনো জরুরি সমস্যা থাকলে বিদ্যালয় কর্তৃপক্ষকে অবহিত করার জন্য অনুরোধ করা হলো। - কিডস শাইন ইন্টারন্যাশনাল স্কুল`;
      case "fee":
        return `আসসালামু আলাইকুম। সম্মানিত অভিভাবক, ${name}-এর চলতি মাসের টিউশন ফি বকেয়া রয়েছে। নির্ধারিত সময়ের মধ্যে ফি পরিশোধ করার জন্য বিনীত অনুরোধ জানাচ্ছি। - কিডস শাইন ইন্টারন্যাশনাল স্কুল`;
      case "meeting":
        return `আসসালামু আলাইকুম। সম্মানিত অভিভাবক, আগামী বৃহস্পতিবার বিদ্যালয়ে অভিভাবক সমাবেশ অনুষ্ঠিত হবে। আপনার উপস্থিতি একান্ত কাম্য। - কিডস শাইন ইন্টারন্যাশনাল স্কুল`;
      case "custom":
        return customMsg;
    }
  };

  const handleOpenWhatsApp = () => {
    if (!selectedGuardian) return;
    let phone = selectedGuardian.phone_number.replace(/\D/g, "");
    if (!phone.startsWith("88")) {
      phone = "88" + phone;
    }
    const text = encodeURIComponent(getTemplateText());
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-white/[0.08] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="text-teal-600 dark:text-teal-400" />
            {language === "EN" ? "Guardian Directory & WhatsApp Hub" : "অভিভাবক ফোনবুক ও মেসেজিং হাব"}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Kids Shine International School • 1-Click WhatsApp messaging for absence, fees, and updates.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl flex items-center px-4 py-2.5 shadow-sm">
          <Search className="text-gray-400 mr-2" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={language === "EN" ? "Search by guardian name, phone, or child..." : "অভিভাবকের নাম, ফোন নম্বর অথবা সন্তানের নাম দিয়ে খুঁজুন..."}
            className="w-full bg-transparent text-sm text-gray-900 dark:text-white outline-none"
          />
        </div>

        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none shadow-sm"
        >
          <option value="">{language === "EN" ? "All Classes" : "সকল শ্রেণি"}</option>
          {classes.map((cls) => (
            <option key={cls} value={cls}>{cls}</option>
          ))}
        </select>
      </div>

      {/* Directory Table */}
      <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-gray-500 flex justify-center items-center gap-2">
            <Loader2 className="animate-spin text-teal-600" size={20} /> Loading phonebook...
          </div>
        ) : guardians.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            No guardian records found.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/[0.05] text-xs font-bold uppercase text-gray-500">
              <tr>
                <th className="p-4">Guardian Name</th>
                <th className="p-4">Phone (WhatsApp)</th>
                <th className="p-4">Relation</th>
                <th className="p-4">Student</th>
                <th className="p-4">Class</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {guardians.map((g) => (
                <tr key={g.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 font-semibold text-gray-900 dark:text-white">{g.guardian_name}</td>
                  <td className="p-4 font-mono text-xs text-gray-600 dark:text-gray-400">
                    <a href={`tel:${g.phone_number}`} className="hover:underline">{g.phone_number}</a>
                  </td>
                  <td className="p-4 text-xs text-gray-500">{g.relationship}</td>
                  <td className="p-4 font-medium text-gray-900 dark:text-white">
                    {g.student_name} <span className="text-xs text-gray-400 font-mono">({g.admission_number})</span>
                  </td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                      {g.class_name}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => {
                        setSelectedGuardian(g);
                        setCustomMsg("");
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-semibold shadow-sm transition-all"
                    >
                      <MessageSquare size={13} /> WhatsApp
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* WhatsApp Message Composer Modal */}
      {selectedGuardian && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-white/10">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <MessageSquare className="text-green-600" size={18} /> Send Message to Guardian
                </h3>
                <p className="text-xs text-gray-500">{selectedGuardian.guardian_name} • {selectedGuardian.phone_number}</p>
              </div>
              <button onClick={() => setSelectedGuardian(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            {/* Quick Templates */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block">Select Institutional Template</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "absent", label: "অনুপস্থিতি (Absence)" },
                  { id: "fee", label: "ফি বকেয়া (Fee Due)" },
                  { id: "meeting", label: "মিটিং (Meeting)" },
                  { id: "custom", label: "কাস্টম বার্তা (Custom)" }
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setMessageType(t.id as any)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-left ${
                      messageType === t.id
                        ? "bg-green-50 dark:bg-green-500/10 border-green-600 text-green-700 dark:text-green-400 font-bold"
                        : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-gray-300"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message Preview */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1 block">Message Content (Editable)</label>
              {messageType === "custom" ? (
                <textarea
                  rows={4}
                  value={customMsg}
                  onChange={(e) => setCustomMsg(e.target.value)}
                  placeholder="Type your message in Bangla..."
                  className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm text-gray-900 dark:text-white outline-none focus:border-green-500 resize-none"
                />
              ) : (
                <div className="p-3 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-800 dark:text-gray-200 leading-relaxed font-sans">
                  {getTemplateText()}
                </div>
              )}
            </div>

            {/* Action */}
            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-white/10">
              <button onClick={() => setSelectedGuardian(null)} className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500">
                Cancel
              </button>
              <button
                onClick={handleOpenWhatsApp}
                className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
              >
                <Send size={14} /> Open WhatsApp Web
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}