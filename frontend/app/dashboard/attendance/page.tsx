"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/components/providers";
import { 
  CalendarCheck, Users, Check, X, 
  Wifi, WifiOff, Send, ShieldCheck, AlertCircle, Loader2, Calendar
} from "lucide-react";

interface StudentItem {
  id: string;
  first_name: string;
  last_name: string;
  roll_number: string;
  admission_number: string;
}

const CLASS_OPTIONS = ["Play", "Nursery", "KG", "Class 1", "Class 2", "Class 3", "Class 4", "Class 5"];

export default function MobileFirstAttendancePage() {
  const { language } = useLanguage();
  const [selectedClass, setSelectedClass] = useState("Class 5");
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  const [students, setStudents] = useState<StudentItem[]>([]);
  // 1-Click Fast Attendance: binary state "Present" | "Absent"
  const [attendanceMap, setAttendanceMap] = useState<Record<string, "Present" | "Absent">>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [offlinePending, setOfflinePending] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Monitor Network Connectivity
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => { setIsOnline(true); autoSyncOfflineQueue(); };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    checkOfflineQueue();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Fetch Students for Class (Default: 1-Tap All Present)
  const fetchStudents = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://127.0.0.1:8000/api/v1/students?class_name=${encodeURIComponent(selectedClass)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data: StudentItem[] = await res.json();
        setStudents(data);
        // 🚀 Fast Default: All loaded students start as "Present"
        const initialMap: Record<string, "Present" | "Absent"> = {};
        data.forEach((s) => { initialMap[s.id] = "Present"; });
        setAttendanceMap(initialMap);
      }
    } catch {
      // Offline fallback: load cached class roster
      const cached = localStorage.getItem(`roster_${selectedClass}`);
      if (cached) {
        const data: StudentItem[] = JSON.parse(cached);
        setStudents(data);
        const initialMap: Record<string, "Present" | "Absent"> = {};
        data.forEach((s) => { initialMap[s.id] = "Present"; });
        setAttendanceMap(initialMap);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [selectedClass]);

  // 🚀 1-Click Fast Toggle: Present <-> Absent only
  const toggleStudentStatus = (studentId: string) => {
    setAttendanceMap((prev) => {
      const current = prev[studentId] || "Present";
      return {
        ...prev,
        [studentId]: current === "Present" ? "Absent" : "Present"
      };
    });
  };

  const markAll = (status: "Present" | "Absent") => {
    const nextMap: Record<string, "Present" | "Absent"> = {};
    students.forEach((s) => { nextMap[s.id] = status; });
    setAttendanceMap(nextMap);
  };

  const checkOfflineQueue = () => {
    const queue = localStorage.getItem("offline_attendance_queue");
    setOfflinePending(!!queue && JSON.parse(queue).length > 0);
  };

  const handleSaveAttendance = async () => {
    setSubmitting(true);
    const records = Object.entries(attendanceMap).map(([student_id, status]) => ({
      student_id,
      status
    }));

    const payload = {
      class_name: selectedClass,
      date: selectedDate,
      sync_idempotency_key: `IDEMP-ATT-${selectedClass}-${selectedDate}-${Date.now()}`,
      records
    };

    if (!navigator.onLine) {
      const queue = JSON.parse(localStorage.getItem("offline_attendance_queue") || "[]");
      queue.push(payload);
      localStorage.setItem("offline_attendance_queue", JSON.stringify(queue));
      setOfflinePending(true);
      setSyncMessage(language === "EN" ? "Saved offline. Auto-sync will run when connection restores." : "অফলাইনে সংরক্ষিত হয়েছে। ইন্টারনেট সংযোগ পেলে স্বয়ংক্রিয় সিঙ্ক হবে।");
      setSubmitting(false);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/attendance/sync-offline", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSyncMessage(language === "EN" ? "Attendance recorded & synced successfully!" : "হাজিরা সফলভাবে ডেটাবেসে সংরক্ষিত হয়েছে!");
        setTimeout(() => setSyncMessage(null), 3500);
      } else {
        alert("Failed to submit attendance. Please try again.");
      }
    } catch {
      const queue = JSON.parse(localStorage.getItem("offline_attendance_queue") || "[]");
      queue.push(payload);
      localStorage.setItem("offline_attendance_queue", JSON.stringify(queue));
      setOfflinePending(true);
    } finally {
      setSubmitting(false);
    }
  };

  const autoSyncOfflineQueue = async () => {
    const queue = JSON.parse(localStorage.getItem("offline_attendance_queue") || "[]");
    if (queue.length === 0) return;

    const token = localStorage.getItem("token");
    for (const item of queue) {
      try {
        await fetch("http://127.0.0.1:8000/api/v1/attendance/sync-offline", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(item)
        });
      } catch {
        return;
      }
    }

    localStorage.removeItem("offline_attendance_queue");
    setOfflinePending(false);
    setSyncMessage(language === "EN" ? "All queued offline attendance records synced!" : "সব অফলাইন রেকর্ড সার্ভারে সফলভাবে সিঙ্ক হয়েছে!");
  };

  const totalInClass = students.length;
  const presentCount = Object.values(attendanceMap).filter((v) => v === "Present").length;
  const absentCount = Object.values(attendanceMap).filter((v) => v === "Absent").length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 animate-in fade-in duration-300">
      
      {/* Offline Status Alert Banner */}
      {!isOnline && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-2xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WifiOff size={15} />
            <span>অফলাইন মোড সক্রিয়: আপনি ইন্টারনেট ছাড়াই নিরাপদে হাজিরা নিতে পারছেন</span>
          </div>
          <span className="text-[10px] font-mono uppercase bg-amber-500/20 px-2 py-0.5 rounded">Local Storage</span>
        </div>
      )}

      {/* Sync Success Feedback */}
      {syncMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs flex items-center gap-2 animate-in slide-in-from-top-2">
          <ShieldCheck size={16} />
          <span>{syncMessage}</span>
        </div>
      )}

      {/* Top Header: Title & Action Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-white/10 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <span>Daily Attendance Ledger</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Class attendance submission & automatic absence tracking
          </p>
        </div>

        {/* Top Right Controls: Date Picker + Submit Attendance Button */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Date Picker Input */}
          <div className="relative flex items-center bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl px-3 py-2 text-xs font-mono">
            <Calendar size={14} className="text-gray-400 mr-2" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent outline-none text-gray-800 dark:text-gray-200 font-semibold cursor-pointer"
            />
          </div>

          {/* Submit Attendance Button */}
          <button
            onClick={handleSaveAttendance}
            disabled={submitting || loading || students.length === 0}
            className="flex-1 sm:flex-initial px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-95"
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            <span>Submit Attendance</span>
          </button>
        </div>
      </div>

      {/* Class Selection Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
        {CLASS_OPTIONS.map((cls) => (
          <button
            key={cls}
            type="button"
            onClick={() => setSelectedClass(cls)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedClass === cls
                ? "bg-blue-600 text-white shadow-sm font-bold"
                : "bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/5 text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-white/[0.04]"
            }`}
          >
            {cls}
          </button>
        ))}
      </div>

      {/* Metric Counter Cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="p-4 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/5 rounded-2xl shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total In Class</div>
          <div className="text-2xl font-black text-gray-900 dark:text-white mt-1">{totalInClass}</div>
        </div>

        <div className="p-4 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/5 rounded-2xl shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Present</div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{presentCount}</div>
        </div>

        <div className="p-4 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/5 rounded-2xl shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-wider text-red-500">Absent</div>
          <div className="text-2xl font-black text-red-500 mt-1">{absentCount}</div>
        </div>
      </div>

      {/* Quick Mark Toolbar (1-Tap Helpers) */}
      <div className="flex items-center justify-between text-xs px-1">
        <span className="text-gray-500">
          Tip: If a student is absent, simply click once on their card.
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => markAll("Present")}
            className="px-3 py-1 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-lg font-semibold text-[11px] transition-all"
          >
            Mark All Present
          </button>
          <button
            type="button"
            onClick={() => markAll("Absent")}
            className="px-3 py-1 bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 hover:bg-red-100 rounded-lg font-semibold text-[11px] transition-all"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Student List (1-Click Fast Tap: Absent Highlighted in Striking Red) */}
      <div className="space-y-2.5">
        {loading ? (
          <div className="p-12 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
            <Loader2 className="animate-spin text-blue-600" size={18} />
            <span>শিক্ষার্থী তালিকা লোড হচ্ছে...</span>
          </div>
        ) : students.length === 0 ? (
          <div className="p-10 text-center bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl text-xs text-gray-400">
            {selectedClass}-এ কোনো নিবন্ধিত শিক্ষার্থী পাওয়া যায়নি।
          </div>
        ) : (
          students.map((st) => {
            const isAbsent = attendanceMap[st.id] === "Absent";

            return (
              <div
                key={st.id}
                onClick={() => toggleStudentStatus(st.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                  isAbsent
                    ? "bg-red-500/10 border-red-500/60 dark:border-red-500/50 shadow-sm"
                    : "bg-white dark:bg-[#0f0f11] border-gray-200 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/10"
                }`}
              >
                {/* Roll & Student Details */}
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono font-bold text-xs transition-colors ${
                    isAbsent
                      ? "bg-red-500 text-white"
                      : "bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300"
                  }`}>
                    {st.roll_number || "—"}
                  </span>
                  <div>
                    <h4 className={`font-bold text-xs sm:text-sm ${
                      isAbsent ? "text-red-600 dark:text-red-400 font-extrabold" : "text-gray-900 dark:text-white"
                    }`}>
                      {st.first_name} {st.last_name}
                    </h4>
                    <span className="text-[10px] text-gray-400 font-mono">
                      Roll: {st.roll_number || "00"} • ID: {st.admission_number}
                    </span>
                  </div>
                </div>

                {/* 🚀 Status Badge: Striking Red for Absent, Clean Green for Present */}
                <div>
                  {isAbsent ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-red-600 text-white shadow-sm shadow-red-500/20">
                      <X size={13} /> Absent
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      <Check size={13} /> Present
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}