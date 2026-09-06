"use client";

import { useState } from "react";
import { useLanguage } from "@/components/providers";
import { 
  FileText, Sparkles, Printer, Save, 
  RotateCcw, CheckCircle2, AlertCircle, Loader2 
} from "lucide-react";

export default function AssessmentIntelligencePage() {
  const { language } = useLanguage();
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Form State
  const [form, setForm] = useState({
    class_name: "Class 3",
    subject: "English",
    exam_term: "Half Yearly Examination - 2026",
    total_marks: 50,
    duration: "1.5 Hours",
    chapters_or_topics: "Unit 1-4, Paragraph Writing on My School, Tense & Prepositions",
    difficulty: "Medium"
  });

  // Generated Paper State
  const [paper, setPaper] = useState<{
    title: string;
    class_name: string;
    subject: string;
    total_marks: number;
    duration: string;
    instructions: string;
    content: string;
  } | null>(null);

  const classes = ["Play", "Nursery", "KG", "Class 1", "Class 2", "Class 3", "Class 4", "Class 5"];
  const subjects = ["Bangla", "English", "Mathematics", "Science", "Social Studies", "Religion", "General Knowledge"];

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setFeedback(null);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/question-papers/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });

      if (!res.ok) throw new Error("Failed to generate blueprint");
      const data = await res.json();
      setPaper(data);
    } catch (err: any) {
      setFeedback(err.message || "Error communicating with AI engine");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveToDb = async () => {
    if (!paper) return;
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/question-papers/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(paper)
      });
      if (res.ok) {
        setFeedback(language === "EN" ? "Question paper archived successfully!" : "প্রশ্নপত্রটি সফলভাবে সংরক্ষিত হয়েছে!");
      }
    } catch (err) {
      setFeedback("Failed to save paper.");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      
      {/* Non-printable Screen Controls */}
      <div className="print:hidden space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-white/[0.08] pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="text-blue-600 dark:text-purple-400" />
              {language === "EN" ? "Assessment Intelligence & Paper Generator" : "প্রশ্নপত্র প্রণয়ন ও পরীক্ষা মূল্যায়ন"}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Kids Shine International School • Curriculum-aligned question setter with 1-click A4 printing.
            </p>
          </div>

          {paper && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveToDb}
                disabled={saving}
                className="bg-gray-100 dark:bg-white/10 text-gray-800 dark:text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-200 dark:hover:bg-white/20 transition-all flex items-center gap-2"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {language === "EN" ? "Save Paper" : "সংরক্ষণ করুন"}
              </button>
              <button
                onClick={handlePrint}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 shadow-sm"
              >
                <Printer size={16} />
                {language === "EN" ? "Print Paper (A4)" : "প্রিন্ট করুন (A4)"}
              </button>
            </div>
          )}
        </div>

        {feedback && (
          <div className="p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl text-blue-700 dark:text-blue-400 text-sm font-medium flex items-center gap-2">
            <CheckCircle2 size={16} /> {feedback}
          </div>
        )}

        {/* Blueprint Generator Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-4 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/[0.08] p-6 rounded-3xl shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-blue-600 dark:text-purple-400 mb-2">
              <Sparkles size={16} /> Parameters Setup
            </div>

            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Exam Term</label>
                <input
                  type="text"
                  value={form.exam_term}
                  onChange={(e) => setForm({ ...form, exam_term: e.target.value })}
                  className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Class</label>
                  <select
                    value={form.class_name}
                    onChange={(e) => setForm({ ...form, class_name: e.target.value })}
                    className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm text-gray-900 dark:text-white outline-none"
                  >
                    {classes.map((cls) => <option key={cls} value={cls}>{cls}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Subject</label>
                  <select
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm text-gray-900 dark:text-white outline-none"
                  >
                    {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Total Marks</label>
                  <input
                    type="number"
                    value={form.total_marks}
                    onChange={(e) => setForm({ ...form, total_marks: parseInt(e.target.value) || 50 })}
                    className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm text-gray-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Duration</label>
                  <input
                    type="text"
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: e.target.value })}
                    className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm text-gray-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Chapters / Topics Coverage</label>
                <textarea
                  rows={3}
                  value={form.chapters_or_topics}
                  onChange={(e) => setForm({ ...form, chapters_or_topics: e.target.value })}
                  placeholder="Specify syllabus lessons or question styles..."
                  className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm text-gray-900 dark:text-white outline-none resize-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={generating}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {generating ? "Drafting with Curriculum AI..." : "Generate Question Draft"}
              </button>
            </form>
          </div>

          {/* Live Editable Preview Area */}
          <div className="lg:col-span-8">
            {paper ? (
              <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/[0.08] p-6 rounded-3xl shadow-sm space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-white/10 text-xs text-gray-400">
                  <span>Editable Preview Sheet (Changes reflect directly on print)</span>
                  <button onClick={() => setPaper(null)} className="text-red-500 hover:underline flex items-center gap-1">
                    <RotateCcw size={12} /> Clear Draft
                  </button>
                </div>
                <textarea
                  value={paper.content}
                  onChange={(e) => setPaper({ ...paper, content: e.target.value })}
                  rows={20}
                  className="w-full bg-transparent border-none outline-none font-serif text-gray-900 dark:text-gray-100 leading-relaxed text-sm resize-none"
                />
              </div>
            ) : (
              <div className="h-full min-h-[350px] flex flex-col items-center justify-center p-8 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/[0.08] rounded-3xl text-gray-400 text-center">
                <FileText size={48} className="opacity-20 mb-3" />
                <h4 className="font-semibold text-gray-600 dark:text-gray-300">No Question Paper Generated</h4>
                <p className="text-xs max-w-sm mt-1">Set the exam parameters on the left to generate an NCTB-compliant question paper.</p>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ================= OFFICIAL PRINT-ONLY SHEET (A4 Standard) ================= */}
      {paper && (
        <div className="hidden print:block font-serif text-black p-4 bg-white max-w-[210mm] mx-auto leading-normal">
          {/* Header */}
          <div className="text-center border-b-2 border-black pb-4 mb-4">
            <h1 className="text-2xl font-black uppercase tracking-wider">Kids Shine International School</h1>
            <p className="text-xs italic mt-0.5">Towards a Bright Future</p>
            <h2 className="text-lg font-bold mt-2 uppercase">{paper.title}</h2>
            <div className="flex justify-between text-xs font-semibold mt-3 px-2">
              <span>Class: {paper.class_name}</span>
              <span>Subject: {paper.subject}</span>
              <span>Time: {paper.duration}</span>
              <span>Total Marks: {paper.total_marks}</span>
            </div>
          </div>

          <p className="text-[11px] italic mb-4">Instructions: {paper.instructions}</p>

          {/* Paper Body */}
          <div className="whitespace-pre-wrap text-xs leading-relaxed">
            {paper.content}
          </div>
        </div>
      )}

    </div>
  );
}