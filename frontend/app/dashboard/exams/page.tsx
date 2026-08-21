"use client";

import { useState } from "react";
import { useLanguage } from "@/components/providers";
import { BrainCircuit, Trophy, Sparkles, Target, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function ExamsPage() {
  const { language } = useLanguage();
  
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Static Demo Data for UI illustration
  const studentCompetency = {
    name: "Aarav Rahman",
    grade: "A",
    aiFeedback: "Exceptional logical reasoning. Shows high potential for advanced STEM pathways.",
    scores: [
      { skill: "Critical Thinking", value: 90, color: "bg-blue-500" },
      { skill: "Problem Solving", value: 85, color: "bg-indigo-500" },
      { skill: "Creativity", value: 70, color: "bg-purple-500" },
      { skill: "Digital Literacy", value: 95, color: "bg-teal-500" }
    ]
  };

  const handleSaveAssessment = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setOpen(false);
    }, 1000);
  };

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            {language === "EN" ? "Competency Evaluation" : "দক্ষতা মূল্যায়ন"}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {language === "EN" ? "Move beyond GPAs. Measure skills, potential, and real-world readiness." : "জিপিএর বাইরে গিয়ে দক্ষতা এবং সম্ভাবনা পরিমাপ করুন।"}
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 shadow-sm border border-transparent dark:border-white/10">
              <Trophy size={18} />
              {language === "EN" ? "Evaluate Student" : "শিক্ষার্থী মূল্যায়ন করুন"}
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-white dark:bg-[#0f0f11] text-gray-900 dark:text-white border dark:border-white/10">
            <DialogHeader>
              <DialogTitle>{language === "EN" ? "Competency Assessment" : "দক্ষতা মূল্যায়ন ফর্ম"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveAssessment} className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{language === "EN" ? "Student ID" : "শিক্ষার্থী আইডি"}</label>
                <input required className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm outline-none focus:border-purple-500" placeholder="e.g. S-101" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">{language === "EN" ? "Critical Thinking (%)" : "ক্রিটিক্যাল থিংকিং (%)"}</label>
                  <input type="number" max="100" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm outline-none focus:border-purple-500" placeholder="0-100" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">{language === "EN" ? "Creativity (%)" : "সৃজনশীলতা (%)"}</label>
                  <input type="number" max="100" className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm outline-none focus:border-purple-500" placeholder="0-100" />
                </div>
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-purple-600 dark:bg-white text-white dark:text-black py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-6">
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : (language === "EN" ? "Save & Generate AI Profile" : "সেভ এবং এআই প্রোফাইল তৈরি করুন")}
              </button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left: Competency Profile View */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-[#0f0f11] rounded-3xl p-8 border border-gray-200 dark:border-white/[0.08] shadow-sm transition-colors">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{studentCompetency.name}</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{language === "EN" ? "Mid-Term Assessment 2026" : "অর্ধ-বার্ষিক মূল্যায়ন ২০২৬"}</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 px-4 py-2 rounded-xl border border-purple-100 dark:border-purple-500/20 font-bold text-xl">
                {language === "EN" ? "Grade" : "গ্রেড"} {studentCompetency.grade}
              </div>
            </div>

            <div className="space-y-8">
              {studentCompetency.scores.map((score, index) => (
                <div key={index} className="space-y-3">
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-gray-700 dark:text-gray-300">{score.skill}</span>
                    <span className="text-gray-900 dark:text-white">{score.value}%</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-white/10 rounded-full h-3 overflow-hidden">
                    <div className={`h-3 rounded-full ${score.color}`} style={{ width: `${score.value}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: AI Potential Profile */}
        <div className="lg:col-span-1">
          <div className="bg-gradient-to-b from-white to-purple-50/30 dark:from-[#0f0f11] dark:to-purple-900/10 rounded-3xl p-6 relative overflow-hidden border border-purple-100 dark:border-purple-500/20 shadow-sm transition-colors">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/10 blur-3xl rounded-full pointer-events-none" />

            <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400 mb-6">
              <BrainCircuit size={20} />
              <h2 className="font-semibold text-sm tracking-wide uppercase">{language === "EN" ? "AI Potential Profile" : "এআই পটেনশিয়াল প্রোফাইল"}</h2>
            </div>

            <div className="space-y-5">
              <div className="p-5 bg-white/80 dark:bg-black/40 border border-purple-100/50 dark:border-white/5 rounded-2xl shadow-sm backdrop-blur-sm transition-colors">
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed italic">
                  "{studentCompetency.aiFeedback}"
                </p>
              </div>

              <div className="flex items-start gap-4 p-5 bg-white/80 dark:bg-black/40 border border-gray-100/50 dark:border-white/5 rounded-2xl shadow-sm backdrop-blur-sm transition-colors">
                <Target className="text-blue-500 dark:text-blue-400 mt-0.5 shrink-0" size={20} />
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">{language === "EN" ? "Recommended Focus" : "সুপারিশকৃত ফোকাস"}</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5 leading-relaxed">
                    {language === "EN" ? "Engage in creative arts or open-ended project based learning to balance logical dominance." : "লজিক ব্যালেন্স করার জন্য সৃজনশীল শিল্পকলা বা প্রজেক্ট-ভিত্তিক শিক্ষায় নিযুক্ত করুন।"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}