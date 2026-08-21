"use client";

import { useEffect, useState } from "react";
import { BookOpen, Sparkles, Plus, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useLanguage } from "@/components/providers";

export default function AcademicPage() {
  const { language } = useLanguage();
  const [grades, setGrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "" });

  const fetchGrades = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://127.0.0.1:8000/api/v1/academic/grades", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) setGrades(await response.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGrades(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://127.0.0.1:8000/api/v1/academic/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        setOpen(false);
        setFormData({ name: "", description: "" });
        fetchGrades();
      }
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{language === "EN" ? "Curriculum & Classes" : "পাঠ্যক্রম এবং ক্লাস"}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{language === "EN" ? "Manage NCTB baseline and core competencies." : "NCTB বেসলাইন এবং দক্ষতা পরিচালনা করুন।"}</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="bg-blue-600 dark:bg-white hover:bg-blue-700 dark:hover:bg-gray-200 text-white dark:text-black px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 shadow-sm border border-transparent dark:border-white/10">
              <Plus size={18} /> {language === "EN" ? "Create Class" : "ক্লাস তৈরি করুন"}
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-white dark:bg-[#0f0f11] text-gray-900 dark:text-white border dark:border-white/10">
            <DialogHeader><DialogTitle>{language === "EN" ? "Add New Class" : "নতুন ক্লাস যোগ করুন"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm outline-none focus:border-blue-500" placeholder="e.g. Class 6" />
              <input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm outline-none focus:border-blue-500" placeholder="Optional description" />
              <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 dark:bg-white text-white dark:text-black py-2.5 rounded-xl text-sm font-semibold transition-colors flex justify-center gap-2">
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : "Save Class"}
              </button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-6">
          {loading ? (
            <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-10 text-center flex justify-center items-center gap-2 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-white/10">
              <Loader2 className="animate-spin text-blue-500" size={20} /> {language === "EN" ? "Loading Curriculum..." : "লোড হচ্ছে..."}
            </div>
          ) : grades.length === 0 ? (
            <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-10 text-center text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-white/10">
              {language === "EN" ? "No classes configured yet." : "কোনো ক্লাস সেট করা নেই।"}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {grades.map((grade) => (
                <div key={grade.id} className="bg-white dark:bg-[#0f0f11] rounded-2xl p-6 border border-gray-200 dark:border-white/10 shadow-sm">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">{grade.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{grade.description || "NCTB Standard Curriculum"}</p>
                  
                  <div className="mt-6 p-3 bg-blue-50 dark:bg-white/[0.03] rounded-xl border border-blue-100 dark:border-white/5">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 size={14} className="text-green-500" />
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-200">General Science</h4>
                    </div>
                    <p className="text-[11px] text-gray-600 dark:text-gray-400 ml-5 font-mono bg-white dark:bg-black/30 px-2 py-1 rounded inline-block mt-1 border border-gray-100 dark:border-white/5">
                      ↳ Competency: Critical Thinking
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: AI Curriculum Intelligence */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-6 relative overflow-hidden group border border-blue-100 dark:border-blue-500/20 shadow-sm transition-colors">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full pointer-events-none" />

            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-6">
              <Sparkles size={20} className="animate-pulse" />
              <h2 className="font-semibold text-sm tracking-wide uppercase">
                {language === "EN" ? "AI Curriculum Map" : "এআই পাঠ্যক্রম ম্যাপ"}
              </h2>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-blue-50/50 dark:bg-white/[0.03] border border-blue-100 dark:border-white/10 rounded-xl transition-colors">
                <div className="flex gap-2 items-start">
                  <BookOpen size={16} className="text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {language === "EN" ? "NCTB alignment is at" : "এনসিটিবি (NCTB) কারিকুলামের সাথে মিল"} <strong className="text-gray-900 dark:text-white">100%</strong>. {language === "EN" ? "STEM enrichment subjects can be added to Class 6 for better logic building." : "লজিক বৃদ্ধির জন্য ক্লাস ৬ এ স্টেম (STEM) বিষয় যুক্ত করা যেতে পারে।"}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-orange-50/50 dark:bg-orange-500/5 border border-orange-100 dark:border-orange-500/10 rounded-xl transition-colors">
                <div className="flex gap-2 items-start">
                  <AlertCircle size={16} className="text-orange-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {language === "EN" ? "Lacking subjects mapped to" : "মিডল স্কুল লেভেলে"} <strong className="text-gray-900 dark:text-white">{language === "EN" ? '"Digital Literacy"' : '"ডিজিটাল লিটারেসি"'}</strong> {language === "EN" ? "in middle school levels." : "সম্পর্কিত বিষয়ের অভাব রয়েছে।"}
                  </p>
                </div>
                <button className="text-xs font-semibold text-orange-600 dark:text-orange-400 mt-2 ml-6 hover:underline">
                  {language === "EN" ? "View Recommendations →" : "সুপারিশগুলো দেখুন →"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}