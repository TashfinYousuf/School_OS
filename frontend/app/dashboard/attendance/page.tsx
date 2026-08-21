"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Clock, Sparkles, Fingerprint } from "lucide-react";
import { useLanguage } from "@/components/providers";

type Student = {
  id: string;
  name: string;
  status: string | null;
  aiRisk: string;
};

export default function SmartAttendancePage() {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(false);

  const [students, setStudents] = useState<Student[]>([
    { id: "S-101", name: "Aarav Rahman", status: null, aiRisk: "Low" },
    { id: "S-102", name: "Nusrat Jahan", status: null, aiRisk: "High (Absent 2 days)" },
    { id: "S-103", name: "Tahmid Hasan", status: null, aiRisk: "Low" },
  ]);

  const markStatus = async (studentId: string, status: string) => {
    setStudents(students.map(s => s.id === studentId ? { ...s, status } : s));
    try {
      const token = localStorage.getItem("token");
      await fetch("http://127.0.0.1:8000/api/v1/attendance/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          student_id: studentId,
          status: status,
          is_biometric: false,
        }),
      });
    } catch (error) {
      console.error("Failed to fire attendance event", error);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            {language === "EN" ? "Smart Attendance" : "স্মার্ট উপস্থিতি"}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {language === "EN" ? "IoT-ready event tracking & AI-driven insights." : "আইওটি ইভেন্ট ট্র্যাকিং এবং এআই-চালিত ইনসাইট।"}
          </p>
        </div>

        <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 px-4 py-2 rounded-full flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm transition-colors">
          <Fingerprint size={16} className="text-blue-500 dark:text-blue-400" />
          {language === "EN" ? "Scanner Active" : "স্ক্যানার সক্রিয়"}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

        {/* Left: Interactive Roster */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white dark:bg-[#0f0f11] rounded-2xl overflow-hidden divide-y divide-gray-100 dark:divide-white/[0.05] border border-gray-200 dark:border-white/10 shadow-sm transition-colors">
            {students.map((student) => (
              <div key={student.id} className="p-5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-700 dark:text-blue-400 font-bold border border-blue-100 dark:border-blue-500/20">
                    {student.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{student.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">ID: {student.id}</p>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <button 
                    onClick={() => markStatus(student.id, "Present")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-semibold transition-all ${student.status === "Present" ? "bg-green-500 text-white shadow-md shadow-green-500/20 dark:shadow-none" : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-green-100 dark:hover:bg-green-500/10 hover:text-green-700 dark:hover:text-green-400"}`}
                  >
                    <CheckCircle2 size={16} /> {language === "EN" ? "Present" : "উপস্থিত"}
                  </button>
                  <button 
                    onClick={() => markStatus(student.id, "Absent")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-semibold transition-all ${student.status === "Absent" ? "bg-red-500 text-white shadow-md shadow-red-500/20 dark:shadow-none" : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-red-100 dark:hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-400"}`}
                  >
                    <XCircle size={16} /> {language === "EN" ? "Absent" : "অনুপস্থিত"}
                  </button>
                  <button 
                    onClick={() => markStatus(student.id, "Late")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-semibold transition-all ${student.status === "Late" ? "bg-orange-500 text-white shadow-md shadow-orange-500/20 dark:shadow-none" : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-orange-100 dark:hover:bg-orange-500/10 hover:text-orange-700 dark:hover:text-orange-400"}`}
                  >
                    <Clock size={16} /> {language === "EN" ? "Late" : "বিলম্বে"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Real-time AI Alerts */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-6 relative overflow-hidden group border border-purple-100 dark:border-purple-500/20 shadow-sm transition-colors">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/10 blur-3xl rounded-full pointer-events-none" />

            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-6">
              <Sparkles size={20} className="animate-pulse" />
              <h2 className="font-semibold text-sm tracking-wide uppercase">
                {language === "EN" ? "Live Intelligence" : "লাইভ অ্যালার্ট"}
              </h2>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-red-50/50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/10 rounded-xl transition-colors">
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  <strong className="text-red-700 dark:text-red-400">Alert:</strong> Nusrat Jahan (S-102) {language === "EN" ? "has been absent for 2 consecutive days." : "টানা ২ দিন অনুপস্থিত।"}
                </p>
                <button className="text-xs font-semibold text-red-600 dark:text-red-400 mt-2 hover:underline">
                  {language === "EN" ? "Auto-Draft Parent Message →" : "অভিভাবককে অটো-মেসেজ করুন →"}
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}