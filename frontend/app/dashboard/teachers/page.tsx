"use client";

import { useEffect, useState } from "react";
import { Sparkles, Search, UserPlus, MoreVertical, Award, BookOpen, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useLanguage } from "@/components/providers";

export default function TeachersPage() {
  const { language } = useLanguage();
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // --- Missing States Added ---
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "", last_name: "", designation: "", email: "", password: ""
  });

  const fetchTeachers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://127.0.0.1:8000/api/v1/teachers/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTeachers(data);
      }
    } catch (error) {
      console.error("Failed to fetch teachers:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://127.0.0.1:8000/api/v1/teachers/", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        setOpen(false);
        setFormData({ first_name: "", last_name: "", designation: "", email: "", password: "" });
        fetchTeachers();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            {language === "EN" ? "Teachers & Staff" : "শিক্ষক ও কর্মচারী"}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {language === "EN" ? "Manage educators and view assessment insights." : "শিক্ষকদের পরিচালনা করুন এবং মূল্যায়ন ইনসাইট দেখুন।"}
          </p>
        </div>

        {/* Add Teacher Modal */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 shadow-sm border border-transparent dark:border-white/10">
              <UserPlus size={18} />
              {language === "EN" ? "Onboard Teacher" : "শিক্ষক যুক্ত করুন"}
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-white dark:bg-[#0f0f11] text-gray-900 dark:text-white border dark:border-white/10">
            <DialogHeader>
              <DialogTitle>{language === "EN" ? "Onboard New Teacher" : "নতুন শিক্ষক নিবন্ধন"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <input required name="first_name" value={formData.first_name} onChange={handleChange} className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm outline-none focus:border-indigo-500" placeholder={language === "EN" ? "First Name" : "নামের প্রথমাংশ"} />
                <input required name="last_name" value={formData.last_name} onChange={handleChange} className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm outline-none focus:border-indigo-500" placeholder={language === "EN" ? "Last Name" : "নামের শেষাংশ"} />
              </div>
              <input required name="designation" value={formData.designation} onChange={handleChange} className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm outline-none focus:border-indigo-500" placeholder={language === "EN" ? "Designation (e.g. Senior Teacher)" : "পদবী"} />
              <input required type="email" name="email" value={formData.email} onChange={handleChange} className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm outline-none focus:border-indigo-500" placeholder={language === "EN" ? "Email (Login ID)" : "ইমেইল (লগইন আইডি)"} />
              <input required type="password" name="password" value={formData.password} onChange={handleChange} className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm outline-none focus:border-indigo-500" placeholder={language === "EN" ? "Password" : "পাসওয়ার্ড"} />
              
              <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 dark:bg-white text-white dark:text-black py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 dark:hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 mt-6">
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : (language === "EN" ? "Complete Onboarding" : "নিবন্ধন সম্পন্ন করুন")}
              </button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl flex items-center px-4 py-3 gap-3 shadow-sm transition-colors">
            <Search className="text-gray-400 dark:text-gray-500" size={20} />
            <input type="text" placeholder={language === "EN" ? "Search educators by name or expertise..." : "নাম বা দক্ষতা দিয়ে শিক্ষক খুঁজুন..."} className="bg-transparent border-none outline-none w-full text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600" />
          </div>

          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm transition-colors">
            {loading ? (
              <div className="p-10 text-center text-gray-500 dark:text-gray-400 flex justify-center items-center gap-2">
                <Loader2 className="animate-spin text-indigo-500" size={20} /> {language === "EN" ? "Loading educators..." : "লোড হচ্ছে..."}
              </div>
            ) : teachers.length === 0 ? (
              <div className="p-10 text-center text-gray-500 dark:text-gray-400">
                {language === "EN" ? "No teachers found. Onboard one to get started!" : "কোনো শিক্ষক পাওয়া যায়নি।"}
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {teachers.map((teacher) => (
                  <div key={teacher.id} className="p-5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors flex items-center justify-between group cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold border border-indigo-100 dark:border-indigo-500/20">
                        {teacher.first_name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{teacher.first_name} {teacher.last_name}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{teacher.designation || "Educator"}</p>
                      </div>
                    </div>
                    <div className="hidden md:flex items-center gap-6">
                      <div className="text-xs">
                        <p className="text-gray-500 dark:text-gray-400">{language === "EN" ? "AI Quality Score" : "এআই স্কোর"}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Award size={14} className="text-amber-500" />
                          <p className="font-semibold text-gray-900 dark:text-gray-200">8.5/10</p>
                        </div>
                      </div>
                      <button className="text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white opacity-0 group-hover:opacity-100 transition-all">
                        <MoreVertical size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: AI Insights */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-6 relative overflow-hidden border border-indigo-100 dark:border-indigo-500/20 shadow-sm transition-colors">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-6">
              <Sparkles size={20} className="animate-pulse" />
              <h2 className="font-semibold text-sm tracking-wide uppercase">{language === "EN" ? "Mentor Insights" : "মেন্টর ইনসাইট"}</h2>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50/50 dark:bg-white/[0.03] border border-indigo-100 dark:border-white/10 rounded-xl">
                <div className="flex gap-2 items-start">
                  <BookOpen size={16} className="text-indigo-500 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <strong className="text-gray-900 dark:text-white">2 {language === "EN" ? "Teachers" : "শিক্ষক"}</strong> {language === "EN" ? "recommended for Digital Pedagogy training." : "প্রশিক্ষণের জন্য সুপারিশকৃত।"}
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