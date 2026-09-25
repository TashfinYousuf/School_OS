"use client";

import { useState } from "react";
import { useLanguage } from "@/components/providers";
import { 
  HelpCircle, Sparkles, Send, Loader2, 
  Lightbulb, BrainCircuit, BookOpen 
} from "lucide-react";

export default function SocraticDoubtSolverPage() {
  const { language } = useLanguage();
  const [subject, setSubject] = useState("Mathematics");
  const [problemText, setProblemText] = useState("");
  const [studentStep, setStudentStep] = useState("");
  const [loading, setLoading] = useState(false);
  const [guidance, setGuidance] = useState<string | null>(null);

  const handleAskSocraticTutor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!problemText.trim()) return;

    setLoading(true);
    setGuidance(null);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/learning-os/socratic-solve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          student_name: localStorage.getItem("user_name") || "Student",
          subject,
          problem_text: problemText,
          student_previous_step: studentStep
        })
      });

      if (res.ok) {
        const data = await res.json();
        setGuidance(data.socratic_guidance);
      } else {
        alert("Unable to reach Socratic Tutor API.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-white/10 pb-5">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
            <BrainCircuit size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {language === "EN" ? "Socratic AI Study Studio" : "সক্রেটিক এআই প্রবলেম সলভার"}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {language === "EN" 
                ? "Teach, don't just answer — Step-by-step mathematical reasoning guided by AI." 
                : "সরাসরি উত্তর নয়, ধাপে ধাপে চিন্তা করে সঠিক সমাধানে পৌঁছানোর এআই স্টুডিও।"}
            </p>
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 shadow-sm space-y-4">
        <form onSubmit={handleAskSocraticTutor} className="space-y-4 text-xs">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-gray-700 dark:text-gray-300">Subject / Course</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full mt-1.5 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white outline-none font-semibold"
              >
                <option value="Mathematics">Higher Mathematics (উচ্চতর গণিত)</option>
                <option value="Physics">Physics (পদার্থবিজ্ঞান)</option>
                <option value="Chemistry">Chemistry (রসায়ন)</option>
                <option value="General Math">General Mathematics (সাধারণ গণিত)</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-gray-700 dark:text-gray-300">Pedagogical Mode</label>
              <div className="mt-1.5 p-2.5 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 rounded-xl font-semibold flex items-center gap-1.5">
                <Sparkles size={14} /> Socratic Active Guided Mentor
              </div>
            </div>
          </div>

          <div>
            <label className="font-semibold text-gray-700 dark:text-gray-300">Problem Statement / Question *</label>
            <textarea
              required
              rows={3}
              value={problemText}
              onChange={(e) => setProblemText(e.target.value)}
              placeholder="e.g. Solve the equation: 2x^2 - 5x + 2 = 0, or paste your physics problem..."
              className="w-full mt-1.5 p-3 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none leading-relaxed text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="font-semibold text-gray-700 dark:text-gray-300">What step did you try or get stuck on? (Optional)</label>
            <input
              value={studentStep}
              onChange={(e) => setStudentStep(e.target.value)}
              placeholder="e.g. I found the discriminant is 9, but don't know how to factorize..."
              className="w-full mt-1.5 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none text-gray-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading || !problemText.trim()}
              className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              <span>{language === "EN" ? "Ask Socratic Mentor" : "সমাধানের ধাপ জানুন"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Tutor Response */}
      {guidance && (
        <div className="bg-gradient-to-r from-purple-500/10 via-blue-500/5 to-transparent border border-purple-200 dark:border-purple-500/20 rounded-3xl p-6 shadow-sm space-y-3 animate-in fade-in duration-300">
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold text-sm">
            <Lightbulb size={18} />
            <span>Socratic Mentor Guidance</span>
          </div>
          <div className="text-xs sm:text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-line font-serif">
            {guidance}
          </div>
        </div>
      )}

    </div>
  );
}