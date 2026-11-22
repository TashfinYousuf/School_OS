// frontend/app/dashboard/results/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/providers";
import { useWorkspace } from "@/lib/workspaceContext";
import { safeFetch, fetchWithTenant } from "@/lib/api-client";
import { useAcademicClasses } from "@/lib/useAcademicClasses";
import { 
  Trophy, Save, Printer, CheckCircle2, 
  Loader2, ChevronRight, BookOpen, User, Sparkles
} from "lucide-react";

interface StudentScoreRow {
  student_id: string;
  name: string;
  roll_number: string;
  admission_number: string;
  marks_obtained: number;
}

interface ChildReportCard {
  student_name: string;
  admission_number: string;
  class_name: string;
  roll_number: string;
  gpa: number;
  overall_grade: string;
  total_marks: number;
  exam_term: string;
  subjects: {
    subject: string;
    marks_obtained: number;
    grade: string;
    grade_point: number;
    remarks: string;
  }[];
}

export default function ResultsGradingPage() {
  const { language } = useLanguage();
  const { currentWorkspace } = useWorkspace();
  const [userRole, setUserRole] = useState<string>("admin");

  // Admin / Teacher Grading States
  const [selectedClass, setSelectedClass] = useState("Class 1");
  const [selectedSubject, setSelectedSubject] = useState("Mathematics");
  const [examTerm, setExamTerm] = useState("Half Yearly Examination - 2026");
  const [students, setStudents] = useState<StudentScoreRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Modal Report Card State (for teacher view)
  const [reportCardData, setReportCardData] = useState<any | null>(null);

  // Guardian View State
  const [childReport, setChildReport] = useState<ChildReportCard | null>(null);
  const [childrenList, setChildrenList] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  const { classNames: classes } = useAcademicClasses();
  const subjects = ["Bangla", "English", "Mathematics", "Science", "Social Studies", "Religion"];

  useEffect(() => {
    const role = (localStorage.getItem("user_role") || "admin").toLowerCase();
    setUserRole(role);

    if (role === "guardian") {
      fetchGuardianChildrenAndProgress();
    } else if (role === "student") {
      fetchStudentPersonalProgress();
    } else {
      fetchStudentsForGrading();
    }
  }, [selectedClass, examTerm]);

  useEffect(() => {
    if (userRole === "guardian" && selectedChildId) {
      fetchChildProgressCard(selectedChildId);
    }
  }, [selectedChildId, examTerm]);

  // 1. Fetch Roster for Teacher Grading
  const fetchStudentsForGrading = async () => {
    setLoading(true);
    try {
      const res = await fetchWithTenant(`/api/v1/students/?class_name=${encodeURIComponent(selectedClass)}`);
      if (res.ok) {
        const data = await res.json();
        setStudents(
          data.map((s: any) => ({
            student_id: s.id,
            name: `${s.first_name} ${s.last_name}`,
            roll_number: s.roll_number || "—",
            admission_number: s.admission_number,
            marks_obtained: 80
          }))
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Guardian's Verified Children and Progress
  const fetchGuardianChildrenAndProgress = async () => {
    setLoading(true);
    try {
      const res = await fetchWithTenant("/api/v1/guardians/me/children");
      if (res.ok) {
        const list = await res.json();
        setChildrenList(list);
        if (list.length > 0) {
          const targetId = selectedChildId || list[0].student_id;
          setSelectedChildId(targetId);
          await fetchChildProgressCard(targetId);
        } else {
          setChildReport(null);
        }
      } else {
        setChildReport(null);
      }
    } catch {
      setChildReport(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchChildProgressCard = async (studentId: string) => {
    setLoading(true);
    try {
      const res = await fetchWithTenant(`/api/v1/guardians/me/children/${studentId}/progress-card?exam_term=${encodeURIComponent(examTerm)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.subjects && data.subjects.length > 0) {
          setChildReport({
            student_name: data.student_name,
            admission_number: data.admission_number,
            class_name: data.class_name,
            roll_number: data.roll_number,
            gpa: data.gpa || 0,
            overall_grade: data.overall_grade || "N/A",
            total_marks: data.total_marks || 0,
            exam_term: data.exam_term || examTerm,
            subjects: data.subjects
          });
        } else {
          setChildReport(null);
        }
      } else {
        setChildReport(null);
      }
    } catch {
      setChildReport(null);
    } finally {
      setLoading(false);
    }
  };

  // 3. Fetch Student's Personal Progress
  const fetchStudentPersonalProgress = async () => {
    setLoading(true);
    try {
      const dashRes = await fetchWithTenant("/api/v1/students/me/dashboard");
      if (dashRes.ok) {
        const dashData = await dashRes.json();
        const studentId = dashData.student?.id;
        if (studentId) {
          const res = await fetchWithTenant(`/api/v1/results/progress-card/${studentId}?exam_term=${encodeURIComponent(examTerm)}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.results && data.results.length > 0) {
              setChildReport({
                student_name: data.student.name,
                admission_number: data.student.admission_number,
                class_name: data.student.class_name,
                roll_number: data.student.roll_number,
                gpa: data.gpa || 0,
                overall_grade: data.final_grade || "N/A",
                total_marks: data.total_marks || 0,
                exam_term: data.exam_term || examTerm,
                subjects: data.results.map((r: any) => ({
                  subject: r.subject,
                  marks_obtained: r.marks_obtained,
                  grade: r.grade,
                  grade_point: r.grade_point,
                  remarks: r.grade === "A+" ? "Excellent" : r.grade === "F" ? "Needs Improvement" : "Good"
                }))
              });
            } else {
              setChildReport(null);
            }
          }
        }
      }
    } catch {
      setChildReport(null);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkChange = (id: string, val: number) => {
    setStudents((prev) => prev.map((s) => (s.student_id === id ? { ...s, marks_obtained: val } : s)));
  };

  const handleSaveMarks = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetchWithTenant("/api/v1/results/bulk-submit", {
        method: "POST",
        body: JSON.stringify({
          exam_term: examTerm,
          class_name: selectedClass,
          subject: selectedSubject,
          entries: students.map((s) => ({
            student_id: s.student_id,
            marks_obtained: s.marks_obtained
          }))
        })
      });

      if (res.ok) {
        setFeedback(language === "EN" ? "Marks & NCTB grades saved successfully!" : "নম্বর ও জিপিএ সফলভাবে সংরক্ষিত হয়েছে!");
      }
    } catch {
      setFeedback("Failed to record marks.");
    } finally {
      setSaving(false);
    }
  };

  const handleViewReportCard = async (studentId: string) => {
    try {
      const res = await fetchWithTenant(`/api/v1/results/progress-card/${studentId}?exam_term=${encodeURIComponent(examTerm)}`);
      if (res.ok) {
        const data = await res.json();
        setReportCardData(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // =========================================================================
  // 1. GUARDIAN & STUDENT PORTAL VIEW (Direct Authentic Progress Card)
  // =========================================================================
  if (userRole === "guardian" || userRole === "student") {
    const isGuardian = userRole === "guardian";
    return (
      <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-white/10 pb-5 print:hidden">
          <div>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
              isGuardian 
                ? "text-purple-600 bg-purple-50 dark:bg-purple-500/10" 
                : "text-blue-600 bg-blue-50 dark:bg-blue-500/10"
            }`}>
              {isGuardian ? "Parent Portal • Official Progress Record" : "Student Workspace • Official Grade Sheet"}
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-1 flex items-center gap-2">
              <Trophy className="text-amber-500" size={24} />
              <span>
                {isGuardian 
                  ? (language === "EN" ? "Child Academic Progress Card" : "সন্তানের পরীক্ষার ফলাফল ও মূল্যায়ন বিবরণী")
                  : (language === "EN" ? "My Academic Progress Card" : "আমার পরীক্ষার ফলাফল ও মূল্যায়ন বিবরণী")}
              </span>
            </h1>
            <p className="text-xs text-gray-500 mt-1">{currentWorkspace.name} • Official Assessment Card</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              disabled={!childReport}
              className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm disabled:opacity-40"
            >
              <Printer size={14} />
              <span>Print Progress Card</span>
            </button>
          </div>
        </div>

        {/* Guardian Multi-Child Switcher */}
        {isGuardian && childrenList.length > 1 && (
          <div className="flex items-center gap-2 p-1.5 bg-gray-100 dark:bg-white/5 rounded-2xl print:hidden">
            <span className="text-[11px] text-gray-500 font-medium px-2">Select Student:</span>
            {childrenList.map((c) => (
              <button
                key={c.student_id}
                onClick={() => setSelectedChildId(c.student_id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  selectedChildId === c.student_id
                    ? "bg-white dark:bg-black/80 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                {c.name} ({c.class_name})
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-gray-400 flex items-center justify-center gap-2">
            <Loader2 className="animate-spin text-purple-600" size={20} />
            <span>ফলাফল প্রস্তুত হচ্ছে...</span>
          </div>
        ) : childReport ? (
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="p-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-3xl shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-1">
                <div className="text-xs text-blue-100 font-mono">Admission ID: {childReport.admission_number}</div>
                <h2 className="text-xl font-black">{childReport.student_name}</h2>
                <div className="text-xs text-blue-100">
                  Class: <strong>{childReport.class_name}</strong> • Roll: <strong>{childReport.roll_number}</strong> • Term: {childReport.exam_term}
                </div>
              </div>

              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/20">
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-blue-200">Term GPA</div>
                  <div className="text-2xl font-black">{childReport.gpa.toFixed(2)}</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-white text-blue-600 font-black flex items-center justify-center text-base shadow-sm">
                  {childReport.overall_grade}
                </div>
              </div>
            </div>

            {/* Subject Marks Table */}
            <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-gray-100 dark:border-white/5 font-bold text-xs text-gray-900 dark:text-white flex items-center gap-2">
                <BookOpen size={16} className="text-blue-600" />
                <span>বিষয়ভিত্তিক ফলাফল ও মূল্যায়ন বিবরণী</span>
              </div>

              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/10 text-gray-400 uppercase font-mono text-[10px]">
                  <tr>
                    <th className="p-3.5">Subject</th>
                    <th className="p-3.5 text-center">Marks Obtained</th>
                    <th className="p-3.5 text-center">Grade</th>
                    <th className="p-3.5 text-center">Grade Point</th>
                    <th className="p-3.5 text-right">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {childReport.subjects.map((sub, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                      <td className="p-3.5 font-semibold text-gray-900 dark:text-white">{sub.subject}</td>
                      <td className="p-3.5 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">{sub.marks_obtained}</td>
                      <td className="p-3.5 text-center">
                        <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                          {sub.grade}
                        </span>
                      </td>
                      <td className="p-3.5 text-center font-mono font-bold text-gray-700 dark:text-gray-400">{sub.grade_point.toFixed(1)}</td>
                      <td className="p-3.5 text-right text-gray-500 text-[11px] font-medium">{sub.remarks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center bg-white dark:bg-[#0f0f11] rounded-3xl border border-gray-200 dark:border-white/10 text-xs text-gray-500 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
              <Trophy size={24} />
            </div>
            <div className="font-bold text-gray-900 dark:text-white text-sm">
              {language === "EN" ? "No Official Progress Card Published Yet" : "বর্তমানে কোনো প্রকাশিত ফলাফল পাওয়া যায়নি"}
            </div>
            <p className="max-w-md mx-auto text-gray-500 text-xs leading-relaxed">
              {language === "EN"
                ? `Term examination results for ${examTerm} have not yet been approved and officially published by school administration. Once published, your official NCTB report card will appear here.`
                : `${examTerm} এর পরীক্ষার ফলাফল স্কুল প্রশাসন কর্তৃক এখনও অনুমোদিত ও প্রকাশিত হয়নি। ফলাফল প্রকাশিত হওয়া মাত্রই এখানে আপনার অফিসিয়াল এনসিটিবি প্রগ্রেস কার্ড প্রদর্শিত হবে।`}
            </p>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // 2. TEACHER / ADMIN GRADING WORKSPACE VIEW
  // =========================================================================
  return (
    <div className="space-y-6">
      
      {/* Screen Controls */}
      <div className="print:hidden space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-white/[0.08] pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <Trophy className="text-amber-500" />
              {language === "EN" ? "Result & Grading Engine" : "পরীক্ষার ফলাফল ও মূল্যায়ন ব্যবস্থাপনা"}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {currentWorkspace.name} • Instant NCTB Grade Calculation & A4 Progress Cards.
            </p>
          </div>

          <button
            onClick={handleSaveMarks}
            disabled={saving || students.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {language === "EN" ? "Save & Compute Grades" : "গ্রেড সংরক্ষণ ও গণনা"}
          </button>
        </div>

        {feedback && (
          <div className="p-4 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-xl text-green-700 dark:text-green-400 text-sm font-medium flex items-center gap-2">
            <CheckCircle2 size={16} /> {feedback}
          </div>
        )}

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/[0.08] p-4 rounded-2xl">
          <div>
            <label className="text-xs font-semibold text-gray-500">Exam Term</label>
            <input
              value={examTerm}
              onChange={(e) => setExamTerm(e.target.value)}
              className="w-full mt-1 bg-transparent font-medium text-sm text-gray-900 dark:text-white outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">Class</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full mt-1 bg-transparent font-medium text-sm text-gray-900 dark:text-white outline-none"
            >
              {classes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full mt-1 bg-transparent font-medium text-sm text-gray-900 dark:text-white outline-none"
            >
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Marks Entry Grid */}
        <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-gray-500 flex justify-center items-center gap-2">
              <Loader2 className="animate-spin text-blue-600" size={20} /> Loading class roll...
            </div>
          ) : students.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
              No students enrolled in {selectedClass}.
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/[0.05] text-xs font-bold uppercase text-gray-500">
                <tr>
                  <th className="p-4">Roll</th>
                  <th className="p-4">Student</th>
                  <th className="p-4">Admission ID</th>
                  <th className="p-4 w-48">Marks (Out of 100)</th>
                  <th className="p-4 text-right">Academic Card</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {students.map((s) => (
                  <tr key={s.student_id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="p-4 font-mono font-bold text-gray-700 dark:text-gray-400">{s.roll_number}</td>
                    <td className="p-4 font-semibold text-gray-900 dark:text-white">{s.name}</td>
                    <td className="p-4 font-mono text-xs text-gray-500">{s.admission_number}</td>
                    <td className="p-4">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={s.marks_obtained}
                        onChange={(e) => handleMarkChange(s.student_id, parseFloat(e.target.value) || 0)}
                        className="w-24 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-1.5 font-mono font-bold text-gray-900 dark:text-white outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleViewReportCard(s.student_id)}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold inline-flex items-center gap-1"
                      >
                        Progress Card <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {/* Progress Card Modal */}
      {reportCardData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:p-0 print:static print:bg-transparent">
          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl w-full max-w-2xl p-6 sm:p-8 shadow-2xl print:border-none print:shadow-none print:p-0 print:max-w-none">
            
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-gray-100 dark:border-white/10 print:hidden">
              <span className="text-sm font-bold text-gray-700 dark:text-gray-400">Academic Progress Report Card</span>
              <div className="flex items-center gap-2">
                <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm">
                  <Printer size={14} /> Print A4 Card
                </button>
                <button onClick={() => setReportCardData(null)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
            </div>

            {/* Printable Official Progress Card Sheet */}
            <div className="font-serif text-black p-6 bg-white border border-gray-300 rounded-xl print:border-none print:p-0">
              <div className="text-center border-b-2 border-black pb-3 mb-4">
                <h2 className="text-2xl font-black uppercase tracking-wider">{currentWorkspace.name}</h2>
                <p className="text-xs italic">Academic Progress & Competency Report Card</p>
                <h3 className="text-sm font-bold uppercase mt-2">{reportCardData.exam_term}</h3>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs mb-6">
                <div><span className="font-bold">Student Name: </span>{reportCardData.student?.name}</div>
                <div><span className="font-bold">Admission ID: </span>{reportCardData.student?.admission_number}</div>
                <div><span className="font-bold">Class: </span>{reportCardData.student?.class_name}</div>
                <div><span className="font-bold">Roll: </span>{reportCardData.student?.roll_number || "—"}</div>
              </div>

              <table className="w-full text-left text-xs border border-collapse border-black mb-6">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-black p-2">Subject</th>
                    <th className="border border-black p-2 text-center">Marks</th>
                    <th className="border border-black p-2 text-center">Letter Grade</th>
                    <th className="border border-black p-2 text-center">Grade Point</th>
                  </tr>
                </thead>
                <tbody>
                  {reportCardData.results?.map((r: any, idx: number) => (
                    <tr key={idx}>
                      <td className="border border-black p-2 font-semibold">{r.subject}</td>
                      <td className="border border-black p-2 text-center">{r.marks_obtained}</td>
                      <td className="border border-black p-2 text-center font-bold">{r.grade}</td>
                      <td className="border border-black p-2 text-center">{r.grade_point.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between items-center bg-gray-50 border border-black p-3 mb-8 text-xs font-bold">
                <span>Total Marks: {reportCardData.total_marks}</span>
                <span>Term GPA: {reportCardData.gpa?.toFixed(2)}</span>
                <span>Overall Status: {reportCardData.gpa >= 1.0 ? "PASSED" : "NEEDS IMPROVEMENT"}</span>
              </div>

              <div className="flex justify-between pt-10 border-t border-dashed border-gray-400 text-[11px]">
                <div className="text-center">
                  <div className="w-28 border-t border-black mb-1"></div>
                  <span>Class Teacher</span>
                </div>
                <div className="text-center">
                  <div className="w-28 border-t border-black mb-1"></div>
                  <span>Guardian</span>
                </div>
                <div className="text-center">
                  <div className="w-28 border-t border-black mb-1"></div>
                  <span>Principal</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}