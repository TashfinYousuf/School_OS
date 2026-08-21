"use client";

import { useEffect, useState } from "react";
import { MessageSquare, MessageCircle, Globe, ShieldAlert, CheckCircle2, Edit3, Send, Loader2, Bot } from "lucide-react";
import { useLanguage } from "@/components/providers";

export default function CommunicationOSPage() {
  const { language } = useLanguage();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMsg, setSelectedMsg] = useState<any | null>(null);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/communication/inbox", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setMessages(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const simulateIncoming = async () => {
    const token = localStorage.getItem("token");
    await fetch("http://127.0.0.1:8000/api/v1/communication/demo-webhook", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
    fetchMessages();
  };

  useEffect(() => { fetchMessages(); }, []);

  const getChannelIcon = (channel: string) => {
    if (channel === "WhatsApp") return <MessageCircle size={16} className="text-green-500" />;
    if (channel === "Website") return <Globe size={16} className="text-blue-500" />;
    return <MessageSquare size={16} className="text-gray-500" />;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-8rem)] flex flex-col">
      
      <div className="flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            {language === "EN" ? "Unified Inbox" : "ইউনিফাইড ইনবক্স"}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {language === "EN" ? "Manage omni-channel communications with AI guardrails." : "এআই গার্ডরেল সহ অমনি-চ্যানেল যোগাযোগ পরিচালনা করুন।"}
          </p>
        </div>
        <button onClick={simulateIncoming} className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-sm">
          + Simulate Message
        </button>
      </div>

      <div className="flex-1 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/[0.08] rounded-3xl shadow-sm flex overflow-hidden">
        
        {/* Left: Chat List */}
        <div className="w-1/3 border-r border-gray-200 dark:border-white/10 flex flex-col bg-gray-50/50 dark:bg-black/20">
          <div className="p-4 border-b border-gray-200 dark:border-white/10 shrink-0">
            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {language === "EN" ? "Active Queries" : "সক্রিয় প্রশ্নাবলী"}
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {loading ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-500" /></div>
            ) : messages.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">Inbox is empty.</div>
            ) : (
              messages.map((msg) => (
                <div 
                  key={msg.id} 
                  onClick={() => setSelectedMsg(msg)}
                  className={`p-4 rounded-2xl cursor-pointer transition-all border ${
                    selectedMsg?.id === msg.id 
                      ? "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30" 
                      : "bg-transparent border-transparent hover:bg-gray-100 dark:hover:bg-white/5"
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-2">
                      {getChannelIcon(msg.channel)}
                      <span className="font-semibold text-sm text-gray-900 dark:text-white">{msg.sender_info}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-1">{msg.content}</p>
                  {msg.risk_level === "High" && (
                    <span className="inline-flex mt-2 items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 uppercase border border-red-100 dark:border-red-500/20">
                      <ShieldAlert size={10} /> Escalated
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Chat View & AI Guardrail */}
        <div className="flex-1 flex flex-col bg-white dark:bg-transparent relative">
          {selectedMsg ? (
            <>
              {/* Message Thread */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                
                <div className="flex flex-col items-start max-w-[80%]">
                  <span className="text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">{selectedMsg.sender_info} ({selectedMsg.channel})</span>
                  <div className="bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white p-4 rounded-2xl rounded-tl-sm text-sm leading-relaxed border border-gray-200 dark:border-white/5 shadow-sm">
                    {selectedMsg.content}
                  </div>
                </div>

                {/* AI Draft Block */}
                {selectedMsg.ai_draft && (
                  <div className="flex flex-col items-end max-w-[80%] ml-auto mt-8">
                    <span className="flex items-center gap-1 text-[10px] font-bold text-purple-500 uppercase mb-1 mr-1">
                      <Bot size={12} /> AI Draft (Awaiting Approval)
                    </span>
                    <div className="bg-purple-50 dark:bg-purple-500/10 text-purple-900 dark:text-purple-100 p-4 rounded-2xl rounded-tr-sm text-sm leading-relaxed border border-purple-200 dark:border-purple-500/20 shadow-sm relative group">
                      {selectedMsg.ai_draft}
                      <button className="absolute top-2 right-2 p-1.5 bg-white dark:bg-black/40 rounded-lg text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                        <Edit3 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Bar (Guardrail) */}
              <div className="p-4 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 shrink-0">
                {selectedMsg.risk_level === "High" ? (
                  <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-xl">
                    <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400 font-medium">
                      <ShieldAlert size={18} /> High-Risk Intent Detected. Manual intervention required.
                    </div>
                    <div className="flex gap-2">
                      <button className="px-4 py-2 bg-white dark:bg-[#111] text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">Edit</button>
                      <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2">
                        <Send size={14} /> Send Reply
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input type="text" placeholder="Type a custom reply..." className="flex-1 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-xl px-4 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 transition-colors" />
                    <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-colors">
                      <Send size={18} />
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <MessageSquare size={48} className="mb-4 opacity-20" />
              <p>{language === "EN" ? "Select a conversation to view the thread." : "থ্রেড দেখতে একটি কথোপকথন নির্বাচন করুন।"}</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}