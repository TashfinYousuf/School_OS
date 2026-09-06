"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/providers";
import { 
  Trophy, Save, Printer, CheckCircle2, 
  AlertCircle, Loader2, Award, ChevronRight 
} from "lucide-react";

interface StudentScoreRow {
  student_id: string;
  name: string;
  roll_number: string;
  admission_number: string;
  marks_obtained: number;
}

export default function ResultsGradingPage() {
  const { language } = useLanguage();
  const [selectedClass, setSelectedClass] = useState("Class 1");
  const [selectedSubject, setSelectedSubject] = useState("Mathematics");
  const [examTerm, setExamTerm] = useState("Half Yearly Examination - 2026");
  
  const [students, setStudents] = useState<StudentScoreRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Selected student for Report Card print preview
  const [reportCardData, setReportCardData] = useState<any | null>(null);

  const classes = ["Play", "Nursery", "KG", "Class 1", "Class 2", "Class 3", "Class 4", "Class 5"];
  const subjects = ["Bangla", "English", "Mathematics", "Science", "Social Studies", "Religion"];

  // Fetch student roster for marks entry
  useEffect(() => {
    const fetchStudentsForGrading = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`http://127.0.0.1:8000/api/v1/students/?class_name=${encodeURIComponent(selectedClass)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setStudents(
            data.map((s: any) => ({
              student_id: s.id,
              name: `${s.first_name} ${s.last_name}`,
              roll_number: s.roll_number || "—",
              admission_number: s.admission_number,
              marks_obtained: 80 // Default baseline mark
            }))
          );
        }
      } finally {
        setLoading(false);
      }
    };
    fetchStudentsForGrading();
  }, [selectedClass]);

  const handleMarkChange = (id: string, val: number) => {
    setStudents(prev => prev.map(s => s.student_id === id ? { ...s, marks_obtained: val } : s));
  };

  const handleSaveMarks = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/results/bulk-submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          exam_term: examTerm,
          class_name: selectedClass,
          subject: selectedSubject,
          entries: students.map(s => ({
            student_id: s.student_id,
            marks_obtained: s.marks_obtained
          }))
        })
      });

      if (res.ok) {
        setFeedback(language === "EN" ? "Marks & NCTB grades saved successfully!" : "নম্বর ও জিপিএ সফলভাবে সংরক্ষিত হয়েছে!");
      }
    } catch (err) {
      setFeedback("Failed to record marks.");
    } finally {
      setSaving(false);
    }
  };

  const handleViewReportCard = async (studentId: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://127.0.0.1:8000/api/v1/results/progress-card/${studentId}?exam_term=${encodeURIComponent(examTerm)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReportCardData(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Screen Controls (Hidden on Print) */}
      <div className="print:hidden space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-white/[0.08] pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <Trophy className="text-amber-500" />
              {language === "EN" ? "Result & Grading Engine" : "পরীক্ষার ফলাফল ও মূল্যায়ন ব্যবস্থাপনা"}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Kids Shine International School • Instant NCTB Grade Calculation & A4 Progress Cards.
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
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full mt-1 bg-transparent font-medium text-sm text-gray-900 dark:text-white outline-none"
            >
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
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
                    <td className="p-4 font-mono font-bold text-gray-700 dark:text-gray-300">{s.roll_number}</td>
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

      {/* Progress Card Modal (On Screen Preview) */}
      {reportCardData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:p-0 print:static print:bg-transparent">
          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl w-full max-w-2xl p-6 sm:p-8 shadow-2xl print:border-none print:shadow-none print:p-0 print:max-w-none">
            
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-gray-100 dark:border-white/10 print:hidden">
              <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Academic Progress Report Card</span>
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
                <h2 className="text-2xl font-black uppercase tracking-wider">Kids Shine International School</h2>
                <p className="text-xs italic">Academic Progress & Competency Report Card</p>
                <h3 className="text-sm font-bold uppercase mt-2">{reportCardData.exam_term}</h3>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs mb-6">
                <div><span className="font-bold">Student Name: </span>{reportCardData.student.name}</div>
                <div><span className="font-bold">Admission ID: </span>{reportCardData.student.admission_number}</div>
                <div><span className="font-bold">Class: </span>{reportCardData.student.class_name}</div>
                <div><span className="font-bold">Roll: </span>{reportCardData.student.roll_number || "—"}</div>
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
                  {reportCardData.results.map((r: any, idx: number) => (
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
                <span>Term GPA: {reportCardData.gpa.toFixed(2)}</span>
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