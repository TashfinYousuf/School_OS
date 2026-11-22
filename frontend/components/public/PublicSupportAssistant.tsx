"use client";

import React, { useState } from "react";
import Link from "next/link";
import { MessageSquare, X, Send, Sparkles, BookOpen, ExternalLink, ShieldCheck, AlertCircle } from "lucide-react";

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  content: string;
  link?: { href: string; label: string };
  timestamp: string;
}

// Pre-indexed public documentation knowledge base (Safe, client-side verified)
const PUBLIC_DOCS_KNOWLEDGE: { keywords: string[]; answer: string; link?: { href: string; label: string } }[] = [
  {
    keywords: ["nctb", "grading", "curriculum", "marks", "result"],
    answer: "EducationOS features a built-in NCTB (National Curriculum and Textbook Board) pass/fail and 7-tier GPA grading engine. Teachers can input marks via web or voice diary, and print official A4 report cards instantly.",
    link: { href: "/features", label: "Explore Grading Features" }
  },
  {
    keywords: ["attendance", "biometric", "roll call", "whatsapp", "sms"],
    answer: "Attendance can be marked via 1-tap web roll call, barcode/RFID, or mobile. Automated attendance alerts are dispatched to parents via WhatsApp or SMS, and works completely offline during network outages.",
    link: { href: "/features", label: "View Attendance Modules" }
  },
  {
    keywords: ["price", "cost", "pricing", "plan", "fee", "bdt", "discount"],
    answer: "EducationOS offers transparent monthly and annual plans starting at ৳990/mo for School Starter (up to 100 students). Annual plans receive 2 months free (12 months for the price of 10).",
    link: { href: "/pricing", label: "View Pricing Matrix & Calculator" }
  },
  {
    keywords: ["offline", "sync", "pwa", "internet", "network"],
    answer: "EducationOS is an offline-first Progressive Web App (PWA). Teachers can take attendance and record grades even with zero cellular connectivity. Mutations are queued in IndexedDB and automatically synchronized when connectivity returns.",
    link: { href: "/technology", label: "Read Offline Architecture" }
  },
  {
    keywords: ["security", "rls", "privacy", "data", "backup"],
    answer: "Data privacy is enforced by native PostgreSQL Row Level Security (RLS) at the database kernel level. EducationOS enforces zero third-party ad tracking, does not sell student data, and complies with Bangladesh ICT regulations.",
    link: { href: "/security", label: "View Security Architecture" }
  },
  {
    keywords: ["trial", "free", "onboard", "signup", "start"],
    answer: "You can start a 30-day free trial without a credit card. Onboarding takes less than 15 minutes to configure your institution profile and import your student roster.",
    link: { href: "/onboard", label: "Start 30-Day Free Trial" }
  },
  {
    keywords: ["omr", "scanner", "camera", "mcq"],
    answer: "The Camera OMR Sheet Scanner allows teachers to scan physical MCQ exam sheets using a standard smartphone camera, grading 50 questions in under 2 seconds with automatic error detection.",
    link: { href: "/features", label: "View OMR Capabilities" }
  },
  {
    keywords: ["ticket", "support", "help", "contact", "human"],
    answer: "Official support ticket submission will activate in Stage 12.8 when the dedicated agent portal launches. For enterprise inquiries, please visit our contact page or email contact@schoolos.app.",
    link: { href: "/contact", label: "Contact Enterprise Support" }
  }
];

export default function PublicSupportAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "initial",
      sender: "assistant",
      content: "Hello! I am the EducationOS Public Documentation Assistant. Ask me anything about our features, NCTB grading, pricing, offline synchronization, or security architecture.",
      timestamp: "Just now"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const query = input.trim();
    if (!query) return;

    // Sanitize query to prevent prompt injection or script injection
    const cleanQuery = query.replace(/[<>]/g, "");

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: "user",
      content: cleanQuery,
      timestamp: "Just now"
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    setTimeout(() => {
      const lower = cleanQuery.toLowerCase();

      // Check if user is asking for private/tenant data or attempting unauthorized actions
      if (
        lower.includes("student record") ||
        lower.includes("database") ||
        lower.includes("sql") ||
        lower.includes("password") ||
        lower.includes("refund me") ||
        lower.includes("change plan")
      ) {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            sender: "assistant",
            content: "As a sandboxed public documentation assistant, I do not have access to institutional databases, student records, private accounts, or financial transactions. For account actions, please log in to your institutional dashboard or contact enterprise support.",
            link: { href: "/contact", label: "Contact Support" },
            timestamp: "Just now"
          }
        ]);
        setLoading(false);
        return;
      }

      // Match against approved public knowledge base
      const matched = PUBLIC_DOCS_KNOWLEDGE.find((item) =>
        item.keywords.some((kw) => lower.includes(kw))
      );

      if (matched) {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            sender: "assistant",
            content: matched.answer,
            link: matched.link,
            timestamp: "Just now"
          }
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            sender: "assistant",
            content: "I could not find a specific public documentation article matching your query. You can explore our comprehensive feature catalog, review our pricing plans, or contact our team for a personalized demo.",
            link: { href: "/docs", label: "Browse Documentation" },
            timestamp: "Just now"
          }
        ]);
      }

      setLoading(false);
    }, 400);
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 font-sans">
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2.5 px-5 py-3.5 rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold text-sm shadow-2xl shadow-indigo-600/40 hover:scale-105 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400"
          aria-label="Open Public Documentation Assistant"
        >
          <Sparkles size={16} className="text-indigo-200" />
          <span>Ask EducationOS AI</span>
        </button>
      )}

      {/* Chat Window Dialog */}
      {isOpen && (
        <div className="w-[360px] sm:w-[420px] h-[420px] bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
          {/* Header */}
          <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <BookOpen size={16} />
              </div>
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>AI Assistant</span>
                  <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Public
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">Customer Support Only</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Close Assistant"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] p-3.5 rounded-2xl leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-indigo-600 text-white rounded-br-none"
                      : "bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none"
                  }`}
                >
                  <p>{msg.content}</p>
                  {msg.link && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800">
                      <Link
                        href={msg.link.href}
                        className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-semibold"
                        onClick={() => setIsOpen(false)}
                      >
                        <span>{msg.link.label}</span>
                        <ExternalLink size={11} />
                      </Link>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 px-1 mt-1">{msg.timestamp}</span>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs italic p-2">
                <Sparkles size={13} className="animate-spin text-indigo-400" />
                <span>Searching public documentation...</span>
              </div>
            )}
          </div>

          {/* Input Bar */}
          <form onSubmit={handleSend} className="p-3 bg-slate-900/80 border-t border-slate-800 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about pricing, NCTB grading, offline..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              maxLength={200}
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="p-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 transition-colors"
              aria-label="Send message"
            >
              <Send size={15} />
            </button>
          </form>

          {/* Security Notice */}
          <div className="px-3 py-1.5 bg-slate-950 text-[10px] text-slate-400 text-center border-t border-slate-900 flex items-center justify-center gap-1">
            <ShieldCheck size={11} className="text-emerald-400" />
            <span>Secured EducationOS Customer Support</span>
          </div>
        </div>
      )}
    </div>
  );
}

