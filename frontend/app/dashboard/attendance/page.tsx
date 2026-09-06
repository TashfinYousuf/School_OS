"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/providers";
import { CheckCircle2, XCircle, Calendar, Save, Loader2, AlertCircle } from "lucide-react";

interface StudentRecord {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  roll_number: string | null;
  status: "Present" | "Absent";
}

export default function DailyAttendanceLedger() {
  const { language } = useLanguage();
  const [selectedClass, setSelectedClass] = useState("Play");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const classes = ["Play", "Nursery", "KG", "Class 1", "Class 2", "Class 3", "Class 4", "Class 5"];

  const fetchSheet = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `http://127.0.0.1:8000/api/v1/attendance/sheet?class_name=${encodeURIComponent(selectedClass)}&attendance_date=${selectedDate}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (res.ok) {
        const data = await res.json();
        setStudents(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSheet();
  }, [selectedClass, selectedDate]);

  const toggleStatus = (id: string) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: s.status === "Present" ? "Absent" : "Present" } : s
      )
    );
  };

  const handleSaveAttendance = async () => {
    setSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/attendance/bulk-submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          attendance_date: selectedDate,
          class_name: selectedClass,
          records: students.map((s) => ({
            student_id: s.id,
            status: s.status
          }))
        })
      });

      if (res.ok) {
        setFeedback(language === "EN" ? "Attendance saved successfully." : "হাজিরা সফলভাবে সংরক্ষিত হয়েছে।");
      }
    } catch (err) {
      setFeedback("Failed to record attendance.");
    } finally {
      setSubmitting(false);
    }
  };

  const presentCount = students.filter((s) => s.status === "Present").length;
  const absentCount = students.length - presentCount;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-white/[0.08] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            {language === "EN" ? "Daily Attendance Ledger" : "দৈনন্দিন ডিজিটাল হাজিরা খাতা"}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {language === "EN" ? "Class attendance submission & automatic absence tracking" : "শ্রেণিভিত্তিক হাজিরা গ্রহণ এবং তাৎক্ষণিক অনুপস্থিতি ট্র্যাকিং"}
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm shadow-sm">
            <Calendar size={16} className="text-gray-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-gray-900 dark:text-white outline-none font-medium"
            />
          </div>

          <button
            onClick={handleSaveAttendance}
            disabled={submitting || students.length === 0}
            className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {language === "EN" ? "Submit Attendance" : "হাজিরা সংরক্ষণ"}
          </button>
        </div>
      </div>

      {/* Class Selector Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
        {classes.map((cls) => (
          <button
            key={cls}
            onClick={() => setSelectedClass(cls)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
              selectedClass === cls
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-white dark:bg-[#0f0f11] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:border-gray-400"
            }`}
          >
            {cls}
          </button>
        ))}
      </div>

      {/* Operational Feedback */}
      {feedback && (
        <div className="p-4 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-xl text-green-700 dark:text-green-400 text-sm font-medium flex items-center gap-2">
          <CheckCircle2 size={16} /> {feedback}
        </div>
      )}

      {/* Class Tally Bar */}
      <div className="flex gap-4">
        <div className="flex-1 p-4 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/[0.08] rounded-2xl flex items-center justify-between">
          <span className="text-xs font-bold uppercase text-gray-500">{language === "EN" ? "Total in Class" : "মোট শিক্ষার্থী"}</span>
          <span className="text-xl font-bold text-gray-900 dark:text-white">{students.length}</span>
        </div>
        <div className="flex-1 p-4 bg-green-50 dark:bg-green-500/5 border border-green-200 dark:border-green-500/20 rounded-2xl flex items-center justify-between">
          <span className="text-xs font-bold uppercase text-green-700 dark:text-green-400">{language === "EN" ? "Present" : "উপস্থিত"}</span>
          <span className="text-xl font-bold text-green-700 dark:text-green-400">{presentCount}</span>
        </div>
        <div className="flex-1 p-4 bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-2xl flex items-center justify-between">
          <span className="text-xs font-bold uppercase text-red-700 dark:text-red-400">{language === "EN" ? "Absent" : "অনুপস্থিত"}</span>
          <span className="text-xl font-bold text-red-700 dark:text-red-400">{absentCount}</span>
        </div>
      </div>

      {/* Student Attendance Ledger List */}
      <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-gray-500 flex justify-center items-center gap-2">
            <Loader2 className="animate-spin text-blue-600" size={20} /> Loading class sheet...
          </div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center gap-2">
            <AlertCircle size={28} className="opacity-40" />
            <p className="font-medium">{language === "EN" ? `No active students enrolled in ${selectedClass}.` : `${selectedClass}-এ কোনো শিক্ষার্থী নথিভুক্ত নেই।`}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-white/[0.05]">
            {students.map((student) => {
              const isPresent = student.status === "Present";
              return (
                <div
                  key={student.id}
                  onClick={() => toggleStatus(student.id)}
                  className="p-4 sm:p-5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center font-bold text-sm text-gray-700 dark:text-gray-300">
                      {student.roll_number || student.admission_number.slice(-2)}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                        {student.first_name} {student.last_name}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Roll: {student.roll_number || "N/A"} • ID: {student.admission_number}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                        isPresent
                          ? "bg-green-600 text-white border-green-600 shadow-sm"
                          : "bg-red-600 text-white border-red-600 shadow-sm"
                      }`}
                    >
                      {isPresent ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                      {isPresent ? (language === "EN" ? "Present" : "উপস্থিত") : (language === "EN" ? "Absent" : "অনুপস্থিত")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}