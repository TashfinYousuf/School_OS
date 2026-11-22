"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/providers";
import { safeFetch } from "@/lib/apiClient";
import { 
  Users, CheckCircle2, XCircle, GraduationCap, ShieldCheck, 
  ArrowUpRight, Fingerprint, BookOpen, Trophy, Plus, 
  Sparkles, Wallet, Clock, Bot, FileText, Check,
  HeartHandshake, ArrowRight, CalendarCheck, Calendar, AlertCircle
} from "lucide-react";
import ResponsiveDialog from "@/components/ui/ResponsiveDialog";

interface DashboardMetrics {
  total_students: number;
  present_today: number;
  absent_today: number;
  total_teachers: number;
  pending_approvals: number;
  server_date_bd?: string;
  weekly?: {
    week_start: string;
    week_end: string;
    collection_week_bdt: number;
    transactions_week: number;
    new_admissions_week: number;
  };
  monthly_aggregation?: {
    month_name: string;
    month_start: string;
    collection_mtd_bdt: number;
    admissions_mtd: number;
    weeks_breakdown: Array<{
      week_label: string;
      start_date: string;
      end_date: string;
      collection_bdt: number;
      is_current: boolean;
    }>;
  };
}

interface MonthEndPreviewData {
  status: string;
  month_name: string;
  days_remaining_in_month: number;
  cycle_transition_date: string;
  kpi_summary: {
    total_collected_bdt: number;
    pending_receivables_bdt: number;
    new_admissions_count: number;
    total_active_students: number;
    average_attendance_rate_pct: number;
  };
  audit_checklist: Array<{ item: string; passed: boolean }>;
  recommendation: string;
}

interface KpiOverview {
  attendance_rate?: number;
  active_students?: number;
  fee_collection_rate?: number;
  daily_highlights?: string[];
  total_hours_saved?: number;
  estimated_cost_saved_bdt?: number;
  breakdown?: {
    attendance_events?: number;
    question_blueprints?: number;
    nctb_gradings?: number;
    notices_sent?: number;
    fee_transactions?: number;
  };
}

interface StudentDashboardSummary {
  student?: { id?: string; name?: string; class_name?: string; roll_number?: string | number; section?: string };
  attendance?: { rate_percentage?: number | null; today_status?: string | null };
  academics?: { standing?: string | null };
  routine_today?: { periods_count?: number | null; day?: string | null };
  fees?: { status?: string | null; total_paid?: number | null };
}

interface TeacherWorkloadSummary {
  teacher_id: string;
  first_name: string;
  last_name: string;
  name_bn?: string;
  employee_id?: string;
  designation?: string;
  department?: string;
  assigned_class?: string;
  subjects_taught?: string;
  day_of_week: string;
  today_periods_count: number;
  total_weekly_periods: number;
  today_schedule: Array<{
    id: string;
    class_name: string;
    section: string;
    shift: string;
    day_of_week: string;
    period_number: string;
    start_time: string;
    end_time: string;
    subject: string;
    room_number: string;
  }>;
  assigned_class_student_count: number;
  assigned_class_attendance_summary: {
    present: number;
    absent: number;
    total_marked: number;
    rate_pct: number;
  };
}

interface GuardianChildItem {
  student_id: string;
  student_name: string;
  class_name: string;
  attendance?: { rate_percentage?: number | null; today_status?: string | null };
  academics?: { standing?: string | null };
  fees?: { status?: string | null; total_paid?: number | null };
}

function MetricCardValue({
  value,
  loading,
  className = "text-3xl font-black text-gray-900 dark:text-white mt-1",
}: {
  value: number | string | undefined;
  loading: boolean;
  className?: string;
}) {
  if (loading) {
    return <div className="h-9 w-20 bg-gray-200 dark:bg-white/10 animate-pulse rounded-xl my-1" />;
  }
  return <div className={className}>{value ?? 0}</div>;
}

function MetricCardSubValue({
  value,
  loading,
  className = "text-2xl font-black font-mono",
}: {
  value: string | number;
  loading: boolean;
  className?: string;
}) {
  if (loading) {
    return <div className="h-7 w-24 bg-gray-200 dark:bg-white/10 animate-pulse rounded-lg my-1" />;
  }
  return <div className={className}>{value}</div>;
}

export default function DashboardOverviewPage() {
  const router = useRouter();
  const { language } = useLanguage();
  
  const [userRole, setUserRole] = useState<string>("admin");
  const [userName, setUserName] = useState<string>("User");

  const [metrics, setMetrics] = useState<DashboardMetrics>({
    total_students: 0,
    present_today: 0,
    absent_today: 0,
    total_teachers: 0,
    pending_approvals: 0
  });
  const [kpiData, setKpiData] = useState<KpiOverview | null>(null);

  // Month-End Preview State for Admin
  const [isMonthEndPreviewOpen, setIsMonthEndPreviewOpen] = useState(false);
  const [monthEndPreviewData, setMonthEndPreviewData] = useState<MonthEndPreviewData | null>(null);
  const [loadingMonthEndPreview, setLoadingMonthEndPreview] = useState(false);

  const fetchMonthEndPreview = async () => {
    setIsMonthEndPreviewOpen(true);
    setLoadingMonthEndPreview(true);
    try {
      const res = await safeFetch<MonthEndPreviewData>("/api/v1/dashboard/month-end-preview");
      if (res.data) setMonthEndPreviewData(res.data);
    } finally {
      setLoadingMonthEndPreview(false);
    }
  };

  // Authentic Student & Guardian Role State
  const [studentDashboard, setStudentDashboard] = useState<StudentDashboardSummary | null>(null);
  const [teacherWorkload, setTeacherWorkload] = useState<TeacherWorkloadSummary | null>(null);
  const [guardianChildren, setGuardianChildren] = useState<GuardianChildItem[]>([]);
  const [selectedChildIndex, setSelectedChildIndex] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const [metricsLoaded, setMetricsLoaded] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  useEffect(() => {
    const role = (localStorage.getItem("user_role") || "").toLowerCase();
    if (!role) { router.replace("/login"); return; }
    const name = localStorage.getItem("user_name") || "User";
    queueMicrotask(() => {
      setUserRole(role);
      setUserName(name);
    });

    // Hydrate metrics from session cache immediately to eliminate zero-flicker on refresh
    try {
      const cached = sessionStorage.getItem("educationos_dashboard_metrics_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed.total_students === "number") {
          setMetrics(parsed);
          setMetricsLoaded(true);
        }
      }
    } catch {
      // Ignore cache parse errors
    }

    const fetchOverviewData = async () => {
      try {
        if (role === "teacher") {
          const [metRes, kpiRes, workRes] = await Promise.all([
            safeFetch<typeof metrics>("/api/v1/dashboard/metrics"),
            safeFetch<KpiOverview>("/api/v1/dashboard/operational-kpi"),
            safeFetch<TeacherWorkloadSummary>("/api/v1/teachers/me/workload")
          ]);
          if (metRes.data) {
            setMetrics(metRes.data);
            setMetricsLoaded(true);
            try { sessionStorage.setItem("educationos_dashboard_metrics_cache", JSON.stringify(metRes.data)); } catch {}
          }
          if (kpiRes.data) setKpiData(kpiRes.data);
          if (workRes.data) setTeacherWorkload(workRes.data);
          if (metRes.isOffline || kpiRes.isOffline || workRes.isOffline) setIsOfflineMode(true);
        } else if (role === "admin") {
          const [metRes, kpiRes] = await Promise.all([
            safeFetch<typeof metrics>("/api/v1/dashboard/metrics"),
            safeFetch<KpiOverview>("/api/v1/dashboard/operational-kpi")
          ]);
          if (metRes.data) {
            setMetrics(metRes.data);
            setMetricsLoaded(true);
            try { sessionStorage.setItem("educationos_dashboard_metrics_cache", JSON.stringify(metRes.data)); } catch {}
          }
          if (kpiRes.data) setKpiData(kpiRes.data);
          if (metRes.isOffline || kpiRes.isOffline) setIsOfflineMode(true);
        } else if (role === "student") {
          const stuRes = await safeFetch<StudentDashboardSummary>("/api/v1/students/me/dashboard");
          if (stuRes.data) setStudentDashboard(stuRes.data);
          if (stuRes.isOffline) setIsOfflineMode(true);
        } else if (role === "guardian") {
          const guarRes = await safeFetch<GuardianChildItem[]>("/api/v1/guardians/me/children");
          if (guarRes.data) setGuardianChildren(guarRes.data);
          if (guarRes.isOffline) setIsOfflineMode(true);
        }
      } catch (err) {
        console.error("Dashboard overview fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    void fetchOverviewData();
  }, [router]);


  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Offline Mode Indicator Banner */}
      {isOfflineMode && (
        <div className="bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 rounded-2xl flex items-center justify-between text-xs text-amber-600 dark:text-amber-400 font-medium">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            <span> অফলাইন মোড সক্রিয়: সর্বশেষ ক্যাশ করা ডেটা দেখানো হচ্ছে</span>
          </div>
          <span className="font-mono text-[10px] bg-amber-500/20 px-2 py-0.5 rounded">Cached Session</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. TEACHER VIEW                                                           */}
      {/* ========================================================================= */}
      {userRole === "teacher" && (
        <>
          {/* Educator Personal Greeting Banner */}
          <div className="bg-gradient-to-r from-indigo-600/10 via-purple-600/10 to-transparent border border-indigo-200 dark:border-white/10 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded">
                  Faculty Workspace
                </span>
                {teacherWorkload?.employee_id && (
                  <span className="text-[10px] font-mono text-gray-400">
                    ID: {teacherWorkload.employee_id}
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mt-1">
                {teacherWorkload ? `${teacherWorkload.first_name} ${teacherWorkload.last_name}` : userName}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {teacherWorkload?.designation || "Senior Teacher"} • {teacherWorkload?.department || "General"} Department • Class Teacher of <strong className="text-indigo-600 dark:text-indigo-400">{teacherWorkload?.assigned_class || "General Subjects"}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/teachers"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
              >
                <GraduationCap size={14} /> My Faculty 360° Profile
              </Link>
            </div>
          </div>

          {/* 4 Tailored Teacher Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 p-5 rounded-3xl shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                {teacherWorkload?.assigned_class || "My Class"} Students
              </span>
              <MetricCardValue
                value={teacherWorkload ? teacherWorkload.assigned_class_student_count : metrics.total_students}
                loading={loading && !teacherWorkload && !metricsLoaded}
                className="text-3xl font-black text-gray-900 dark:text-white mt-1"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                {teacherWorkload?.assigned_class ? `Enrolled in ${teacherWorkload.assigned_class}` : "Total Active Students"}
              </p>
            </div>

            <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 p-5 rounded-3xl shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-green-500">Class Attendance Today</span>
              <MetricCardValue
                value={teacherWorkload ? `${teacherWorkload.assigned_class_attendance_summary.rate_pct}%` : `${metrics.present_today}`}
                loading={loading && !teacherWorkload && !metricsLoaded}
                className="text-3xl font-black text-green-600 dark:text-green-400 mt-1"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                {teacherWorkload ? `${teacherWorkload.assigned_class_attendance_summary.present} Present / ${teacherWorkload.assigned_class_attendance_summary.absent} Absent` : "Marked Present in Morning Roll"}
              </p>
            </div>

            <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 p-5 rounded-3xl shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-500">Today&apos;s Teaching Load</span>
              <MetricCardValue
                value={teacherWorkload ? `${teacherWorkload.today_periods_count} Periods` : "0 Periods"}
                loading={loading && !teacherWorkload}
                className="text-3xl font-black text-purple-600 dark:text-purple-400 mt-1"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Scheduled for {teacherWorkload?.day_of_week || "Today"}
              </p>
            </div>

            <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 p-5 rounded-3xl shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Total Weekly Load</span>
              <MetricCardValue
                value={teacherWorkload ? teacherWorkload.total_weekly_periods : 0}
                loading={loading && !teacherWorkload}
                className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-1"
              />
              <p className="text-[11px] text-gray-500 mt-1">Periods Scheduled / Week</p>
            </div>
          </div>

          {/* Today's Timetable Routine Card */}
          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Clock size={16} className="text-indigo-600 dark:text-indigo-400" />
                  Today&apos;s Teaching Schedule ({teacherWorkload?.day_of_week || "Today"})
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Assigned class periods and room allocation for today
                </p>
              </div>
              <Link
                href="/dashboard/academic"
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                Full Routine Matrix <ArrowRight size={12} />
              </Link>
            </div>

            {(!teacherWorkload?.today_schedule || teacherWorkload.today_schedule.length === 0) ? (
              <div className="p-6 text-center text-gray-400 bg-gray-50 dark:bg-white/[0.02] rounded-2xl border border-dashed border-gray-200 dark:border-white/10 text-xs">
                No teaching periods scheduled for today ({teacherWorkload?.day_of_week || "today"}). Use this time for lesson prep or grading!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {teacherWorkload.today_schedule.map((slot) => (
                  <div
                    key={slot.id}
                    className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/20 space-y-1.5"
                  >
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-gray-900 dark:text-white">{slot.subject}</span>
                      <span className="font-mono text-[10px] bg-white dark:bg-white/10 px-2 py-0.5 rounded font-bold">
                        {slot.period_number}
                      </span>
                    </div>
                    <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                      {slot.class_name} ({slot.section}) • {slot.room_number}
                    </div>
                    <div className="text-[11px] text-gray-400 font-mono">
                      {slot.start_time} - {slot.end_time}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Teacher Classroom Command Center */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Teacher Classroom Command Center</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link href="/dashboard/attendance" className="p-5 rounded-2xl bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 hover:border-blue-500/50 transition-all group shadow-sm">
                <Fingerprint className="text-blue-600 mb-3" size={24} />
                <h4 className="font-bold text-sm text-gray-900 dark:text-white">Take Attendance</h4>
                <p className="text-xs text-gray-500 mt-1">1-Click digital roll call & absence alert</p>
              </Link>

              <Link href="/dashboard/results" className="p-5 rounded-2xl bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 hover:border-amber-500/50 transition-all group shadow-sm">
                <Trophy className="text-amber-500 mb-3" size={24} />
                <h4 className="font-bold text-sm text-gray-900 dark:text-white">Results & Grading</h4>
                <p className="text-xs text-gray-500 mt-1">Record term marks & compute NCTB GPA</p>
              </Link>

              <Link href="/dashboard/exams" className="p-5 rounded-2xl bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 hover:border-purple-500/50 transition-all group shadow-sm">
                <BookOpen className="text-purple-600 mb-3" size={24} />
                <h4 className="font-bold text-sm text-gray-900 dark:text-white">Question Paper AI</h4>
                <p className="text-xs text-gray-500 mt-1">Draft & print exam papers in 2 minutes</p>
              </Link>

              <Link href="/dashboard/academic" className="p-5 rounded-2xl bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 hover:border-green-500/50 transition-all group shadow-sm">
                <Clock className="text-green-600 mb-3" size={24} />
                <h4 className="font-bold text-sm text-gray-900 dark:text-white">Class Timetable</h4>
                <p className="text-xs text-gray-500 mt-1">Today&apos;s assigned periods and room schedule</p>
              </Link>
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* 2. STUDENT VIEW                                                           */}
      {/* ========================================================================= */}
      {userRole === "student" && (
        <>
          <div className="bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-transparent border border-blue-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-purple-400">
                  Student Digital Twin Workspace
                </span>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mt-1">
                  Welcome to Study Room, {studentDashboard?.student?.name || userName}!
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Enrolled in {studentDashboard?.student?.class_name || "Class"} • Roll {studentDashboard?.student?.roll_number || "—"} • Section {studentDashboard?.student?.section || "A"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                  Session 2026
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200/50 dark:border-white/5">
              <div>
                <span className="text-gray-400 text-[10px] block uppercase font-bold">Attendance Rate</span>
                <div className="text-xl font-bold text-green-600 dark:text-green-400 mt-0.5">
                  {studentDashboard?.attendance?.rate_percentage != null ? `${studentDashboard.attendance.rate_percentage}%` : "No Record"}
                </div>
                <span className="text-[10px] text-gray-500">
                  Today: {studentDashboard?.attendance?.today_status || "Not Marked"}
                </span>
              </div>
              <div>
                <span className="text-gray-400 text-[10px] block uppercase font-bold">Term Standing</span>
                <div className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                  {studentDashboard?.academics?.standing || "Pending Evaluation"}
                </div>
                <span className="text-[10px] text-gray-500">Official Exam Marks</span>
              </div>
              <div>
                <span className="text-gray-400 text-[10px] block uppercase font-bold">Today&apos;s Periods</span>
                <div className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                  {studentDashboard?.routine_today?.periods_count != null ? `${studentDashboard.routine_today.periods_count} Classes` : "No Periods Scheduled"}
                </div>
                <span className="text-[10px] text-gray-500">
                  {studentDashboard?.routine_today?.day || "Weekly Schedule"}
                </span>
              </div>
              <div>
                <span className="text-gray-400 text-[10px] block uppercase font-bold">AI Companion</span>
                <div className="text-xl font-bold text-amber-500 mt-0.5">Active 24/7</div>
                <span className="text-[10px] text-gray-500">Press ⌘K to ask</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/dashboard/learning" className="p-6 rounded-3xl bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 hover:border-indigo-500/50 transition-all shadow-sm group">
              <FileText className="text-indigo-600 mb-3 group-hover:scale-110 transition-transform" size={24} />
              <h4 className="font-bold text-sm text-gray-900 dark:text-white">Learning Studio (AI)</h4>
              <p className="text-xs text-gray-500 mt-1">Socratic tutor, study timer, quizzes & flashcards</p>
            </Link>

            <Link href="/dashboard/results" className="p-6 rounded-3xl bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 hover:border-blue-500/50 transition-all shadow-sm group">
              <Trophy className="text-blue-600 mb-3 group-hover:scale-110 transition-transform" size={24} />
              <h4 className="font-bold text-sm text-gray-900 dark:text-white">Academic Marksheet & Ranking</h4>
              <p className="text-xs text-gray-500 mt-1">Download official A4 progress card and competency report</p>
            </Link>

            <Link href="/dashboard/attendance" className="p-6 rounded-3xl bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 hover:border-purple-500/50 transition-all shadow-sm group">
              <Clock className="text-purple-600 mb-3 group-hover:scale-110 transition-transform" size={24} />
              <h4 className="font-bold text-sm text-gray-900 dark:text-white">Attendance & Routine</h4>
              <p className="text-xs text-gray-500 mt-1">Daily presence record and class timetable</p>
            </Link>

            <Link href="/dashboard/notices" className="p-6 rounded-3xl bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 hover:border-green-500/50 transition-all shadow-sm group">
              <FileText className="text-green-600 mb-3 group-hover:scale-110 transition-transform" size={24} />
              <h4 className="font-bold text-sm text-gray-900 dark:text-white">Official Notice Board</h4>
              <p className="text-xs text-gray-500 mt-1">Institutional memos, exam schedules, and holiday bulletins</p>
            </Link>
          </div>
        </>
      )}


      {/* 
      // =========================================================================
      // 1. GUARDIAN DASHBOARD VIEW (Clean, Informative, No Admin Empty Screen)
      // =========================================================================
      */}
      {userRole === "guardian" && (() => {
        const currentChild = guardianChildren[selectedChildIndex] || null;
        return (
          <>
            <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
              <div className="border-b border-gray-200 dark:border-white/10 pb-4">
                <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 text-xs font-bold uppercase tracking-wider">
                  <HeartHandshake size={16} />
                  <span>Guardian Home Portal</span>
                </div>
                <h1 className="text-2xl font-black text-gray-900 dark:text-white mt-1">
                  Welcome, {userName}
                </h1>
                <p className="text-xs text-gray-500">
                  Real-time academic performance, daily attendance status, and institutional updates for your child.
                </p>
              </div>

              {/* Linked Child Selector (If Guardian has multiple children) */}
              {guardianChildren.length > 1 && (
                <div className="flex items-center gap-2 p-1.5 bg-gray-100 dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2">Your Children:</span>
                  {guardianChildren.map((child, idx) => (
                    <button
                      key={child.student_id}
                      onClick={() => setSelectedChildIndex(idx)}
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

              {/* Child Snapshot Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Today&apos;s Attendance</span>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1.5">
                    <CheckCircle2 size={20} />
                    <span>{currentChild?.attendance?.today_status || "Not Marked"}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {currentChild?.attendance?.rate_percentage != null
                      ? `${currentChild.attendance.rate_percentage}% Term Attendance`
                      : "Morning roll call not recorded"}
                  </p>
                </div>

                <div className="p-5 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-500">Academic Standing</span>
                  <div className="text-2xl font-black text-gray-900 dark:text-white mt-1">
                    {currentChild?.academics?.standing || "Pending Evaluation"}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {currentChild ? `${currentChild.student_name} (${currentChild.class_name})` : "No Linked Student"}
                  </p>
                </div>

                <div className="p-5 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Fee Status</span>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {currentChild?.fees?.status || "No Payments Recorded"}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {currentChild?.fees?.total_paid != null ? `৳ ${currentChild.fees.total_paid.toLocaleString()} Paid` : "No payment activity recorded"}
                  </p>
                </div>
              </div>

              {/* Quick Navigation Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                <Link
                  href="/dashboard/results"
                  className="p-6 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl shadow-sm hover:border-blue-500/50 transition-all flex items-center justify-between group"
                >
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">
                      Progress Card
                    </h3>
                    <p className="text-xs text-gray-500">Subject marks, GPA & teacher remarks.</p>
                  </div>
                  <ArrowRight size={18} className="text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                </Link>

                <Link
                  href="/dashboard/attendance"
                  className="p-6 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl shadow-sm hover:border-emerald-500/50 transition-all flex items-center justify-between group"
                >
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                      Attendance Log
                    </h3>
                    <p className="text-xs text-gray-500">Daily roll-call presence & absence history.</p>
                  </div>
                  <ArrowRight size={18} className="text-gray-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
                </Link>

                <Link
                  href="/dashboard/finance"
                  className="p-6 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl shadow-sm hover:border-amber-500/50 transition-all flex items-center justify-between group"
                >
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-amber-600 transition-colors">
                      Fees & Receipts
                    </h3>
                    <p className="text-xs text-gray-500">Invoices, paid balances & payment receipts.</p>
                  </div>
                  <ArrowRight size={18} className="text-gray-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
                </Link>

                <Link
                  href="/dashboard/notices"
                  className="p-6 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl shadow-sm hover:border-purple-500/50 transition-all flex items-center justify-between group"
                >
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-purple-600 transition-colors">
                      School Circulars
                    </h3>
                    <p className="text-xs text-gray-500">Holiday schedules, notices & announcements.</p>
                  </div>
                  <ArrowRight size={18} className="text-gray-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
                </Link>
              </div>
            </div>
          </>
        );
      })()}


      {/* ========================================================================= */}
      {/* 3. ADMIN / PRINCIPAL VIEW                                                 */}
      {/* ========================================================================= */}
      {userRole === "admin" && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 p-5 rounded-3xl shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                {language === "EN" ? "Total Students" : "মোট শিক্ষার্থী"}
              </span>
              <MetricCardValue
                value={metrics.total_students}
                loading={loading && !metricsLoaded}
                className="text-3xl font-black text-gray-900 dark:text-white mt-1"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                {language === "EN" ? "Active Enrollment Base" : "মোট সক্রিয় শিক্ষার্থী"}
              </p>
            </div>

            <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 p-5 rounded-3xl shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-green-500">
                {language === "EN" ? "Present Today" : "আজকের উপস্থিতি"}
              </span>
              <MetricCardValue
                value={metrics.present_today}
                loading={loading && !metricsLoaded}
                className="text-3xl font-black text-green-600 dark:text-green-400 mt-1"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                {language === "EN" ? "Daily Biometric & App Ingestion" : "ডিজিটাল ও বায়োমেট্রিক হাজিরা"}
              </p>
            </div>

            <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 p-5 rounded-3xl shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-500">
                {language === "EN" ? "Absent" : "অনুপস্থিত"}
              </span>
              <MetricCardValue
                value={metrics.absent_today}
                loading={loading && !metricsLoaded}
                className="text-3xl font-black text-red-600 dark:text-red-400 mt-1"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                {language === "EN" ? "Automated WhatsApp Alert Ready" : "হোয়াটসঅ্যাপ সতর্কবার্তা প্রস্তুত"}
              </p>
            </div>

            <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 p-5 rounded-3xl shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                {language === "EN" ? "Active Faculty" : "কর্মরত শিক্ষক"}
              </span>
              <MetricCardValue
                value={metrics.total_teachers}
                loading={loading && !metricsLoaded}
                className="text-3xl font-black text-gray-900 dark:text-white mt-1"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                {language === "EN" ? "Educators On Duty" : "দায়িত্বপ্রাপ্ত শিক্ষকবৃন্দ"}
              </p>
            </div>

            <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 p-5 rounded-3xl shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">
                {language === "EN" ? "Action Center" : "অ্যাকশন সেন্টার"}
              </span>
              <MetricCardValue
                value={metrics.pending_approvals}
                loading={loading && !metricsLoaded}
                className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-1"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                {language === "EN" ? "L2 Approvals Pending" : "অনুমোদন অপেক্ষমান"}
              </p>
            </div>
          </div>

          {/* Weekly Metrics & Month-to-Date Aggregation Card */}
          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 dark:border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 px-2 py-0.5 rounded">
                    {language === "EN" ? "Institutional Cadence" : "প্রাতিষ্ঠানিক হিসাব চক্র"}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-1 flex items-center gap-2">
                  <Calendar size={18} className="text-gray-600 dark:text-gray-400" />
                  {language === "EN" ? "Weekly Metrics & Month-to-Date Aggregation" : "সাপ্তাহিক হিসাব ও চলতি মাসের একত্রীকরণ"}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {language === "EN" ? "Current Week (Sun–Sat):" : "চলতি সপ্তাহ (রবি–শনি):"} {metrics.weekly?.week_start || "Start"} {language === "EN" ? "to" : "থেকে"} {metrics.weekly?.week_end || "End"} • {language === "EN" ? "Month:" : "মাস:"} {metrics.monthly_aggregation?.month_name || "Current Month"}
                </p>
              </div>

              <button
                onClick={fetchMonthEndPreview}
                className="px-4 py-2 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/20 text-xs font-semibold flex items-center gap-1.5 shadow-sm hover:bg-purple-100 transition-colors min-h-[40px]"
              >
                <CalendarCheck size={15} />
                <span>{language === "EN" ? "Month-End Preview" : "মাসান্তিক প্রিভিউ"}</span>
              </button>
            </div>

            {/* 4 Weekly & MTD KPI Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  {language === "EN" ? "Week Collection" : "চলতি সপ্তাহের আদায়"}
                </span>
                <MetricCardSubValue
                  value={`৳${(metrics.weekly?.collection_week_bdt ?? 0).toLocaleString()}`}
                  loading={loading && !metricsLoaded}
                  className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono"
                />
                <p className="text-[11px] text-gray-500">
                  {metrics.weekly?.transactions_week ?? 0} {language === "EN" ? "payments this week" : "টি ফি পেমেন্ট"}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  {language === "EN" ? "New Admissions (Week)" : "নতুন ভর্তি (সপ্তাহ)"}
                </span>
                <MetricCardSubValue
                  value={metrics.weekly?.new_admissions_week ?? 0}
                  loading={loading && !metricsLoaded}
                  className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono"
                />
                <p className="text-[11px] text-gray-500">
                  {language === "EN" ? "Students enrolled since Sunday" : "রবিবার থেকে এ পর্যন্ত নতুন শিক্ষার্থী"}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  {language === "EN" ? "Month-to-Date Revenue" : "চলতি মাসের মোট রাজস্ব"}
                </span>
                <MetricCardSubValue
                  value={`৳${(metrics.monthly_aggregation?.collection_mtd_bdt ?? 0).toLocaleString()}`}
                  loading={loading && !metricsLoaded}
                  className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono"
                />
                <p className="text-[11px] text-gray-500">
                  {metrics.monthly_aggregation?.month_name || "Current Month"} {language === "EN" ? "Total" : "সর্বমোট"}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  {language === "EN" ? "Total Month Admissions" : "চলতি মাসের মোট ভর্তি"}
                </span>
                <MetricCardSubValue
                  value={metrics.monthly_aggregation?.admissions_mtd ?? 0}
                  loading={loading && !metricsLoaded}
                  className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono"
                />
                <p className="text-[11px] text-gray-500">
                  {language === "EN" ? "Intakes for session" : "ভর্তি সম্পন্ন সেশন"} {metrics.server_date_bd?.slice(0, 4) || "2026"}
                </p>
              </div>
            </div>

            {/* 4-Week Month Slices Breakdown */}
            {metrics.monthly_aggregation?.weeks_breakdown && (
              <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-white/5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Month-to-Date Weekly Distribution ({metrics.monthly_aggregation.month_name})
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {metrics.monthly_aggregation.weeks_breakdown.map((wb, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border transition-all ${
                        wb.is_current
                          ? "bg-purple-50/50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/30 shadow-xs"
                          : "bg-gray-50/50 dark:bg-white/[0.02] border-gray-100 dark:border-white/5"
                      }`}
                    >
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-gray-800 dark:text-gray-200">{wb.week_label}</span>
                        {wb.is_current && (
                          <span className="text-[9px] bg-purple-600 text-white font-bold px-1.5 py-0.5 rounded">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                        ৳{wb.collection_bdt.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                        {wb.start_date.slice(5)} to {wb.end_date.slice(5)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {kpiData && (
            <div className="bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-transparent border border-blue-200 dark:border-white/10 rounded-3xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-purple-400">
                      Operational Metric • EducationOS Efficiency Engine
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40">
                      {language === "EN" ? "Model Estimate" : "মডেল প্রাক্কলন"}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mt-1">
                    {kpiData.total_hours_saved} {language === "EN" ? "Hours Saved" : "ঘণ্টা সাশ্রয়"}
                  </h2>
                  <p className="text-xs text-gray-500 mt-1 max-w-xl">
                    {language === "EN" 
                      ? "Estimated staff hours and stationery savings across digital attendance (0.5m), AI question blueprints (45m), grading (4m), notices (15m), and digital fee collection (3m)."
                      : "ডিজিটাল উপস্থিতি (০.৫ মি.), প্রশ্ন ব্লুপ্রিন্ট (৪৫ মি.), খাতা মূল্যায়ন (৪ মি.), নোটিশ (১৫ মি.) ও ফি সংগ্রহে (৩ মি.) সম্ভাব্য কর্মী সময় ও স্টেশনারি সাশ্রয়।"}
                  </p>
                  {kpiData.breakdown && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                        {(kpiData.breakdown.attendance_events ?? 0).toLocaleString()} Roll Calls
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-[10px] font-medium text-purple-600 dark:text-purple-400">
                        {(kpiData.breakdown.question_blueprints ?? 0).toLocaleString()} Question Blueprints
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        {(kpiData.breakdown.nctb_gradings ?? 0).toLocaleString()} Graded Papers
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                        {(kpiData.breakdown.notices_sent ?? 0).toLocaleString()} Digital Notices
                      </span>
                      {(kpiData.breakdown.fee_transactions ?? 0) > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-medium text-cyan-600 dark:text-cyan-400">
                          {(kpiData.breakdown.fee_transactions ?? 0).toLocaleString()} Digital Payments
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-3 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl text-center min-w-[130px]">
                  <span className="text-[10px] text-gray-400 font-bold block uppercase">{language === "EN" ? "Paperless Savings" : "কাগজবিহীন সাশ্রয়"}</span>
                  <span className="text-lg font-mono font-bold text-green-600 dark:text-green-400">
                    ৳{(kpiData.estimated_cost_saved_bdt ?? 0).toLocaleString()}
                  </span>
                  <span className="text-[9px] text-gray-400 block mt-0.5">{language === "EN" ? "Est. @ ৳150/hr" : "প্রাক্কলিত @ ১৫০৳/ঘণ্টা"}</span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Direct Administrative Pipelines</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link href="/dashboard/students" className="p-5 rounded-2xl bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 hover:border-blue-500/50 transition-all shadow-sm">
                <Plus className="text-gray-400 mb-3" size={24} />
                <h4 className="font-bold text-sm text-gray-900 dark:text-white">New Admission</h4>
                <p className="text-xs text-gray-500 mt-1">Onboard student & print official slip</p>
              </Link>

              <Link href="/dashboard/finance" className="p-5 rounded-2xl bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 hover:border-green-500/50 transition-all shadow-sm">
                <Wallet className="text-gray-400 mb-3" size={24} />
                <h4 className="font-bold text-sm text-gray-900 dark:text-white">Fee Ledger</h4>
                <p className="text-xs text-gray-500 mt-1">Collect tuition fee (Cash/bKash/Crypto)</p>
              </Link>

              <Link href="/dashboard/approvals" className="p-5 rounded-2xl bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 hover:border-amber-500/50 transition-all shadow-sm">
                <ShieldCheck className="text-gray-400 mb-3" size={24} />
                <h4 className="font-bold text-sm text-gray-900 dark:text-white">Action Center</h4>
                <p className="text-xs text-gray-500 mt-1">Review AI guardrails & approvals</p>
              </Link>

              <Link href="/dashboard/communication" className="p-5 rounded-2xl bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 hover:border-purple-500/50 transition-all shadow-sm">
                <Users className="text-gray-400 mb-3" size={24} />
                <h4 className="font-bold text-sm text-gray-900 dark:text-white">Guardian Inbox</h4>
                <p className="text-xs text-gray-500 mt-1">WhatsApp & SMS triage queue</p>
              </Link>
            </div>
          </div>
        </>
      )}

      {/* ================= MONTH-END ADMIN PREVIEW MODAL ================= */}
      {isMonthEndPreviewOpen && (
        <ResponsiveDialog
          isOpen={isMonthEndPreviewOpen}
          onClose={() => setIsMonthEndPreviewOpen(false)}
          size="xl"
          title={
            monthEndPreviewData ? (
              <div className="flex items-center gap-2">
                <span>{language === "EN" ? "Admin Month-End Performance Preview" : "মাসান্তিক প্রাতিষ্ঠানিক অডিট ও পারফরম্যান্স প্রিভিউ"}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold">
                  {monthEndPreviewData.month_name}
                </span>
              </div>
            ) : (language === "EN" ? "Month-End Performance Preview" : "মাসান্তিক পারফরম্যান্স প্রিভিউ")
          }
          subtitle={
            monthEndPreviewData ? (
              language === "EN"
                ? `Cycle Closing Review • ${monthEndPreviewData.days_remaining_in_month} Days Remaining Until Transition (${monthEndPreviewData.cycle_transition_date})`
                : `মাসিক হিসাব ক্লোজিং • পরবর্তী সাইকেলে রূপান্তরের আর ${monthEndPreviewData.days_remaining_in_month} দিন বাকি (${monthEndPreviewData.cycle_transition_date})`
            ) : (language === "EN" ? "Generating preview snapshot..." : "প্রিভিউ তৈরি হচ্ছে...")
          }
          icon={<CalendarCheck size={20} />}
        >
          {loadingMonthEndPreview || !monthEndPreviewData ? (
            <div className="p-12 text-center text-gray-500 flex justify-center items-center gap-2">
              <Clock className="animate-spin text-purple-600" size={24} /> {language === "EN" ? "Generating month-end operational snapshot..." : "মাসান্তিক স্ন্যাপশট প্রস্তুত হচ্ছে..."}
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Executive KPI Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/20 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    {language === "EN" ? "Month Fee Collection" : "চলতি মাসের ফি আদায়"}
                  </span>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    ৳{monthEndPreviewData.kpi_summary.total_collected_bdt.toLocaleString()}
                  </div>
                  <p className="text-[11px] text-gray-500">{language === "EN" ? "Completed payments this month" : "চলতি মাসে পরিশোধিত ফি"}</p>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/20 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    {language === "EN" ? "Pending Receivables" : "বকেয়া পাওনা"}
                  </span>
                  <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                    ৳{monthEndPreviewData.kpi_summary.pending_receivables_bdt.toLocaleString()}
                  </div>
                  <p className="text-[11px] text-gray-500">{language === "EN" ? "Carried forward dues" : "পূর্বের বকেয়া সহ অবশিষ্ট"}</p>
                </div>

                <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/20 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    {language === "EN" ? "New Admissions" : "নতুন ভর্তি"}
                  </span>
                  <div className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
                    {monthEndPreviewData.kpi_summary.new_admissions_count}
                  </div>
                  <p className="text-[11px] text-gray-500">{language === "EN" ? "Total Enrolled:" : "মোট শিক্ষার্থী:"} {monthEndPreviewData.kpi_summary.total_active_students}</p>
                </div>

                <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-500/5 border border-purple-100 dark:border-purple-500/20 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                    {language === "EN" ? "Average Attendance" : "গড় উপস্থিতি"}
                  </span>
                  <div className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">
                    {monthEndPreviewData.kpi_summary.average_attendance_rate_pct}%
                  </div>
                  <p className="text-[11px] text-gray-500">{language === "EN" ? "Institution-wide rate" : "প্রতিষ্ঠানব্যাপী গড় হার"}</p>
                </div>
              </div>

              {/* Audit Checklist */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                  <ShieldCheck size={14} className="text-green-600" /> {language === "EN" ? "Operational Readiness & Transition Audit" : "অপারেশনাল প্রস্তুতি ও ট্রানজিশন অডিট"}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {monthEndPreviewData.audit_checklist.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-800 dark:text-gray-200">{item.item}</span>
                      <span className="text-green-600 dark:text-green-400 font-bold flex items-center gap-1 text-[11px]">
                        <Check size={14} /> {language === "EN" ? "Reconciled" : "যাচাইকৃত"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendation Callout */}
              <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 text-xs text-purple-900 dark:text-purple-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Sparkles size={14} /> {language === "EN" ? "Next Cycle Readiness Status:" : "পরবর্তী সাইকেল প্রস্তুতি স্ট্যাটাস:"} {monthEndPreviewData.status === "ready_for_review" ? (language === "EN" ? "Ready for Transition" : "প্রস্তুত") : (language === "EN" ? "Active" : "সক্রিয়")}
                </div>
                <p className="text-purple-700/80 dark:text-purple-300/80 leading-relaxed">
                  {monthEndPreviewData.recommendation}
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-white/10">
                <button
                  onClick={() => setIsMonthEndPreviewOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-semibold text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                >
                  {language === "EN" ? "Dismiss Preview" : "বন্ধ করুন"}
                </button>
                <Link
                  href="/dashboard/finance"
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <FileText size={14} /> {language === "EN" ? "Open Finance Monthly Archive" : "ফিন্যান্স মাসিক আর্কাইভে যান"}
                </Link>
              </div>

            </div>
          )}
        </ResponsiveDialog>
      )}

    </div>
  );
}