"use client";

import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/components/providers";
import { safeFetch } from "@/lib/apiClient";
import { 
  Trophy, Clock, CheckCircle2, XCircle, AlertTriangle, 
  HelpCircle, Send, Loader2, Award, ArrowLeft, Sparkles,
  ChevronRight, ChevronLeft, Check, RotateCcw, Bookmark,
  Camera, Share2, Plus, X, Users, BarChart3, MessageCircle,
  Trash2, 
} from "lucide-react";

import Link from "next/link";

interface ExamMeta {
  id: string;
  title: string;
  total_marks: number;
  duration_minutes: number;
  negative_marking_rate: number;
  total_questions: number;
}

interface QuestionItem {
  id: string;
  question: string;
  options: string[];
}

interface LeaderboardEntry {
  rank: number;
  student_name: string;
  admission_number: string;
  score: number;
  total_marks: number;
  accuracy: string;
  percentile: string;
  submitted_at: string;
}

export default function LiveExamsPage() {
  const { language } = useLanguage();
  const [examList, setExamList] = useState<ExamMeta[]>([]);
  const [activeExam, setActiveExam] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // In-Page AI Exam Generator Modal
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generatingExam, setGeneratingExam] = useState(false);
  const [genSubject, setGenSubject] = useState("Physics");
  const [genTopic, setGenTopic] = useState("Vectors & Newtonian Mechanics");
  const [genCount, setGenCount] = useState("5");
  const [genDuration, setGenDuration] = useState("15");

  // Leaderboard Modal
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<{ exam_title: string; leaderboard: LeaderboardEntry[] } | null>(null);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // Camera OMR Scanner Modal
  const [showOmrModal, setShowOmrModal] = useState(false);
  const [selectedOmrExamId, setSelectedOmrExamId] = useState("");
  const [omrScanning, setOmrScanning] = useState(false);
  const [omrScanResult, setOmrScanResult] = useState<any | null>(null);

  // Active Exam Session State
  const [examStarted, setExamStarted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(600);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<any | null>(null);
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null);

  const fetchAvailableExams = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await safeFetch<ExamMeta[]>("http://127.0.0.1:8000/api/v1/academy/exams", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data) setExamList(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailableExams();
  }, []);

  // Timer Tick
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (examStarted && !evaluationResult && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0 && examStarted && !evaluationResult) {
      executeSubmit();
    }
    return () => clearInterval(timer);
  }, [examStarted, evaluationResult, timeLeft]);

  // In-Page AI Exam Generation Handler (NO REDIRECT!)
  const handleGenerateAIExamInPage = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneratingExam(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/question-papers/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          subject: genSubject,
          topic: genTopic,
          question_count: parseInt(genCount),
          duration_minutes: parseInt(genDuration),
          difficulty: "Engineering / HSC Standard",
          negative_marking_rate: 0.25
        })
      });

      if (res.ok) {
        setShowGenerateModal(false);
        fetchAvailableExams();
        alert(language === "EN" ? "Live Exam generated and added to catalog!" : "লাইভ এক্সাম সফলভাবে তৈরি এবং যুক্ত হয়েছে!");
      } else {
        alert("Failed to generate exam.");
      }
    } catch (err) {
      alert("Error contacting AI generator.");
    } finally {
      setGeneratingExam(false);
    }
  };

  const handleStartExam = async (examId: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://127.0.0.1:8000/api/v1/academy/exams/${examId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveExam(data);
        setTimeLeft(data.duration_minutes * 60);
        setSelectedAnswers({});
        setMarkedForReview({});
        setCurrentQuestionIndex(0);
        setEvaluationResult(null);
        setDispatchStatus(null);
        setExamStarted(true);
      }
    } finally {
      setLoading(false);
    }
  };

  // Add handleDeleteExam function:
  const handleDeleteExam = async (examId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(language === "EN" ? "Are you sure you want to delete this live exam?" : "আপনি কি নিশ্চিতভাবে এই লাইভ পরীক্ষাটি মুছে ফেলতে চান?")) return;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://127.0.0.1:8000/api/v1/academy/exams/${examId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchAvailableExams();
        alert(language === "EN" ? "Exam deleted successfully." : "পরীক্ষা সফলভাবে মুছে ফেলা হয়েছে।");
      } else {
        alert(language === "EN" ? "Failed to delete exam." : "পরীক্ষা মুছতে ব্যর্থ হয়েছে।");
      }
    } catch {
      alert("Network error deleting exam.");
    }
  };

  const handleSelectOption = (qKey: string, opt: string) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [qKey]: prev[qKey] === opt ? "" : opt
    }));
  };

  const executeSubmit = async () => {
    if (!activeExam) return;
    setSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const studentId = localStorage.getItem("user_id") || "48b63bba-313a-488c-85a3-5baa1b6bb193";

      const res = await fetch("http://127.0.0.1:8000/api/v1/academy/submit-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          exam_id: activeExam.id,
          student_id: studentId,
          answers: selectedAnswers
        })
      });

      if (res.ok) {
        const data = await res.json();
        setEvaluationResult(data);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // View Merit Leaderboard
  const handleOpenLeaderboard = async (examId: string) => {
    setLoadingLeaderboard(true);
    setShowLeaderboardModal(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://127.0.0.1:8000/api/v1/academy/exams/${examId}/leaderboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setLeaderboardData(await res.json());
      }
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  // Dispatch Result to Guardian WhatsApp
  const handleDispatchWhatsApp = async () => {
    if (!evaluationResult || !activeExam) return;
    setDispatchStatus("sending");
    try {
      const token = localStorage.getItem("token");
      const studentId = localStorage.getItem("user_id") || "48b63bba-313a-488c-85a3-5baa1b6bb193";

      const res = await fetch("http://127.0.0.1:8000/api/v1/academy/dispatch-result-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          exam_id: activeExam.id,
          student_id: studentId,
          score: evaluationResult.score,
          total_marks: evaluationResult.total_marks,
          rank: 1
        })
      });

      if (res.ok) {
        setDispatchStatus("sent");
      }
    } catch {
      setDispatchStatus("error");
    }
  };

  // Camera OMR Image Upload
  const handleOmrFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedOmrExamId) return;

    setOmrScanning(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const token = localStorage.getItem("token");
      const studentId = localStorage.getItem("user_id") || "48b63bba-313a-488c-85a3-5baa1b6bb193";

      const res = await fetch(`http://127.0.0.1:8000/api/v1/academy/omr-camera-scan?exam_id=${selectedOmrExamId}&student_id=${studentId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        setOmrScanResult(await res.json());
      }
    } catch {
      alert("Error scanning OMR image.");
    } finally {
      setOmrScanning(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const totalQuestions = activeExam?.questions?.length || 0;
  const answeredCount = Object.values(selectedAnswers).filter(Boolean).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-white/10 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <Trophy className="text-amber-500" size={26} />
            <span>{language === "EN" ? "Live MCQ & OMR Evaluation Portal" : "লাইভ এমসিকিউ ও ওএমআর মূল্যায়ন পোর্টাল"}</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Negative Marking: -0.25 deducted per wrong answer • Multimodal OMR Optical Scanning Active.
          </p>
        </div>

        {!examStarted && !evaluationResult && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setSelectedOmrExamId(examList[0]?.id || ""); setShowOmrModal(true); }}
              className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Camera size={14} className="text-blue-500" />
              <span>Scan Paper OMR</span>
            </button>

            {/* 🚀 IN-PAGE AI GENERATOR (No Redirection) */}
            <button
              onClick={() => setShowGenerateModal(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Sparkles size={14} />
              <span>Generate AI Exam</span>
            </button>
          </div>
        )}

        {examStarted && !evaluationResult && (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 rounded-2xl font-mono text-xs font-bold border border-red-200 dark:border-red-500/20 animate-pulse">
            <Clock size={16} />
            <span>Time Left: {formatTime(timeLeft)}</span>
          </div>
        )}
      </div>

      {/* 1. Exam Catalog List */}
      {!examStarted && !evaluationResult && (
        <div className="space-y-4">
          <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-gray-400">
            <span>Active Live Exam Catalog</span>
            <span>{examList.length} Papers Active</span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-400 flex items-center justify-center gap-2">
              <Loader2 className="animate-spin text-blue-600" size={22} />
              <span>পরীক্ষা লোড হচ্ছে...</span>
            </div>
          ) : examList.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-[#0f0f11] rounded-3xl border border-gray-200 dark:border-white/10 text-gray-400 text-xs space-y-3">
              <Award size={40} className="mx-auto opacity-40 text-gray-400" />
              <div>কোনো সক্রিয় পরীক্ষা নেই। উপরের "Generate AI Exam" বাটনে ক্লিক করে পরীক্ষা তৈরি করুন।</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {examList.map((ex) => (
                <div 
                  key={ex.id}
                  className="p-5 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-amber-500/40 transition-all"
                >
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white">{ex.title}</h4>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span>Questions: <strong>{ex.total_questions}</strong></span>
                      <span>•</span>
                      <span>Duration: <strong>{ex.duration_minutes} Mins</strong></span>
                      <span>•</span>
                      <span className="text-red-500 font-semibold font-mono">Penalty: -{ex.negative_marking_rate}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenLeaderboard(ex.id)}
                      className="px-3.5 py-2 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                    >
                      <BarChart3 size={13} />
                      <span>Leaderboard</span>
                    </button>

                    <button
                      onClick={() => handleStartExam(ex.id)}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <span>Start Test</span>
                      <ChevronRight size={14} />
                    </button>

                    {/* 🚀 NEW: Delete Live Exam Action Button */}
                    <button
                      onClick={(e) => handleDeleteExam(ex.id, e)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                      title="Delete Exam"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. Active Exam Session */}
      {examStarted && !evaluationResult && activeExam && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between p-3.5 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl text-xs">
              <span className="font-bold text-gray-700 dark:text-gray-300">
                Question {currentQuestionIndex + 1} of {totalQuestions}
              </span>
              <span className="text-gray-400 font-mono">Answered: {answeredCount}</span>
            </div>

            {(() => {
              const currentQ = activeExam.questions[currentQuestionIndex];
              const qKey = currentQ?.id || `q_${currentQuestionIndex}`;
              const currentSelected = selectedAnswers[qKey];

              return (
                <div className="p-6 sm:p-8 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl shadow-sm space-y-5">
                  <div className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white leading-relaxed">
                    <span className="font-mono font-bold mr-2 text-blue-600 dark:text-purple-400">
                      {currentQuestionIndex + 1}.
                    </span>
                    {currentQ?.question}
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 pt-2">
                    {currentQ?.options?.map((opt: string, optIdx: number) => {
                      const isChosen = currentSelected === opt;
                      const label = String.fromCharCode(65 + optIdx);

                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleSelectOption(qKey, opt)}
                          className={`p-4 rounded-2xl border text-xs sm:text-sm text-left transition-all flex items-center gap-3 ${
                            isChosen
                              ? "bg-blue-50 border-blue-600 text-blue-700 dark:bg-blue-500/10 dark:border-blue-400 dark:text-blue-300 font-bold"
                              : "border-gray-200 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.03] text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                            isChosen ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400"
                          }`}>
                            {label}
                          </span>
                          <span className="flex-1">{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                disabled={currentQuestionIndex === 0}
                onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
                className="px-4 py-2 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5 disabled:opacity-40"
              >
                <ChevronLeft size={16} /> Previous
              </button>

              {currentQuestionIndex < totalQuestions - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  Next <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={executeSubmit}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <Send size={14} /> Submit Paper
                </button>
              )}
            </div>
          </div>

          {/* OMR Palette */}
          <div className="lg:col-span-4 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-5 shadow-sm space-y-4 sticky top-24">
            <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400">OMR Question Jump</h4>
            <div className="grid grid-cols-5 gap-2">
              {activeExam.questions.map((_: any, idx: number) => {
                const isAnswered = !!selectedAnswers[`q_${idx}`];
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentQuestionIndex(idx)}
                    className={`h-9 rounded-xl font-mono text-xs flex items-center justify-center transition-all ${
                      isAnswered ? "bg-emerald-500 text-white font-bold" : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400"
                    } ${currentQuestionIndex === idx ? "ring-2 ring-blue-500" : ""}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            <button
              onClick={executeSubmit}
              disabled={submitting}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center justify-center gap-1.5"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              <span>Finish & Submit</span>
            </button>
          </div>

        </div>
      )}

      {/* 3. Post-Exam Scorecard & WhatsApp Dispatch */}
      {evaluationResult && (
        <div className="p-8 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl shadow-sm space-y-6">
          <div className="text-center space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 font-mono">
              Official Evaluation Complete
            </span>
            <h2 className="text-4xl font-black text-gray-900 dark:text-white">
              {evaluationResult.score} <span className="text-lg font-normal text-gray-400">/ {evaluationResult.total_marks}</span>
            </h2>
            <p className="text-xs text-gray-500">Accuracy: <strong>{evaluationResult.accuracy}</strong></p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl text-emerald-700 dark:text-emerald-400">
              <span className="text-[10px] uppercase font-bold block">Correct (+1)</span>
              <span className="text-2xl font-black">{evaluationResult.correct_answers}</span>
            </div>
            <div className="p-3.5 bg-red-50 dark:bg-red-500/10 rounded-2xl text-red-700 dark:text-red-400">
              <span className="text-[10px] uppercase font-bold block">Wrong (-0.25)</span>
              <span className="text-2xl font-black">{evaluationResult.wrong_answers}</span>
            </div>
            <div className="p-3.5 bg-amber-50 dark:bg-amber-500/10 rounded-2xl text-amber-700 dark:text-amber-400">
              <span className="text-[10px] uppercase font-bold block">Penalty</span>
              <span className="text-2xl font-black">-{evaluationResult.negative_marks_deducted}</span>
            </div>
            <div className="p-3.5 bg-gray-100 dark:bg-white/5 rounded-2xl text-gray-700 dark:text-gray-300">
              <span className="text-[10px] uppercase font-bold block">Skipped</span>
              <span className="text-2xl font-black">{evaluationResult.unattempted}</span>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              onClick={handleDispatchWhatsApp}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <MessageCircle size={14} />
              <span>{dispatchStatus === "sent" ? "Dispatched to Guardian!" : "Send Result to Guardian WhatsApp"}</span>
            </button>

            <button
              onClick={() => { setEvaluationResult(null); setExamStarted(false); setActiveExam(null); }}
              className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 text-xs font-semibold flex items-center gap-1.5"
            >
              <RotateCcw size={14} /> Return to Exam Catalog
            </button>
          </div>
        </div>
      )}

      {/* Modal 1: Udvash / Retina / Focus Style In-Page AI Exam Generator */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-white/10">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                <Sparkles size={16} className="text-purple-600" />
                Admission Live Exam Builder (Eng/Medical/Varsity Ka)
              </h3>
              <button onClick={() => setShowGenerateModal(false)}><X size={16} className="text-gray-400" /></button>
            </div>

            <form onSubmit={handleGenerateAIExamInPage} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-gray-600 dark:text-gray-300">Target Coaching Program</label>
                <select
                  value={genSubject}
                  onChange={(e) => setGenSubject(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-semibold text-gray-900 dark:text-white"
                >
                  <option value="Physics 1st Paper (পদার্থবিজ্ঞান ১ম পত্র)">Engineering Care — Physics 1st Paper (Udvash Style)</option>
                  <option value="Physics 2nd Paper (পদার্থবিজ্ঞান ২য় পত্র)">Engineering Care — Physics 2nd Paper (Udvash Style)</option>
                  <option value="Chemistry 1st Paper (রসায়ন ১ম পত্র)">Medical Care — Chemistry 1st Paper (Retina Style)</option>
                  <option value="Biology 2nd Paper (প্রাণিবিজ্ঞান)">Medical Care — Biology 2nd Paper (Retina Style)</option>
                  <option value="Higher Math 1st Paper (উচ্চতর গণিত ১ম পত্র)">Varsity 'KA' — Higher Math 1st Paper (Focus Style)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-gray-600 dark:text-gray-300">Syllabus Chapter / Topic *</label>
                <input
                  required
                  value={genTopic}
                  onChange={(e) => setGenTopic(e.target.value)}
                  placeholder="যেমন: নিউটনিয়ান বলবিদ্যা, কাজ শক্তি ও ক্ষমতা"
                  className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-600 dark:text-gray-300">Question Pattern</label>
                  <select
                    value={genCount}
                    onChange={(e) => setGenCount(e.target.value)}
                    className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-mono"
                  >
                    <option value="4">4 Questions (Daily Flash Test)</option>
                    <option value="10">10 Questions (Daily Exam)</option>
                    <option value="20">20 Questions (Weekly Model Test)</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-gray-600 dark:text-gray-300">Time (Minutes)</label>
                  <input
                    type="number"
                    value={genDuration}
                    onChange={(e) => setGenDuration(e.target.value)}
                    className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-mono"
                  />
                </div>
              </div>

              <div className="p-3 bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 rounded-2xl text-[11px] text-purple-700 dark:text-purple-300">
                ⚡ Negative Marking: <strong>-0.25</strong> marks will be deducted for every incorrect attempt.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowGenerateModal(false)} className="px-4 py-2 text-gray-500 font-semibold">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generatingExam}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {generatingExam ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  <span>Generate Exam</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Merit Leaderboard */}
      {showLeaderboardModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-white/10">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                <Trophy size={16} className="text-amber-500" />
                Merit Leaderboard & Percentile Rank
              </h3>
              <button onClick={() => setShowLeaderboardModal(false)}><X size={16} className="text-gray-400" /></button>
            </div>

            {loadingLeaderboard ? (
              <div className="p-8 text-center text-gray-400 flex items-center justify-center gap-2">
                <Loader2 className="animate-spin text-amber-500" size={18} /> লোড হচ্ছে...
              </div>
            ) : leaderboardData?.leaderboard?.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">এই পরীক্ষায় এখনো কোনো শিক্ষার্থী অংশ নেয়নি।</div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {leaderboardData?.leaderboard?.map((entry) => (
                  <div key={entry.rank} className="p-3 bg-gray-50 dark:bg-black/30 rounded-2xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-6 h-6 rounded-lg font-bold font-mono flex items-center justify-center text-[11px] ${
                        entry.rank === 1 ? "bg-amber-400 text-black" : entry.rank === 2 ? "bg-gray-300 text-black" : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400"
                      }`}>
                        {entry.rank}
                      </span>
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white">{entry.student_name}</div>
                        <div className="text-[10px] text-gray-400 font-mono">ID: {entry.admission_number}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{entry.score} / {entry.total_marks}</div>
                      <div className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">{entry.percentile} Percentile</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal 3: Optical Camera OMR Scanner */}
      {showOmrModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-white/10">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                <Camera size={16} className="text-blue-500" />
                Optical Camera OMR Scanner (Gemini Vision)
              </h3>
              <button onClick={() => setShowOmrModal(false)}><X size={16} className="text-gray-400" /></button>
            </div>

            <p className="text-xs text-gray-500">
              Take a snapshot or upload a paper OMR answer sheet. Gemini 2.5 Flash Vision evaluates marked bubbles with -0.25 negative marking.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Select Exam Paper</label>
                <select
                  value={selectedOmrExamId}
                  onChange={(e) => setSelectedOmrExamId(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-xs outline-none"
                >
                  {examList.map((ex) => (
                    <option key={ex.id} value={ex.id}>{ex.title}</option>
                  ))}
                </select>
              </div>

              <div className="p-6 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl text-center space-y-2">
                <Camera size={28} className="mx-auto text-blue-500" />
                <label className="cursor-pointer block">
                  <span className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold inline-block shadow-sm">
                    {omrScanning ? "Scanning OMR Paper..." : "Capture or Upload OMR Image"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleOmrFileUpload}
                    className="hidden"
                    disabled={omrScanning || !selectedOmrExamId}
                  />
                </label>
              </div>

              {omrScanResult && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl text-xs space-y-1">
                  <div className="font-bold text-emerald-800 dark:text-emerald-300">OMR Graded Successfully!</div>
                  <div>Calculated Score: <strong>{omrScanResult.score} / {omrScanResult.total_marks}</strong></div>
                  <div>Correct: {omrScanResult.correct} • Wrong: {omrScanResult.wrong} (-0.25 deducted)</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}