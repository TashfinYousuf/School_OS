"use client";

import { useEffect, useState } from "react";
import { Sparkles, Search, UserPlus, MoreVertical, AlertCircle, Loader2, BookOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useLanguage } from "@/components/providers"; // 🚀 Language Provider

export default function StudentsPage() {
  const { language } = useLanguage();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ first_name: "", last_name: "", email: "", password: "", admission_number: "" });

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://127.0.0.1:8000/api/v1/students/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) setStudents(await response.json());
    } catch (error) {
      console.error("Failed to fetch students:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStudents(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://127.0.0.1:8000/api/v1/students/", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        setOpen(false);
        setFormData({ first_name: "", last_name: "", email: "", password: "", admission_number: "" });
        fetchStudents();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            {language === "EN" ? "Students Base" : "শিক্ষার্থী ডাটাবেস"}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {language === "EN" ? "Manage enrollments and view AI insights." : "ভর্তি পরিচালনা করুন এবং এআই ইনসাইট দেখুন।"}
          </p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 shadow-sm border border-transparent dark:border-white/10">
              <UserPlus size={18} />
              {language === "EN" ? "Admit Student" : "নতুন শিক্ষার্থী ভর্তি"}
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-white dark:bg-[#0f0f11] text-gray-900 dark:text-white border dark:border-white/10">
            <DialogHeader>
              <DialogTitle>{language === "EN" ? "Admit New Student" : "নতুন শিক্ষার্থী যোগ করুন"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <input required value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm outline-none focus:border-blue-500" placeholder="First Name" />
              <input required value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm outline-none focus:border-blue-500" placeholder="Last Name" />
              <input required value={formData.admission_number} onChange={(e) => setFormData({ ...formData, admission_number: e.target.value })} className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm outline-none focus:border-blue-500" placeholder="Admission Number" />
              <input required type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm outline-none focus:border-blue-500" placeholder="Guardian Email" />
              <input required type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm outline-none focus:border-blue-500" placeholder="Password" />
              <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 dark:bg-white text-white dark:text-black py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 dark:hover:bg-gray-200 transition-colors flex justify-center gap-2">
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : (language === "EN" ? "Complete Admission" : "ভর্তি সম্পন্ন করুন")}
              </button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl flex items-center px-4 py-3 gap-3 shadow-sm">
            <Search className="text-gray-400 dark:text-gray-500" size={20} />
            <input type="text" placeholder={language === "EN" ? "Search students..." : "শিক্ষার্থী খুঁজুন..."} className="bg-transparent border-none outline-none w-full text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600" />
          </div>

          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-10 text-center text-gray-500 dark:text-gray-400 flex justify-center items-center gap-2">
                <Loader2 className="animate-spin text-blue-500" size={20} /> {language === "EN" ? "Loading students..." : "লোড হচ্ছে..."}
              </div>
            ) : students.length === 0 ? (
              <div className="p-10 text-center text-gray-500 dark:text-gray-400">
                {language === "EN" ? "No students found." : "কোনো শিক্ষার্থী পাওয়া যায়নি।"}
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {students.map((student) => (
                  <div key={student.id} className="p-5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors flex items-center justify-between group cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-700 dark:text-blue-400 font-bold border border-blue-100 dark:border-blue-500/20">
                        {student.first_name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{student.first_name} {student.last_name}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">ID: {student.admission_number}</p>
                      </div>
                    </div>
                    <div className="hidden md:flex items-center gap-6">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400 uppercase border border-green-100 dark:border-green-500/20">Low Risk</span>
                      <MoreVertical size={18} className="text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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