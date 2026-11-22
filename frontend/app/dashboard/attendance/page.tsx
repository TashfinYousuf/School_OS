"use client";

import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/components/providers";
import { fetchWithTenant } from "@/lib/api-client";
import { saveToOfflineAttendanceQueue, flushOfflineAttendanceQueue } from "@/lib/offlineQueue";
import { useAcademicClasses } from "@/lib/useAcademicClasses";
import { 
  Users, Check, X, Wifi, WifiOff, Send, ShieldCheck, 
  AlertCircle, Loader2, Calendar, Phone, MessageCircle, 
  FileSpreadsheet, Printer, Download, Clock, Filter, ChevronRight, UserCheck
} from "lucide-react";

interface StudentItem {
  id: string;
  first_name: string;
  last_name: string;
  roll_number: string;
  admission_number: string;
}

interface AttendanceRecordItem {
  id: string;
  student_id: string;
  student_name: string;
  admission_number: string;
  roll_number: string;
  class_name: string;
  date: string;
  status: string;
  check_in_time: string | null;
  remarks: string | null;
}

interface AbsenteeItem {
  event_id: string;
  student_id: string;
  student_name: string;
  admission_number: string;
  roll_number: string;
  class_name: string;
  guardian_name: string | null;
  guardian_phone: string | null;
  relationship: string | null;
  remarks: string | null;
  date: string;
}

interface GuardianChildInfo {
  student_id: string;
  student_name: string;
  admission_number: string;
  class_name: string;
  roll_number: string;
  relationship: string;
  attendance: {
    total_days: number;
    present_days: number;
    absent_days: number;
    late_days: number;
    rate_percentage: number;
    today_status: string;
  };
}

export default function AttendanceSuitePage() {
  const { language } = useLanguage();
  const { classNames: dynamicClasses } = useAcademicClasses();
  const classOptions = ["All", ...dynamicClasses];
  const [userRole, setUserRole] = useState<string>("admin");
  const [activeTab, setActiveTab] = useState<"take" | "ledger" | "absent">("take");

  // Daily Roll Call State
  const [selectedClass, setSelectedClass] = useState("Class 5");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedPeriod, setSelectedPeriod] = useState("DAILY");
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, "Present" | "Absent">>({});
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [offlinePending, setOfflinePending] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // History & Ledger State
  const [ledgerClass, setLedgerClass] = useState("All");
  const [ledgerStartDate, setLedgerStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [ledgerEndDate, setLedgerEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [ledgerStatus, setLedgerStatus] = useState("All");
  const [ledgerRecords, setLedgerRecords] = useState<AttendanceRecordItem[]>([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Absentee Outreach State
  const [absentDate, setAbsentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [absentClass, setAbsentClass] = useState("All");
  const [absentees, setAbsentees] = useState<AbsenteeItem[]>([]);
  const [loadingAbsentees, setLoadingAbsentees] = useState(false);

  // Guardian / Student Portal State
  const [guardianChildren, setGuardianChildren] = useState<GuardianChildInfo[]>([]);
  const [selectedChildIndex, setSelectedChildIndex] = useState(0);
  const [studentHistoryRecords, setStudentHistoryRecords] = useState<Array<{ id?: string; date: string; status: string; remarks?: string; check_in_time?: string }>>([]);
  const [loadingPortal, setLoadingPortal] = useState(true);

  const checkOfflineQueue = () => {
    const queue = localStorage.getItem("offline_attendance_queue");
    setOfflinePending(!!queue && JSON.parse(queue).length > 0);
  };

  const autoSyncOfflineQueue = async () => {
    try {
      const synced = await flushOfflineAttendanceQueue();
      if (synced > 0) {
        setOfflinePending(false);
        setSyncMessage(language === "EN" ? "All queued offline records synced!" : "সব অফলাইন রেকর্ড সার্ভারে সিঙ্ক হয়েছে!");
      }
    } catch (e) {
      console.warn("Auto-sync error", e);
    }
  };

  useEffect(() => {
    const role = (localStorage.getItem("user_role") || "admin").toLowerCase();
    queueMicrotask(() => {
      setUserRole(role);
      setIsOnline(navigator.onLine);
      checkOfflineQueue();
    });

    const handleOnline = () => { setIsOnline(true); void autoSyncOfflineQueue(); };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Fetch Portal Data for Guardian or Student
  const fetchPortalData = useCallback(async () => {
    setLoadingPortal(true);
    try {
      if (userRole === "guardian") {
        const res = await fetchWithTenant("/api/v1/guardians/me/children");
        if (res.ok) {
          const data: GuardianChildInfo[] = await res.json();
          setGuardianChildren(data);
          if (data.length > 0) {
            const childId = data[0].student_id;
            const histRes = await fetchWithTenant(`/api/v1/attendance/student/${childId}`);
            if (histRes.ok) {
              const histData = await histRes.json();
              setStudentHistoryRecords(histData.records || []);
            }
          }
        }
      } else if (userRole === "student") {
        let studentId = localStorage.getItem("student_id");
        if (!studentId) {
          const dashRes = await fetchWithTenant("/api/v1/students/me/dashboard");
          if (dashRes.ok) {
            const dashData = await dashRes.json();
            studentId = dashData?.student?.id || null;
            if (studentId) localStorage.setItem("student_id", studentId);
          }
        }
        if (studentId) {
          const res = await fetchWithTenant(`/api/v1/attendance/student/${studentId}`);
          if (res.ok) {
            const histData = await res.json();
            setStudentHistoryRecords(histData.records || []);
          }
        }
      }
    } catch (err) {
      console.warn("Failed to fetch portal attendance:", err);
    } finally {
      setLoadingPortal(false);
    }
  }, [userRole]);

  useEffect(() => {
    if (userRole === "guardian" || userRole === "student") {
      queueMicrotask(() => {
        void fetchPortalData();
      });
    }
  }, [userRole, fetchPortalData]);

  // Load Child Details when Guardian switches child
  const handleSelectChild = async (idx: number) => {
    setSelectedChildIndex(idx);
    const child = guardianChildren[idx];
    if (child) {
      try {
        const res = await fetchWithTenant(`/api/v1/attendance/student/${child.student_id}`);
        if (res.ok) {
          const histData = await res.json();
          setStudentHistoryRecords(histData.records || []);
        }
      } catch (err) {
        console.warn("Failed to switch child attendance:", err);
      }
    }
  };

  // Fetch Class Roster for Daily Roll Call
  const fetchStudents = useCallback(async () => {
    if (userRole === "guardian" || userRole === "student") return;
    setLoadingStudents(true);
    try {
      const cls = selectedClass === "All" ? "Class 5" : selectedClass;
      // Fetch period-specific attendance sheet
      const res = await fetchWithTenant(
        `/api/v1/attendance/sheet?class_name=${encodeURIComponent(cls)}&attendance_date=${selectedDate}&period_number=${encodeURIComponent(selectedPeriod)}`
      );
      if (res.ok) {
        const data: Array<StudentItem & { status?: string }> = await res.json();
        setStudents(data);
        const initialMap: Record<string, "Present" | "Absent"> = {};
        data.forEach((s) => {
          initialMap[s.id] = (s.status === "Absent" ? "Absent" : "Present");
        });
        setAttendanceMap(initialMap);
      } else {
        const fallbackRes = await fetchWithTenant(`/api/v1/students?class_name=${encodeURIComponent(cls)}`);
        if (fallbackRes.ok) {
          const data: StudentItem[] = await fallbackRes.json();
          setStudents(data);
          const initialMap: Record<string, "Present" | "Absent"> = {};
          data.forEach((s) => { initialMap[s.id] = "Present"; });
          setAttendanceMap(initialMap);
        }
      }
    } catch {
      const cached = localStorage.getItem(`roster_${selectedClass}`);
      if (cached) {
        const data: StudentItem[] = JSON.parse(cached);
        setStudents(data);
        const initialMap: Record<string, "Present" | "Absent"> = {};
        data.forEach((s) => { initialMap[s.id] = "Present"; });
        setAttendanceMap(initialMap);
      }
    } finally {
      setLoadingStudents(false);
    }
  }, [selectedClass, selectedDate, selectedPeriod, userRole]);

  useEffect(() => {
    if (activeTab === "take") {
      queueMicrotask(() => {
        void fetchStudents();
      });
    }
  }, [activeTab, fetchStudents]);

  // Fetch Ledger Records
  const fetchLedger = useCallback(async () => {
    setLoadingLedger(true);
    try {
      const params = new URLSearchParams();
      if (ledgerClass !== "All") params.append("class_name", ledgerClass);
      if (ledgerStartDate) params.append("start_date", ledgerStartDate);
      if (ledgerEndDate) params.append("end_date", ledgerEndDate);
      if (ledgerStatus !== "All") params.append("status", ledgerStatus);
      params.append("limit", "100");

      const res = await fetchWithTenant(`/api/v1/attendance/records?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLedgerRecords(data.records || []);
        setLedgerTotal(data.total || 0);
      }
    } catch (err) {
      console.warn("Failed to fetch attendance ledger:", err);
    } finally {
      setLoadingLedger(false);
    }
  }, [ledgerClass, ledgerStartDate, ledgerEndDate, ledgerStatus]);

  useEffect(() => {
    if (activeTab === "ledger") {
      queueMicrotask(() => {
        void fetchLedger();
      });
    }
  }, [activeTab, fetchLedger]);

  // Fetch Absentee Outreach Roster
  const fetchAbsentees = useCallback(async () => {
    setLoadingAbsentees(true);
    try {
      const params = new URLSearchParams();
      if (absentDate) params.append("attendance_date", absentDate);
      if (absentClass !== "All") params.append("class_name", absentClass);

      const res = await fetchWithTenant(`/api/v1/attendance/absent-list?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAbsentees(data.absentees || []);
      }
    } catch (err) {
      console.warn("Failed to fetch absentees:", err);
    } finally {
      setLoadingAbsentees(false);
    }
  }, [absentDate, absentClass]);

  useEffect(() => {
    if (activeTab === "absent") {
      queueMicrotask(() => {
        void fetchAbsentees();
      });
    }
  }, [activeTab, fetchAbsentees]);

  // Roll Call Helpers
  const toggleStudentStatus = (studentId: string) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: prev[studentId] === "Present" ? "Absent" : "Present"
    }));
  };

  const markAll = (status: "Present" | "Absent") => {
    const nextMap: Record<string, "Present" | "Absent"> = {};
    students.forEach((s) => { nextMap[s.id] = status; });
    setAttendanceMap(nextMap);
  };

  const handleSaveAttendance = async () => {
    setSubmitting(true);
    const records = Object.entries(attendanceMap).map(([student_id, status]) => ({ student_id, status }));
    const cls = selectedClass === "All" ? "Class 5" : selectedClass;
    const bulkPayload = {
      attendance_date: selectedDate,
      class_name: cls,
      section: "A",
      period_number: selectedPeriod,
      records: Object.entries(attendanceMap).map(([student_id, status]) => ({
        student_id,
        status,
        remarks: null,
      }))
    };

    if (!navigator.onLine) {
      await saveToOfflineAttendanceQueue({
        className: cls,
        attendanceDate: selectedDate,
        records
      });
      window.dispatchEvent(new Event("offline-queue-updated"));
      setOfflinePending(true);
      setSyncMessage(language === "EN" ? "Saved to offline queue. Will auto-sync when connected." : "নিরাপদ অফলাইন কিউতে সংরক্ষিত হয়েছে।");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetchWithTenant("/api/v1/attendance/bulk-submit", {
        method: "POST",
        body: JSON.stringify(bulkPayload)
      });
      if (res.ok) {
        setSyncMessage(language === "EN" ? `Attendance (${selectedPeriod}) recorded & synced successfully!` : `হাজিরা (${selectedPeriod}) সফলভাবে ডেটাবেসে সংরক্ষিত হয়েছে!`);
        setTimeout(() => setSyncMessage(null), 3500);
      } else {
        // Fallback to sync-offline
        const legacyPayload = {
          class_name: cls,
          date: selectedDate,
          sync_idempotency_key: `IDEMP-ATT-${cls}-${selectedDate}-${selectedPeriod}-${Date.now()}`,
          records
        };
        const resLegacy = await fetchWithTenant("/api/v1/attendance/sync-offline", {
          method: "POST",
          body: JSON.stringify(legacyPayload)
        });
        if (resLegacy.ok) {
          setSyncMessage(language === "EN" ? "Attendance recorded & synced successfully!" : "হাজিরা সফলভাবে ডেটাবেসে সংরক্ষিত হয়েছে!");
          setTimeout(() => setSyncMessage(null), 3500);
        } else {
          alert("Failed to submit attendance. Please try again.");
        }
      }
    } catch {
      await saveToOfflineAttendanceQueue({
        className: cls,
        attendanceDate: selectedDate,
        records
      });
      window.dispatchEvent(new Event("offline-queue-updated"));
      setOfflinePending(true);
      setSyncMessage(language === "EN" ? "Network unstable. Saved to offline queue." : "নেটওয়ার্ক বিচ্ছিন্ন। অফলাইনে সংরক্ষিত হয়েছে।");
    } finally {
      setSubmitting(false);
    }
  };

  // Export CSV (Authenticated Blob Download)
  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (ledgerClass !== "All") params.append("class_name", ledgerClass);
      if (ledgerStartDate) params.append("start_date", ledgerStartDate);
      if (ledgerEndDate) params.append("end_date", ledgerEndDate);
      params.append("format", "csv");

      const res = await fetchWithTenant(`/api/v1/attendance/export?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to export attendance CSV. Insufficient permissions or session expired.");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance_ledger_${(ledgerClass || "all").replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to download attendance CSV.");
    }
  };

  // Print HTML Report (Authenticated Document Writing)
  const handlePrintHTML = async () => {
    try {
      const params = new URLSearchParams();
      if (ledgerClass !== "All") params.append("class_name", ledgerClass);
      if (ledgerStartDate) params.append("start_date", ledgerStartDate);
      if (ledgerEndDate) params.append("end_date", ledgerEndDate);
      params.append("format", "html");

      const res = await fetchWithTenant(`/api/v1/attendance/export?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load printable report. Insufficient permissions or session expired.");

      const html = await res.text();
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      } else {
        alert("Pop-up blocked. Please allow pop-ups for this site to print.");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to generate printable report.");
    }
  };

  // =========================================================================
  // GUARDIAN & STUDENT AUTHENTIC VIEW
  // =========================================================================
  if (userRole === "guardian" || userRole === "student") {
    const currentChild = guardianChildren[selectedChildIndex] || null;

    return (
      <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
        <div className="border-b border-gray-200 dark:border-white/10 pb-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 bg-purple-50 dark:bg-purple-500/10 px-2.5 py-1 rounded-full">
            {userRole === "guardian" ? "Parent Portal • Biometric & Daily Log" : "Student Study Room • Attendance Log"}
          </span>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white mt-1">
            {userRole === "guardian" ? "Child Attendance & Punctuality Record" : "My Attendance & Punctuality Record"}
          </h1>
          <p className="text-xs text-gray-500">Official real-time attendance ledger recorded by classroom teachers.</p>
        </div>

        {/* Multi-Child Selector Pill Bar for Guardians */}
        {userRole === "guardian" && guardianChildren.length > 1 && (
          <div className="flex items-center gap-2 p-1.5 bg-gray-100 dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2">Select Child:</span>
            {guardianChildren.map((child, idx) => (
              <button
                key={child.student_id}
                onClick={() => handleSelectChild(idx)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-semibold transition-all ${
                  selectedChildIndex === idx
                    ? "bg-white dark:bg-[#1a1a1e] text-purple-600 dark:text-purple-400 shadow-sm"
                    : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <span>{child.student_name}</span>
                <span className="text-[10px] opacity-70">({child.class_name})</span>
              </button>
            ))}
          </div>
        )}

        {/* Live Attendance Metric Cards */}
        {loadingPortal ? (
          <div className="p-8 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" />
            <span>Loading authentic attendance records...</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl shadow-sm">
                <span className="text-[10px] uppercase font-bold text-gray-400">Total Working Days</span>
                <div className="text-2xl font-black text-gray-900 dark:text-white mt-1">
                  {currentChild?.attendance?.total_days ?? studentHistoryRecords.length} Days
                </div>
                <p className="text-[10px] text-gray-500">Current Academic Term</p>
              </div>

              <div className="p-5 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl shadow-sm">
                <span className="text-[10px] uppercase font-bold text-emerald-500">Present</span>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {currentChild?.attendance?.present_days ?? studentHistoryRecords.filter(r => r.status === "Present").length} Days
                </div>
                <p className="text-[10px] text-emerald-500 font-semibold">
                  {currentChild?.attendance?.rate_percentage != null
                    ? `${currentChild.attendance.rate_percentage}% Attendance Rate`
                    : studentHistoryRecords.length > 0
                    ? `${Math.round(studentHistoryRecords.filter(r => r.status === "Present").length / studentHistoryRecords.length * 100)}% Attendance Rate`
                    : "No Attendance Records Yet"}
                </p>
              </div>

              <div className="p-5 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl shadow-sm">
                <span className="text-[10px] uppercase font-bold text-red-500">Absent</span>
                <div className="text-2xl font-black text-red-500 mt-1">
                  {currentChild?.attendance?.absent_days ?? studentHistoryRecords.filter(r => r.status === "Absent").length} Days
                </div>
                <p className="text-[10px] text-gray-400">Classroom Absences</p>
              </div>
            </div>

            {/* Date-wise Log Sheet */}
            <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-5 shadow-sm space-y-3">
              <h3 className="font-bold text-xs text-gray-900 dark:text-white border-b border-gray-100 dark:border-white/5 pb-2">
                Classroom Attendance History Log
              </h3>
              {studentHistoryRecords.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-400">
                  No attendance records recorded for this academic term yet.
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-white/5 text-xs">
                  {studentHistoryRecords.map((item, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-gray-900 dark:text-white font-mono">{item.date}</span>
                        {item.remarks && <span className="text-[11px] text-gray-400 block">{item.remarks}</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 font-mono text-[11px]">{item.check_in_time || "—"}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          item.status === "Present" 
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                            : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                        }`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // =========================================================================
  // TEACHER & ADMIN ENTERPRISE SUITE
  // =========================================================================
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
          <span className="text-[10px] font-mono uppercase bg-amber-500/20 px-2 py-0.5 rounded">Local Storage Queue</span>
        </div>
      )}

      {/* Sync Success Feedback */}
      {syncMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs flex items-center gap-2 animate-in slide-in-from-top-2">
          <ShieldCheck size={16} />
          <span>{syncMessage}</span>
        </div>
      )}

      {/* Top Header: Title & Tab Navigation */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-white/10 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <span>{language === "EN" ? "Attendance Command Center" : "ডিজিটাল হাজিরা কমান্ড সেন্টার"}</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {language === "EN" ? "Classroom roll call, comprehensive history ledger, and daily absentee follow-up" : "শ্রেণিকক্ষের রোল কল, পূর্ণাঙ্গ হাজিরা হিস্ট্রি ও অনুপস্থিতি ফলো-আপ"}
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10 text-xs">
          <button
            onClick={() => setActiveTab("take")}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "take"
                ? "bg-white dark:bg-[#1a1a1e] text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <UserCheck size={14} />
            <span>{language === "EN" ? "Daily Roll Call" : "দৈনিক রোল কল"}</span>
          </button>
          <button
            onClick={() => setActiveTab("ledger")}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "ledger"
                ? "bg-white dark:bg-[#1a1a1e] text-purple-600 dark:text-purple-400 shadow-sm"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <FileSpreadsheet size={14} />
            <span>{language === "EN" ? "Ledger & History" : "হাজিরা লেজার"}</span>
          </button>
          <button
            onClick={() => setActiveTab("absent")}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "absent"
                ? "bg-white dark:bg-[#1a1a1e] text-red-600 dark:text-red-400 shadow-sm"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <Phone size={14} />
            <span>{language === "EN" ? "Absentee Outreach" : "অনুপস্থিতি আউটরিচ"}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DAILY ROLL CALL                                                    */}
      {/* ========================================================================= */}
      {activeTab === "take" && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Class:</span>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="px-3 py-1.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-medium outline-none"
                >
                  {classOptions.filter(c => c !== "All").map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-gray-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-medium outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <Clock size={14} className="text-gray-400" />
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="px-3 py-1.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-medium outline-none"
                >
                  <option value="DAILY">Daily (দৈনিক সাধারণ)</option>
                  <option value="Period 1">Period 1 (১ম পিরিয়ড)</option>
                  <option value="Period 2">Period 2 (২য় পিরিয়ড)</option>
                  <option value="Period 3">Period 3 (৩য় পিরিয়ড)</option>
                  <option value="Period 4">Period 4 (৪র্থ পিরিয়ড)</option>
                  <option value="Period 5">Period 5 (৫ম পিরিয়ড)</option>
                  <option value="Period 6">Period 6 (৬ষ্ঠ পিরিয়ড)</option>
                  <option value="Period 7">Period 7 (৭ম পিরিয়ড)</option>
                  <option value="Period 8">Period 8 (৮ম পিরিয়ড)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => markAll("Present")}
                className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded-xl text-xs font-semibold hover:bg-emerald-100 transition-colors"
              >
                {language === "EN" ? "All Present" : "সবাই উপস্থিত"}
              </button>
              <button
                onClick={() => markAll("Absent")}
                className="px-3 py-1.5 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-xl text-xs font-semibold hover:bg-red-100 transition-colors"
              >
                {language === "EN" ? "All Absent" : "সবাই অনুপস্থিত"}
              </button>
              <button
                onClick={handleSaveAttendance}
                disabled={submitting || students.length === 0}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 transition-all shadow-sm"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                <span>{language === "EN" ? "Save Attendance" : "হাজিরা সংরক্ষণ"}</span>
              </button>
            </div>
          </div>

          {/* Metrics summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm">
              <span className="text-[10px] uppercase font-bold text-gray-400">
                {language === "EN" ? "Enrolled In Class" : "শ্রেণিতে মোট শিক্ষার্থী"}
              </span>
              <div className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">{students.length}</div>
            </div>
            <div className="p-4 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm">
              <span className="text-[10px] uppercase font-bold text-emerald-500">
                {language === "EN" ? "Present" : "উপস্থিত"}
              </span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{presentCount}</div>
            </div>
            <div className="p-4 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm">
              <span className="text-[10px] uppercase font-bold text-red-500">
                {language === "EN" ? "Absent" : "অনুপস্থিত"}
              </span>
              <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-0.5">{absentCount}</div>
            </div>
          </div>

          {/* Student Roll Call Grid */}
          {loadingStudents ? (
            <div className="p-12 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              <span>Loading student roster...</span>
            </div>
          ) : students.length === 0 ? (
            <div className="p-12 text-center text-xs text-gray-400 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl">
              No active students enrolled in {selectedClass}.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {students.map((student) => {
                const isPresent = attendanceMap[student.id] === "Present";
                return (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => toggleStudentStatus(student.id)}
                    className={`p-4 rounded-2xl border text-left transition-all flex items-center justify-between group ${
                      isPresent
                        ? "bg-white dark:bg-[#0f0f11] border-emerald-500/30 hover:border-emerald-500"
                        : "bg-red-50/50 dark:bg-red-500/5 border-red-500/30 hover:border-red-500"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-white/10 font-mono text-[10px] font-bold flex items-center justify-center">
                          {student.roll_number || "—"}
                        </span>
                        <h4 className="font-bold text-xs text-gray-900 dark:text-white">
                          {student.first_name} {student.last_name}
                        </h4>
                      </div>
                      <span className="text-[10px] text-gray-400 block mt-1 font-mono">
                        {student.admission_number}
                      </span>
                    </div>

                    <div className={`px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase flex items-center gap-1 ${
                      isPresent
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                        : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400"
                    }`}>
                      {isPresent ? <Check size={12} /> : <X size={12} />}
                      <span>{isPresent ? "Present" : "Absent"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ATTENDANCE LEDGER & HISTORY                                         */}
      {/* ========================================================================= */}
      {activeTab === "ledger" && (
        <div className="space-y-6">
          {/* Filters & Export Bar */}
          <div className="p-4 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">Class:</span>
                <select
                  value={ledgerClass}
                  onChange={(e) => setLedgerClass(e.target.value)}
                  className="px-3 py-1.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-xs outline-none"
                >
                  {classOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">From:</span>
                <input
                  type="date"
                  value={ledgerStartDate}
                  onChange={(e) => setLedgerStartDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-xs outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">To:</span>
                <input
                  type="date"
                  value={ledgerEndDate}
                  onChange={(e) => setLedgerEndDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-xs outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">Status:</span>
                <select
                  value={ledgerStatus}
                  onChange={(e) => setLedgerStatus(e.target.value)}
                  className="px-3 py-1.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-xs outline-none"
                >
                  <option value="All">All Statuses</option>
                  <option value="Present">Present</option>
                  <option value="Absent">Absent</option>
                  <option value="Late">Late</option>
                  <option value="Excused">Excused</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded-xl text-xs font-semibold hover:bg-emerald-100 flex items-center gap-1.5 transition-colors"
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>
              <button
                onClick={handlePrintHTML}
                className="px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 rounded-xl text-xs font-semibold hover:bg-blue-100 flex items-center gap-1.5 transition-colors"
              >
                <Printer size={13} />
                <span>Print Report</span>
              </button>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between text-xs">
              <span className="font-bold text-gray-900 dark:text-white">Class Attendance Ledger</span>
              <span className="text-gray-400 font-mono">Total {ledgerTotal} Records</span>
            </div>

            {loadingLedger ? (
              <div className="p-12 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                <span>Querying attendance records...</span>
              </div>
            ) : ledgerRecords.length === 0 ? (
              <div className="p-12 text-center text-xs text-gray-400">
                No attendance records matched the selected filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 dark:bg-white/[0.02] text-gray-400 border-b border-gray-100 dark:border-white/5 text-[10px] uppercase font-bold tracking-wider">
                    <tr>
                      <th className="p-3 pl-4">Date</th>
                      <th className="p-3">Admission No</th>
                      <th className="p-3">Roll</th>
                      <th className="p-3">Student Name</th>
                      <th className="p-3">Class</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Time</th>
                      <th className="p-3 pr-4">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {ledgerRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="p-3 pl-4 font-mono font-medium text-gray-900 dark:text-white">{r.date}</td>
                        <td className="p-3 font-mono text-gray-500">{r.admission_number}</td>
                        <td className="p-3 font-mono font-bold text-gray-700 dark:text-neutral-300">{r.roll_number}</td>
                        <td className="p-3 font-bold text-gray-900 dark:text-white">{r.student_name}</td>
                        <td className="p-3 text-gray-500">{r.class_name}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            r.status === "Present"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                              : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                          }`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="p-3 text-gray-400 font-mono">{r.check_in_time || "—"}</td>
                        <td className="p-3 pr-4 text-gray-500">{r.remarks || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DAILY ABSENTEE OUTREACH                                            */}
      {/* ========================================================================= */}
      {activeTab === "absent" && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="p-4 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-gray-400" />
                <span className="text-xs text-gray-500">Date:</span>
                <input
                  type="date"
                  value={absentDate}
                  onChange={(e) => setAbsentDate(e.target.value)}
                  className="px-3 py-1.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-xs outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Class:</span>
                <select
                  value={absentClass}
                  onChange={(e) => setAbsentClass(e.target.value)}
                  className="px-3 py-1.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-xs outline-none"
                >
                  {classOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="text-xs text-gray-400">
              Direct telephone & WhatsApp communication with guardians of absent students
            </div>
          </div>

          {/* Absentees List */}
          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between text-xs">
              <span className="font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <AlertCircle size={15} />
                <span>Absent Students Follow-up Roster</span>
              </span>
              <span className="text-gray-400 font-mono">Total {absentees.length} Absent</span>
            </div>

            {loadingAbsentees ? (
              <div className="p-12 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                <span>Checking daily absence logs...</span>
              </div>
            ) : absentees.length === 0 ? (
              <div className="p-12 text-center text-xs text-gray-400">
                100% attendance! No students recorded as Absent on {absentDate}.
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-white/5 text-xs">
                {absentees.map((item) => (
                  <div key={item.event_id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-gray-100 dark:bg-white/10">
                          {item.class_name} • Roll {item.roll_number}
                        </span>
                        <h4 className="font-bold text-gray-900 dark:text-white">
                          {item.student_name}
                        </h4>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">
                        Guardian: <strong className="text-gray-700 dark:text-gray-400">{item.guardian_name || "Not registered"}</strong> 
                        {item.relationship && <span className="opacity-70"> ({item.relationship})</span>}
                        {item.remarks && <span className="ml-2 italic text-red-500">&ldquo;{item.remarks}&rdquo;</span>}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.guardian_phone ? (
                        <>
                          <a
                            href={`tel:${item.guardian_phone}`}
                            className="px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-800 dark:text-neutral-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                          >
                            <Phone size={13} className="text-blue-500" />
                            <span>Call ({item.guardian_phone})</span>
                          </a>
                          <a
                            href={`https://wa.me/${item.guardian_phone.startsWith("0") ? "88" + item.guardian_phone : item.guardian_phone}?text=Dear%20Parent,%20your%20child%20${encodeURIComponent(item.student_name)}%20was%20marked%20absent%20today.`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-100 transition-colors"
                          >
                            <MessageCircle size={13} className="text-emerald-500" />
                            <span>WhatsApp</span>
                          </a>
                        </>
                      ) : (
                        <span className="text-[11px] text-gray-400 italic">No phone on file</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
