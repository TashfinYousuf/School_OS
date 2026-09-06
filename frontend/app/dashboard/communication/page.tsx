"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/providers";
import { 
  MessageSquare, ShieldAlert, CheckCircle2, 
  Send, RefreshCw, Loader2, User, ExternalLink, Sparkles 
} from "lucide-react";

interface InboxMessage {
  id: string;
  channel: string;
  sender_info: string;
  content: string;
  intent: string;
  ai_draft: string;
  risk_level: string;
  status: string;
  created_at: string;
  student_meta: string;
}

export default function UnifiedInboxPage() {
  const { language } = useLanguage();
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [selectedMsg, setSelectedMsg] = useState<InboxMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const fetchInbox = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/communication/inbox", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
        if (data.length > 0 && !selectedMsg) {
          setSelectedMsg(data[0]);
          setReplyText(data[0].ai_draft || "");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInbox();
    // 10-second live polling for new inbound messages
    const interval = setInterval(fetchInbox, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectThread = (m: InboxMessage) => {
    setSelectedMsg(m);
    setReplyText(m.ai_draft || "");
  };

  const handleSendReply = async () => {
    if (!selectedMsg || !replyText.trim()) return;
    setSending(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://127.0.0.1:8000/api/v1/communication/${selectedMsg.id}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reply_content: replyText })
      });

      if (res.ok) {
        fetchInbox();
        setSelectedMsg(prev => prev ? { ...prev, status: "Resolved", risk_level: "Low", ai_draft: replyText } : null);
      }
    } finally {
      setSending(false);
    }
  };

  const handleOpenWhatsAppDirect = () => {
    if (!selectedMsg) return;
    const phoneMatch = selectedMsg.sender_info.match(/\d{10,14}/);
    if (!phoneMatch) return;
    let phone = phoneMatch[0];
    if (!phone.startsWith("88")) phone = "88" + phone;
    const text = encodeURIComponent(replyText);
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex justify-between items-center border-b border-gray-200 dark:border-white/10 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2.5">
            <MessageSquare className="text-green-600 dark:text-green-400" />
            <span>{language === "EN" ? "Unified Guardian Inbox" : "অভিভাবক মেসেজিং ও ইনবক্স হাব"}</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">Live WhatsApp & SMS queue with Gemini 2.5 intent triage & safety guardrails.</p>
        </div>

        <button
          onClick={fetchInbox}
          className="p-2.5 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300 transition-colors"
          title="Refresh Inbox"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[72vh]">
        
        {/* Thread List (Left Pane) */}
        <div className="lg:col-span-5 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-4 overflow-y-auto custom-scrollbar flex flex-col gap-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-2 py-1">
            Active Queries ({messages.length})
          </div>

          {loading && messages.length === 0 ? (
            <div className="p-12 text-center text-gray-400 flex items-center justify-center gap-2">
              <Loader2 className="animate-spin text-green-600" size={18} /> Syncing messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-xs">No active guardian messages in queue.</div>
          ) : (
            messages.map((m) => (
              <button
                key={m.id}
                onClick={() => handleSelectThread(m)}
                className={`p-4 rounded-2xl text-left transition-all border ${
                  selectedMsg?.id === m.id
                    ? "bg-green-50/50 dark:bg-green-500/10 border-green-500/40 shadow-sm"
                    : "border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold text-xs text-gray-900 dark:text-white truncate max-w-[180px]">
                    {m.sender_info}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    m.risk_level === "High" ? "bg-red-50 text-red-600 dark:bg-red-500/10" :
                    m.status === "Resolved" ? "bg-green-50 text-green-600 dark:bg-green-500/10" :
                    "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300"
                  }`}>
                    {m.status}
                  </span>
                </div>

                <div className="text-[11px] text-gray-500 font-medium truncate mb-1">
                  {m.student_meta}
                </div>

                <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2 leading-relaxed">
                  {m.content}
                </p>
              </button>
            ))
          )}
        </div>

        {/* Conversation & AI Action Center (Right Pane) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 flex flex-col justify-between overflow-hidden shadow-sm">
          {selectedMsg ? (
            <div className="h-full flex flex-col justify-between space-y-4">
              
              {/* Top Details */}
              <div className="border-b border-gray-100 dark:border-white/10 pb-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white">{selectedMsg.sender_info}</h3>
                    <p className="text-xs text-blue-600 dark:text-purple-400 mt-0.5">{selectedMsg.student_meta}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-mono px-2 py-1 bg-gray-100 dark:bg-white/10 rounded text-gray-600 dark:text-gray-300">
                      Intent: {selectedMsg.intent || "General"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Guardian's Incoming Message */}
              <div className="p-4 bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-2xl">
                <span className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Guardian's Query</span>
                <p className="text-xs text-gray-900 dark:text-gray-100 leading-relaxed font-sans">
                  {selectedMsg.content}
                </p>
              </div>

              {/* AI Guardrail Alert */}
              {selectedMsg.risk_level === "High" && (
                <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-700 dark:text-red-400 text-xs flex items-center gap-2">
                  <ShieldAlert size={16} className="shrink-0" />
                  <span>High-Risk Intent detected (Complaint/Escalation). Review AI draft before dispatching.</span>
                </div>
              )}

              {/* Editable Response Area */}
              <div className="space-y-2 flex-1 flex flex-col justify-end">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                    <Sparkles size={14} /> AI Recommended Institutional Reply (Bangla)
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-2xl p-3 text-xs text-gray-900 dark:text-white outline-none focus:border-green-500 resize-none leading-relaxed font-sans"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-white/10">
                <button
                  type="button"
                  onClick={handleOpenWhatsAppDirect}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-1.5 text-gray-700 dark:text-gray-300 transition-colors"
                >
                  <ExternalLink size={13} /> Open WhatsApp Web
                </button>
                <button
                  onClick={handleSendReply}
                  disabled={sending || !replyText.trim()}
                  className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-all"
                >
                  {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  Mark Resolved & Log Reply
                </button>
              </div>

            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <MessageSquare size={36} className="opacity-20 mb-2" />
              <p className="text-xs">Select an incoming thread from the left to view and respond.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}