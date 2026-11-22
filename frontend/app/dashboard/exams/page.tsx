"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/components/providers";
import { useWorkspace } from "@/lib/workspaceContext";
import { safeFetch, fetchWithTenant } from "@/lib/api-client";
import { 
  BookOpen, Sparkles, Clock, Printer, 
  CheckCircle2, Loader2, Trash2, Eye, School, GraduationCap
} from "lucide-react";
import Link from "next/link";
import { useInstitution } from "@/lib/institution";
import { useAcademicClasses } from "@/lib/useAcademicClasses";

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
  const { name } = useInstitution();
  const { classNames: availableClasses } = useAcademicClasses();
  const { currentWorkspace } = useWorkspace();
  const isAcademy = currentWorkspace?.type === "academy";

  const [savedPapers, setSavedPapers] = useState<SavedPaperSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [activeDraft, setActiveDraft] = useState<FullPaperDraft | null>(null);

  // Generator Form States (Separate Class, Subject, and Chapter)
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // 1. Class / Program Target
  const [targetClass, setTargetClass] = useState(isAcademy ? "HSC Care '26" : "Class 5");

  // 2. Exam Type / Assessment Standard
  const [assessmentType, setAssessmentType] = useState(
    isAcademy ? "Engineering Admission Standard (Coaching Model)" : "NCTB Annual Assessment (বার্ষিক মূল্যায়ন)"
  );

  // 3. Subject (Custom typeable + suggestions)
  const [subject, setSubject] = useState(
    isAcademy ? "Physics 1st Paper" : "Elementary Mathematics (প্রাথমিক গণিত)"
  );

  // 4. Chapter / Specific Topic
  const [topic, setTopic] = useState("");

  // 5. Questions & Duration
  const [questionCount, setQuestionCount] = useState("5");
  const [duration, setDuration] = useState("15");

  const [showAnswerKey, setShowAnswerKey] = useState(true);

  // Dynamic Workspace State Reset
  useEffect(() => {
    if (isAcademy) {
      setTargetClass("HSC Care '26");
      setAssessmentType("Engineering Admission Standard (Coaching Model)");
      setSubject("Physics 1st Paper");
      setTopic("");
    } else {
      setTargetClass("Class 5");
      setAssessmentType("NCTB Annual Assessment (বার্ষিক মূল্যায়ন)");
      setSubject("Elementary Mathematics (প্রাথমিক গণিত)");
      setTopic("");
    }
  }, [isAcademy]);

  const fetchSavedPapers = async () => {
    setLoadingList(true);
    try {
      const { data } = await safeFetch<SavedPaperSummary[]>("/api/v1/question-papers/");
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
    setGenerationError(null);

    const programContext = `${targetClass} • ${assessmentType}`;

    try {
      const res = await fetchWithTenant("/api/v1/question-papers/generate", {
        method: "POST",
        body: JSON.stringify({
          subject: subject.trim(),
          topic: topic.trim() || "General Syllabus Assessment",
          difficulty: assessmentType,
          class_name: targetClass,
          program_name: programContext,
          question_count: parseInt(questionCount),
          duration_minutes: parseInt(duration)
        })
      });

      if (res.ok) {
        const data = await res.json();
        setActiveDraft(data);
        fetchSavedPapers();
      } else {
        const errData = await res.json().catch(() => ({}));
        setGenerationError(errData.detail || "Failed to generate paper draft.");
      }
    } catch {
      setGenerationError("Network error contacting AI Generation Gateway.");
    } finally {
      setIsGenerating(false);
    }
  };

  const loadSavedPaperDraft = async (paperId: string) => {
    try {
      const res = await fetchWithTenant(`/api/v1/question-papers/${paperId}`);
      if (res.ok) {
        const data = await res.json();
        setActiveDraft(data);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch {
      alert("Failed to load saved paper.");
    }
  };

  const handleDeletePaper = async (paperId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(language === "EN" ? "Delete this saved question draft?" : "এই সংরক্ষিত প্রশ্নপত্রটি মুছে ফেলতে চান?")) return;

    try {
      const res = await fetchWithTenant(`/api/v1/question-papers/${paperId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        if (activeDraft?.id === paperId) setActiveDraft(null);
        fetchSavedPapers();
      }
    } catch {
      alert("Failed to delete draft.");
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-in fade-in duration-300 print:max-w-full">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-white/10 pb-5 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <BookOpen className="text-blue-600 dark:text-purple-400" size={26} />
            <span>
              {isAcademy ? "Academy Question Bank & Live Exam Studio" : "School Exam Paper & Question Studio"}
            </span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {isAcademy
              ? "Admission standard question generator and official A4 paper builder."
              : `${name} NCTB curriculum assessment and printable A4 question papers.`}
          </p>
        </div>

        <Link 
          href="/dashboard/live-exams"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
        >
          Go to Live Exam Portal
        </Link>
      </div>

      {/* Generator Form Card */}
      <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 shadow-sm space-y-4 print:hidden">
        
        {/* Workspace Mode Badge & Section Header */}
        <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-white/5">
          <div className="flex items-center gap-2">
            <Sparkles className="text-purple-600 dark:text-purple-400" size={18} />
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">
              {isAcademy ? "Draft Coaching / Admission Assessment Paper" : "স্কুল পরীক্ষার প্রশ্নপত্র প্রণয়ন (NCTB)"}
            </h3>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300 border border-purple-200 dark:border-purple-500/20">
            {isAcademy ? <GraduationCap size={13} /> : <School size={13} />}
            <span>{isAcademy ? "Academy Mode Active" : "School Mode Active"}</span>
          </div>
        </div>

        {generationError && (
          <div className="p-3.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 rounded-2xl text-xs">
            {generationError}
          </div>
        )}

        <form onSubmit={handleGenerateDraft} className="space-y-4 text-xs">
          
          {/* Row 1: Target Class & Assessment Standard */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="font-semibold text-gray-700 dark:text-gray-400">
                {isAcademy ? "প্রোগ্রাম বা ব্যাচ (Target Program / Batch) *" : "শ্রেণি স্তর (Grade / Class Level) *"}
              </label>
              <input
                required
                list="class-program-options"
                value={targetClass}
                onChange={(e) => setTargetClass(e.target.value)}
                placeholder={isAcademy ? "e.g. HSC Care '26, Medical Batch Alpha" : "e.g. Class 5, Class 4, Nursery, Play"}
                className="w-full mt-1.5 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-semibold text-gray-900 dark:text-white"
              />
              <datalist id="class-program-options">
                {isAcademy ? (
                  <>
                    <option value="HSC Care '26" />
                    <option value="Engineering Admission Batch" />
                    <option value="Medical Admission Batch" />
                    <option value="Varsity 'KA' Admission Batch" />
                    <option value="SSC Board Foundation" />
                  </>
                ) : (
                  <>
                    {availableClasses.map((cls) => (
                      <option key={cls} value={cls} />
                    ))}
                  </>
                )}
              </datalist>
            </div>

            <div>
              <label className="font-semibold text-gray-700 dark:text-gray-400">
                {isAcademy ? "মূল্যায়নের ধরন ও স্ট্যান্ডার্ড (Standard)" : "পরীক্ষার ধরন (Examination Type)"}
              </label>
              <select
                value={assessmentType}
                onChange={(e) => setAssessmentType(e.target.value)}
                className="w-full mt-1.5 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-semibold text-gray-900 dark:text-white"
              >
                {isAcademy ? (
                  <>
                    <option value="Engineering Admission Standard (Coaching Model)">Engineering Admission Standard (Coaching Model)</option>
                    <option value="Medical Admission Standard (Retina Style)">Medical Admission Standard (Retina Style)</option>
                    <option value="Varsity 'KA' Admission Standard (Focus Style)">Varsity 'KA' Admission Standard (Focus Style)</option>
                    <option value="HSC Board Model Assessment">HSC Board Model Assessment</option>
                  </>
                ) : (
                  <>
                    <option value="NCTB Annual Assessment (বার্ষিক মূল্যায়ন)">NCTB Annual Assessment (বার্ষিক মূল্যায়ন)</option>
                    <option value="Half-Yearly Examination (অর্ধবার্ষিক পরীক্ষা)">Half-Yearly Examination (অর্ধবার্ষিক পরীক্ষা)</option>
                    <option value="Class Monthly Assessment (মাসিক মূল্যায়ন)">Class Monthly Assessment (মাসিক মূল্যায়ন)</option>
                    <option value="Weekly Quiz & Practice Paper (সাপ্তাহিক কুইজ)">Weekly Quiz & Practice Paper (সাপ্তাহিক কুইজ)</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Row 2: Subject & Chapter/Topic */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="font-semibold text-gray-700 dark:text-gray-400">
                বিষয় (Type or Select Subject) *
              </label>
              <input
                required
                list="subject-options"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={isAcademy ? "e.g. Chemistry 1st Paper, Physics 2nd Paper" : "e.g. বাংলা, English, প্রাথমিক গণিত, বিজ্ঞান"}
                className="w-full mt-1.5 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-semibold text-gray-900 dark:text-white"
              />
              <datalist id="subject-options">
                {isAcademy ? (
                  <>
                    <option value="Physics 1st Paper" />
                    <option value="Physics 2nd Paper" />
                    <option value="Chemistry 1st Paper" />
                    <option value="Chemistry 2nd Paper" />
                    <option value="Higher Mathematics" />
                    <option value="Biology" />
                  </>
                ) : (
                  <>
                    <option value="বাংলা (Bangla)" />
                    <option value="English for Today" />
                    <option value="Elementary Mathematics (প্রাথমিক গণিত)" />
                    <option value="General Science (প্রাথমিক বিজ্ঞান)" />
                    <option value="Bangladesh & Global Studies (বাংলাদেশ ও বিশ্বপরিচয়)" />
                    <option value="Islam & Moral Education (ইসলাম ও নৈতিক শিক্ষা)" />
                  </>
                )}
              </datalist>
            </div>

            <div>
              <label className="font-semibold text-gray-700 dark:text-gray-400">
                অধ্যায় বা সুনির্দিষ্ট পাঠ (Chapter / Topic) *
              </label>
              <input
                required
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={isAcademy ? "e.g. জৈব রসায়ন, তাপগতিবিদ্যা, ভেক্টর" : "e.g. গুণ ও ভাগ, ভগ্নাংশ, মহাবিশ্ব, সুন্দরবনের প্রাণী"}
                className="w-full mt-1.5 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Row 3: Questions Count, Duration & Generate Button */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end pt-1">
            <div>
              <label className="font-semibold text-gray-700 dark:text-gray-400">Question Count</label>
              <select
                value={questionCount}
                onChange={(e) => setQuestionCount(e.target.value)}
                className="w-full mt-1.5 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-mono text-gray-900 dark:text-white"
              >
                <option value="4">4 Questions (Daily Flash Test)</option>
                <option value="5">5 Questions (Standard Practice)</option>
                <option value="10">10 Questions (Term Assessment)</option>
                <option value="20">20 Questions (Full Paper)</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-gray-700 dark:text-gray-400">Time (Minutes)</label>
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
                <span>{isGenerating ? "Generating Validated Paper..." : "Generate Question Draft"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Live Generated Question Paper Preview & Printable A4 Pad */}
      {activeDraft && (
        <div className="space-y-4">
          
          {/* Action Bar (Screen Only) */}
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
                className="px-3.5 py-1.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-400 flex items-center gap-1.5 transition-all"
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
            
            {/* Header Pad */}
            <div className="text-center space-y-1 border-b-2 border-black pb-4">
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider">
                {activeDraft.institution_name}
              </h2>
              <p className="text-xs text-gray-700 font-serif">
                {activeDraft.campus_address}
              </p>
              <div className="pt-2">
                <span className="font-sans font-bold uppercase text-[11px] bg-black text-white px-4 py-0.5 inline-block rounded">
                  {isAcademy ? "Official Admission Assessment Examination" : "NCTB Curriculum Assessment Examination"}
                </span>
              </div>
            </div>

            {/* Exam Meta Info */}
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
              {activeDraft.questions.map((q, idx) => (
                <div key={q.id || idx} className="space-y-2.5 text-xs sm:text-sm">
                  <div className="font-semibold text-gray-900 leading-relaxed flex items-start gap-2">
                    <span className="font-mono font-bold">{idx + 1}.</span>
                    <span>{q.question}</span>
                  </div>

                  {/* 4 Options Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-5">
                    {q.options.map((opt, optIdx) => {
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
                      <strong>Solution & Explanation:</strong> {q.correct_option} — {q.explanation}
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

      {/* Saved Question Papers Registry */}
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
            {savedPapers.map((paper) => (
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