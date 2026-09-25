"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/components/providers";
import { safeFetch } from "@/lib/apiClient";
import { 
  BookOpen, Plus, Sparkles, Clock, Printer, 
  CheckCircle2, Loader2, Award, Eye, Trash2,
  FileText, Check, ChevronDown, ChevronUp, ArrowLeft
} from "lucide-react";
import Link from "next/link";

interface QuestionDraftItem {
  id: string;
  question: string;
  options: string[];
  correct_option: string;
  explanation: string;
}

interface FullPaperDraft {
  id: string;
  title: string;
  total_marks: number;
  duration_minutes: number;
  institution_name: string;
  campus_address: string;
  created_at: string;
  questions: QuestionDraftItem[];
}

interface SavedPaperSummary {
  id: string;
  title: string;
  total_marks: number;
  duration_minutes: number;
  total_questions: number;
  created_at: string;
  sample_question: string;
}

export default function QuestionBankStudioPage() {
  const { language } = useLanguage();
  const [savedPapers, setSavedPapers] = useState<SavedPaperSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [activeDraft, setActiveDraft] = useState<FullPaperDraft | null>(null);
  const [loadingSingle, setLoadingSingle] = useState(false);

  // Generator Form State
  const [isGenerating, setIsGenerating] = useState(false);
  const [subject, setSubject] = useState("Physics 1st Paper (পদার্থবিজ্ঞান ১ম পত্র)");
  const [topic, setTopic] = useState("নিউটনিয়ান বলবিদ্যা ও কাজ শক্তি ক্ষমতা");
  const [standard, setStandard] = useState("Engineering Admission (Udvash Style)");
  const [questionCount, setQuestionCount] = useState("5");
  const [duration, setDuration] = useState("15");

  // Preview Settings
  const [showAnswerKey, setShowAnswerKey] = useState(true);

  const fetchSavedPapers = async () => {
    setLoadingList(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await safeFetch<SavedPaperSummary[]>("http://127.0.0.1:8000/api/v1/question-papers/", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data) setSavedPapers(data);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchSavedPapers();
  }, []);

  const handleGenerateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/question-papers/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          subject,
          topic,
          difficulty: standard,
          question_count: parseInt(questionCount),
          duration_minutes: parseInt(duration)
        })
      });

      if (res.ok) {
        const data = await res.json();
        setActiveDraft(data);
        fetchSavedPapers();
      } else {
        alert("Failed to generate draft. Please check backend connection.");
      }
    } catch (err) {
      alert("Error contacting Question Generator API.");
    } finally {
      setIsGenerating(false);
    }
  };

  const loadSavedPaperDraft = async (paperId: string) => {
    setLoadingSingle(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://127.0.0.1:8000/api/v1/question-papers/${paperId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveDraft(data);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } finally {
      setLoadingSingle(false);
    }
  };

  const handleDeletePaper = async (paperId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this question draft?")) return;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://127.0.0.1:8000/api/v1/question-papers/${paperId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        if (activeDraft?.id === paperId) setActiveDraft(null);
        fetchSavedPapers();
      }
    } catch {
      alert("Failed to delete paper.");
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-in fade-in duration-300 print:max-w-full">
      
      {/* Header (Screen View) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-white/10 pb-5 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <BookOpen className="text-blue-600 dark:text-purple-400" size={26} />
            <span>{language === "EN" ? "Question Bank & Exam Paper Studio" : "প্রশ্ন ব্যাংক ও প্রশ্নপত্র প্রণয়ন স্টুডিও"}</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Udvash / Retina admission standard question generator and official A4 paper builder.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link 
            href="/dashboard/live-exams"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
          >
            <span>Go to Live Exam Portal</span>
          </Link>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. INTERACTIVE QUESTION DRAFT BUILDER (Screen View)                       */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 shadow-sm space-y-4 print:hidden">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-white/5">
          <Sparkles className="text-purple-600 dark:text-purple-400" size={18} />
          <h3 className="font-bold text-sm text-gray-900 dark:text-white">
            {language === "EN" ? "Draft New Examination Paper" : "নতুন প্রশ্নপত্র প্রস্তুত করুন"}
          </h3>
        </div>

        <form onSubmit={handleGenerateDraft} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-gray-700 dark:text-gray-300">Coaching / Board Standard</label>
              <select
                value={standard}
                onChange={(e) => setStandard(e.target.value)}
                className="w-full mt-1.5 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-semibold text-gray-900 dark:text-white"
              >
                <option value="Engineering Admission (Udvash Style)">Engineering Admission (Udvash Style)</option>
                <option value="Medical Admission (Retina Style)">Medical Admission (Retina Style)</option>
                <option value="Varsity 'KA' Admission (Focus Style)">Varsity 'KA' Admission (Focus Style)</option>
                <option value="HSC Board Final Examination">HSC Board Final Examination</option>
                <option value="School Terminal Assessment (NCTB)">School Terminal Assessment (NCTB)</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-gray-700 dark:text-gray-300">Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full mt-1.5 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-semibold text-gray-900 dark:text-white"
              >
                <option value="Physics 1st Paper (পদার্থবিজ্ঞান ১ম পত্র)">Physics 1st Paper (পদার্থবিজ্ঞান ১ম পত্র)</option>
                <option value="Physics 2nd Paper (পদার্থবিজ্ঞান ২য় পত্র)">Physics 2nd Paper (পদার্থবিজ্ঞান ২য় পত্র)</option>
                <option value="Chemistry 1st Paper (রসায়ন ১ম পত্র)">Chemistry 1st Paper (রসায়ন ১ম পত্র)</option>
                <option value="Chemistry 2nd Paper (রসায়ন ২য় পত্র)">Chemistry 2nd Paper (রসায়ন ২য় পত্র)</option>
                <option value="Higher Math 1st Paper (উচ্চতর গণিত ১ম পত্র)">Higher Math 1st Paper (উচ্চতর গণিত ১ম পত্র)</option>
                <option value="Biology 1st Paper (উদ্ভিদবিজ্ঞান)">Biology 1st Paper (উদ্ভিদবিজ্ঞান)</option>
                <option value="General Science (প্রাথমিক ও মাধ্যমিক)">General Science (প্রাথমিক ও মাধ্যমিক)</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-gray-700 dark:text-gray-300">Chapter / Specific Topic *</label>
              <input
                required
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. ভেক্টর ও গতিবিদ্যা, মহাকর্ষ"
                className="w-full mt-1.5 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="font-semibold text-gray-700 dark:text-gray-300">Question Count</label>
              <select
                value={questionCount}
                onChange={(e) => setQuestionCount(e.target.value)}
                className="w-full mt-1.5 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-mono text-gray-900 dark:text-white"
              >
                <option value="4">4 Questions (Daily Flash Test)</option>
                <option value="5">5 Questions (Standard Practice)</option>
                <option value="10">10 Questions (Model Exam)</option>
                <option value="20">20 Questions (Admission Test)</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-gray-700 dark:text-gray-300">Time (Minutes)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full mt-1.5 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-mono text-gray-900 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={isGenerating}
                className="w-full sm:w-auto px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
              >
                {isGenerating ? <Loader2 className="animate-spin" size={15} /> : <Sparkles size={15} />}
                <span>{isGenerating ? "Generating Questions..." : "Generate Question Draft"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* 2. LIVE GENERATED QUESTION PAPER PREVIEW & PRINTABLE A4 PAD               */}
      {/* ========================================================================= */}
      {activeDraft && (
        <div className="space-y-4">
          
          {/* Controls Bar (Screen Only) */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl print:hidden">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-xs text-gray-900 dark:text-white">Live Paper Preview Ready</span>
              <span className="text-xs text-gray-400">({activeDraft.questions.length} Questions)</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAnswerKey(!showAnswerKey)}
                className="px-3.5 py-1.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5 transition-all"
              >
                <CheckCircle2 className={showAnswerKey ? "text-emerald-500" : "text-gray-400"} size={14} />
                <span>{showAnswerKey ? "Hide Solutions" : "Show Answer Key"}</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-1.5 bg-black dark:bg-white text-white dark:text-black hover:opacity-80 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              >
                <Printer size={14} />
                <span>Print Official A4 Paper</span>
              </button>
            </div>
          </div>

          {/* Official Printable Question Paper Body */}
          <div className="bg-white text-black p-8 sm:p-12 rounded-3xl border-2 border-black shadow-lg space-y-6 print:border-none print:shadow-none print:p-0">
            
            {/* Header / Institutional Pad */}
            <div className="text-center space-y-1 border-b-2 border-black pb-4">
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider">
                {activeDraft.institution_name}
              </h2>
              <p className="text-xs text-gray-700 font-serif">
                {activeDraft.campus_address}
              </p>
              <div className="pt-2">
                <span className="font-sans font-bold uppercase text-[11px] bg-black text-white px-4 py-0.5 inline-block rounded">
                  Official Academic Assessment Examination
                </span>
              </div>
            </div>

            {/* Exam Meta & Student Signature Lines */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs font-mono border-b border-gray-400 pb-3 gap-2">
              <div className="space-y-0.5">
                <div>Paper: <strong>{activeDraft.title}</strong></div>
                <div>Date: {activeDraft.created_at}</div>
              </div>
              <div className="text-right space-y-0.5">
                <div>Time Allowed: <strong>{activeDraft.duration_minutes} Minutes</strong></div>
                <div>Full Marks: <strong>{activeDraft.total_marks}</strong></div>
              </div>
            </div>

            {/* Instructions */}
            <div className="text-[11px] text-gray-600 italic bg-gray-50 p-2.5 border border-gray-200 rounded-lg">
              Instructions: Answer all questions. Each question carries equal marks. Choose the single best answer.
            </div>

            {/* Questions List */}
            <div className="space-y-6 pt-2">
              {activeDraft.questions.map((q: QuestionDraftItem, idx: number) => (
                <div key={q.id || idx} className="space-y-2.5 text-xs sm:text-sm">
                  <div className="font-semibold text-gray-900 leading-relaxed flex items-start gap-2">
                    <span className="font-mono font-bold">{idx + 1}.</span>
                    <span>{q.question}</span>
                  </div>

                  {/* 4 Options Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-5">
                    {q.options.map((opt: string, optIdx: number) => {
                      const label = String.fromCharCode(65 + optIdx);
                      const isCorrect = showAnswerKey && (opt === q.correct_option || opt.startsWith(q.correct_option));

                      return (
                        <div
                          key={opt}
                          className={`p-2 rounded-lg border flex items-center gap-2 ${
                            isCorrect 
                              ? "bg-emerald-50 border-emerald-500 font-bold text-emerald-800" 
                              : "border-gray-200 text-gray-800"
                          }`}
                        >
                          <span className="w-5 h-5 rounded-md bg-gray-100 flex items-center justify-center font-mono font-bold text-[10px] shrink-0">
                            {label}
                          </span>
                          <span>{opt}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Solution & Explanation Block */}
                  {showAnswerKey && q.explanation && (
                    <div className="ml-5 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-900 font-serif leading-relaxed">
                      <strong>Solution & Key:</strong> {q.correct_option} — {q.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Teacher Sign-off Footer */}
            <div className="pt-12 flex justify-between items-end text-xs font-serif border-t border-gray-300">
              <div className="text-center">
                <div className="w-32 border-t border-black mb-1"></div>
                <span>Subject Teacher</span>
              </div>
              <div className="text-center">
                <div className="w-32 border-t border-black mb-1"></div>
                <span>Academic Coordinator</span>
              </div>
              <div className="text-center">
                <div className="w-32 border-t border-black mb-1"></div>
                <span>Principal / Head of Exam</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SAVED QUESTION PAPERS ARCHIVE (Screen View)                            */}
      {/* ========================================================================= */}
      <div className="space-y-4 print:hidden">
        <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-gray-400">
          <span>Saved Question Papers Registry</span>
          <span>{savedPapers.length} Papers Archived</span>
        </div>

        {loadingList ? (
          <div className="p-10 text-center text-gray-400 flex items-center justify-center gap-2">
            <Loader2 className="animate-spin text-purple-600" size={20} />
            <span>আর্কাইভ লোড হচ্ছে...</span>
          </div>
        ) : savedPapers.length === 0 ? (
          <div className="p-10 text-center bg-white dark:bg-[#0f0f11] rounded-3xl border border-gray-200 dark:border-white/10 text-xs text-gray-400">
            কোনো সংরক্ষিত প্রশ্নপত্র নেই। উপরের ফর্ম দিয়ে প্রথম ড্রাফট তৈরি করুন।
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {savedPapers.map((paper: SavedPaperSummary) => (
              <div
                key={paper.id}
                onClick={() => loadSavedPaperDraft(paper.id)}
                className={`p-5 bg-white dark:bg-[#0f0f11] border rounded-3xl shadow-sm transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                  activeDraft?.id === paper.id 
                    ? "border-purple-600 ring-2 ring-purple-500/20" 
                    : "border-gray-200 dark:border-white/10 hover:border-purple-500/40"
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-mono text-gray-400">{paper.created_at}</span>
                    <button
                      onClick={(e) => handleDeletePaper(paper.id, e)}
                      className="text-gray-400 hover:text-red-500 p-1"
                      title="Delete Draft"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white leading-snug">{paper.title}</h4>
                  <p className="text-xs text-gray-500 line-clamp-1 italic">
                    "{paper.sample_question}"
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100 dark:border-white/5">
                  <span>{paper.total_questions} Questions • {paper.duration_minutes} Mins</span>
                  <span className="text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-1">
                    <Eye size={13} /> View Paper
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}