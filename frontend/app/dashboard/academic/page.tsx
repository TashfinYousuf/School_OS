"use client";

import { useEffect, useState } from "react";
import { 
  BookOpen, Sparkles, Plus, CheckCircle2, AlertCircle, 
  Loader2, Calendar, Clock, Trash2, Printer, X 
} from "lucide-react";
import { useLanguage } from "@/components/providers";

interface RoutineSlot {
  id: string;
  class_name: string;
  day_of_week: string;
  period_number: string;
  start_time: string;
  end_time: string;
  subject: string;
  teacher_name: string;
  room_number: string;
}

export default function AcademicPage() {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<"routine" | "curriculum">("routine");

  // --- Curriculum / Grades State ---
  const [grades, setGrades] = useState<any[]>([]);
  const [loadingGrades, setLoadingGrades] = useState(true);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [submittingClass, setSubmittingClass] = useState(false);
  const [classForm, setClassForm] = useState({ name: "", description: "" });

  // --- Class Routine State ---
  const [selectedClass, setSelectedClass] = useState("Class 1");
  const [selectedDay, setSelectedDay] = useState("Sunday");
  const [routines, setRoutines] = useState<RoutineSlot[]>([]);
  const [loadingRoutine, setLoadingRoutine] = useState(true);
  const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);
  const [submittingRoutine, setSubmittingRoutine] = useState(false);
  
  const [routineForm, setRoutineForm] = useState({
    period_number: "Period 1",
    start_time: "09:00 AM",
    end_time: "09:45 AM",
    subject: "English",
    teacher_name: "",
    room_number: "Room 101"
  });

  const classes = ["Play", "Nursery", "KG", "Class 1", "Class 2", "Class 3", "Class 4", "Class 5"];
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

  // 1. Fetch Curriculum Grades
  const fetchGrades = async () => {
    setLoadingGrades(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/academic/grades", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setGrades(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingGrades(false);
    }
  };

  // 2. Fetch Routine Timetable
  const fetchRoutine = async () => {
    setLoadingRoutine(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://127.0.0.1:8000/api/v1/academic/class/${encodeURIComponent(selectedClass)}?day_of_week=${selectedDay}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setRoutines(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRoutine(false);
    }
  };

  useEffect(() => {
    fetchGrades();
  }, []);

  useEffect(() => {
    fetchRoutine();
  }, [selectedClass, selectedDay]);

  // Handle Class Creation
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingClass(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/academic/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(classForm),
      });
      if (res.ok) {
        setIsClassModalOpen(false);
        setClassForm({ name: "", description: "" });
        fetchGrades();
      }
    } finally {
      setSubmittingClass(false);
    }
  };

  // Handle Routine Slot Creation
  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingRoutine(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/academic/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          class_name: selectedClass,
          day_of_week: selectedDay,
          ...routineForm
        })
      });
      if (res.ok) {
        setIsRoutineModalOpen(false);
        setRoutineForm({
          period_number: "Period 1",
          start_time: "09:00 AM",
          end_time: "09:45 AM",
          subject: "English",
          teacher_name: "",
          room_number: "Room 101"
        });
        fetchRoutine();
      }
    } finally {
      setSubmittingRoutine(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm("Are you sure you want to remove this period slot?")) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://127.0.0.1:8000/api/v1/academic/${slotId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchRoutine();
    } catch (err) {
      alert("Failed to delete slot");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Screen Controls (Hidden on Print) */}
      <div className="print:hidden space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-white/10 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
              <BookOpen className="text-blue-600 dark:text-purple-400" />
              <span>{language === "EN" ? "Academic Management & Schedules" : "একাডেমিক ব্যবস্থাপনা ও সময়সূচি"}</span>
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              {language === "EN" ? "Manage daily period routines, classes, and NCTB curriculum competencies." : "দৈনিক ক্লাস রুটিন, সময়সূচি ও এনসিটিবি কারিকুলাম পরিচালনা করুন।"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === "routine" ? (
              <>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-1.5 text-gray-700 dark:text-gray-300 transition-colors"
                >
                  <Printer size={14} /> Print Timetable
                </button>
                <button
                  onClick={() => setIsRoutineModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Plus size={15} /> Add Period Slot
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsClassModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
              >
                <Plus size={16} /> {language === "EN" ? "Create Class" : "ক্লাস তৈরি করুন"}
              </button>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 border-b border-gray-100 dark:border-white/10 pb-3">
          <button
            onClick={() => setActiveTab("routine")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "routine"
                ? "bg-blue-600 text-white shadow-sm dark:bg-white/10 dark:text-white"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
            }`}
          >
            <Clock size={14} />
            <span>{language === "EN" ? "Class Routine & Timetable" : "ক্লাস রুটিন ও সময়সূচি"}</span>
          </button>

          <button
            onClick={() => setActiveTab("curriculum")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "curriculum"
                ? "bg-blue-600 text-white shadow-sm dark:bg-white/10 dark:text-white"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
            }`}
          >
            <Sparkles size={14} />
            <span>{language === "EN" ? "Curriculum & Competencies" : "পাঠ্যক্রম ও শ্রেণি বিন্যাস"}</span>
          </button>

          <button
            onClick={() => setActiveTab("lessons" as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === ("lessons" as any)
                ? "bg-blue-600 text-white shadow-sm dark:bg-white/10 dark:text-white"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
            }`}
          >
            <BookOpen size={14} />
            <span>{language === "EN" ? "Daily Teaching Hub & Handouts" : "দৈনিক পাঠদান ও লেকচার শিট"}</span>
          </button>
        </div>

        {/* ================= TAB 1: ROUTINE TIMETABLE ================= */}
        {activeTab === "routine" && (
          <div className="space-y-6">
            
            {/* Filter Bar */}
            <div className="flex flex-wrap gap-4 items-center bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 p-4 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500">Select Class:</span>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs text-gray-900 dark:text-white outline-none font-semibold"
                >
                  {classes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar">
                {days.map(d => (
                  <button
                    key={d}
                    onClick={() => setSelectedDay(d)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      selectedDay === d
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Routine Slots Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {loadingRoutine ? (
                <div className="col-span-full p-12 text-center text-gray-500 flex justify-center items-center gap-2">
                  <Loader2 className="animate-spin text-blue-600" size={20} /> Loading timetable...
                </div>
              ) : routines.length === 0 ? (
                <div className="col-span-full p-12 text-center text-gray-400 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl text-xs">
                  No periods scheduled for {selectedClass} on {selectedDay}.
                </div>
              ) : (
                routines.map((r) => (
                  <div key={r.id} className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl p-5 shadow-sm space-y-3 relative group">
                    <div className="flex justify-between items-start">
                      <span className="text-[11px] font-bold text-blue-600 dark:text-purple-400 bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1 rounded-md">
                        {r.period_number}
                      </span>
                      <button
                        onClick={() => handleDeleteSlot(r.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors p-1"
                        title="Delete slot"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">{r.subject}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Instructor: <strong>{r.teacher_name}</strong></p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-white/5 text-[11px] text-gray-400">
                      <span className="flex items-center gap-1 font-mono"><Clock size={12} /> {r.start_time} - {r.end_time}</span>
                      <span className="font-medium text-gray-600 dark:text-gray-300">{r.room_number}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 2: CURRICULUM & GRADES ================= */}
        {activeTab === "curriculum" && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3 space-y-6">
              {loadingGrades ? (
                <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-10 text-center flex justify-center items-center gap-2 text-gray-500 border border-gray-200 dark:border-white/10">
                  <Loader2 className="animate-spin text-blue-500" size={20} /> {language === "EN" ? "Loading Curriculum..." : "লোড হচ্ছে..."}
                </div>
              ) : grades.length === 0 ? (
                <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-10 text-center text-gray-500 border border-gray-200 dark:border-white/10 text-xs">
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

            {/* AI Curriculum Intelligence Panel */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-6 relative overflow-hidden group border border-blue-100 dark:border-blue-500/20 shadow-sm">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-4">
                  <Sparkles size={18} className="animate-pulse" />
                  <h2 className="font-semibold text-xs tracking-wide uppercase">
                    {language === "EN" ? "AI Curriculum Map" : "এআই পাঠ্যক্রম ম্যাপ"}
                  </h2>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="p-4 bg-blue-50/50 dark:bg-white/[0.03] border border-blue-100 dark:border-white/10 rounded-xl leading-relaxed text-gray-700 dark:text-gray-300">
                    <p>
                      {language === "EN" ? "NCTB alignment is at" : "এনসিটিবি কারিকুলামের সাথে মিল"} <strong className="text-gray-900 dark:text-white">100%</strong>. {language === "EN" ? "STEM enrichment subjects can be added to Class 5 for logic building." : "লজিক বৃদ্ধির জন্য ক্লাস ৫ এ স্টেম বিষয় যুক্ত করা যেতে পারে।"}
                    </p>
                  </div>

                  <div className="p-4 bg-orange-50/50 dark:bg-orange-500/5 border border-orange-100 dark:border-orange-500/10 rounded-xl leading-relaxed text-gray-700 dark:text-gray-300">
                    <p>
                      {language === "EN" ? "Lacking subjects mapped to" : "মিডল স্কুল লেভেলে"} <strong className="text-gray-900 dark:text-white">"Digital Literacy"</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: Teaching Hub ================= */}
        {activeTab === ("lessons" as any) && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 p-6 rounded-3xl shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <Sparkles size={16} className="text-purple-500" /> AI Lecture Sheet & Homework Generator
              </h3>
              <p className="text-xs text-gray-500 mb-4">Generate 1-page study handouts, class activities, and assignments for students.</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  placeholder="Topic/Chapter Title (e.g. Chapter 4: Fractions)"
                  id="topic_input"
                  className="sm:col-span-2 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs outline-none"
                />
                <button
                  onClick={async () => {
                    const topic = (document.getElementById("topic_input") as HTMLInputElement)?.value;
                    if (!topic) return alert("Please specify a lesson topic.");
                    const token = localStorage.getItem("token");
                    const res = await fetch("http://127.0.0.1:8000/api/v1/academic/lessons/generate-materials", {
                      method: "POST",
                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ class_name: selectedClass, subject: "General Science", topic_title: topic })
                    });
                    if (res.ok) {
                      const data = await res.json();
                      alert("Handout Generated! Content:\n\n" + data.handout_content.substring(0, 300) + "...\n(Ready for print)");
                    }
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm"
                >
                  <Sparkles size={14} /> Generate Handout
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ================= OFFICIAL PRINT-ONLY SHEET (A4 TIMETABLE) ================= */}
      <div className="hidden print:block font-serif text-black p-6 bg-white max-w-[210mm] mx-auto text-xs leading-normal">
        <div className="text-center border-b-2 border-black pb-3 mb-4">
          <h2 className="text-xl font-black uppercase tracking-wider">Kids Shine International School</h2>
          <p className="text-[10px] italic">Official Class Timetable • Academic Session 2026</p>
          <div className="mt-2 font-sans text-xs font-bold uppercase">
            {selectedClass} — {selectedDay} Schedule
          </div>
        </div>

        <table className="w-full text-left border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-gray-100 font-sans text-[11px]">
              <th className="border border-black p-2">Period</th>
              <th className="border border-black p-2">Timing</th>
              <th className="border border-black p-2">Subject</th>
              <th className="border border-black p-2">Teacher</th>
              <th className="border border-black p-2">Room</th>
            </tr>
          </thead>
          <tbody>
            {routines.map((r) => (
              <tr key={r.id}>
                <td className="border border-black p-2 font-bold">{r.period_number}</td>
                <td className="border border-black p-2 font-mono">{r.start_time} - {r.end_time}</td>
                <td className="border border-black p-2 font-bold">{r.subject}</td>
                <td className="border border-black p-2">{r.teacher_name}</td>
                <td className="border border-black p-2">{r.room_number}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-between pt-16 text-[10px] font-sans">
          <div className="text-center">
            <div className="w-32 border-t border-black mb-1"></div>
            <span>Academic Coordinator</span>
          </div>
          <div className="text-center">
            <div className="w-32 border-t border-black mb-1"></div>
            <span>Head of Institution</span>
          </div>
        </div>
      </div>

      {/* Routine Slot Creation Modal */}
      {isRoutineModalOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-white/10">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Assign Class Period</h3>
              <button onClick={() => setIsRoutineModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <form onSubmit={handleAddSlot} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-700 dark:text-gray-300">Period Slot *</label>
                  <input
                    required
                    value={routineForm.period_number}
                    onChange={(e) => setRoutineForm({...routineForm, period_number: e.target.value})}
                    className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none"
                    placeholder="Period 1"
                  />
                </div>
                <div>
                  <label className="font-semibold text-gray-700 dark:text-gray-300">Subject *</label>
                  <input
                    required
                    value={routineForm.subject}
                    onChange={(e) => setRoutineForm({...routineForm, subject: e.target.value})}
                    className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none"
                    placeholder="e.g. Mathematics"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-700 dark:text-gray-300">Start Time *</label>
                  <input
                    required
                    value={routineForm.start_time}
                    onChange={(e) => setRoutineForm({...routineForm, start_time: e.target.value})}
                    className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none font-mono"
                    placeholder="09:00 AM"
                  />
                </div>
                <div>
                  <label className="font-semibold text-gray-700 dark:text-gray-300">End Time *</label>
                  <input
                    required
                    value={routineForm.end_time}
                    onChange={(e) => setRoutineForm({...routineForm, end_time: e.target.value})}
                    className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none font-mono"
                    placeholder="09:45 AM"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-300">Educator / Teacher *</label>
                <input
                  required
                  value={routineForm.teacher_name}
                  onChange={(e) => setRoutineForm({...routineForm, teacher_name: e.target.value})}
                  className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none"
                  placeholder="e.g. Mahfuz Alam"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-300">Room</label>
                <input
                  value={routineForm.room_number}
                  onChange={(e) => setRoutineForm({...routineForm, room_number: e.target.value})}
                  className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none"
                  placeholder="Room 101"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-white/10">
                <button type="button" onClick={() => setIsRoutineModalOpen(false)} className="px-4 py-2 font-semibold text-gray-500">Cancel</button>
                <button
                  type="submit"
                  disabled={submittingRoutine}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  {submittingRoutine ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Save Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Class Creation Modal */}
      {isClassModalOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-white/10">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                {language === "EN" ? "Add New Class" : "নতুন ক্লাস যোগ করুন"}
              </h3>
              <button onClick={() => setIsClassModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateClass} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-300">Class Name *</label>
                <input
                  required
                  value={classForm.name}
                  onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                  className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none"
                  placeholder="e.g. Class 6"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-300">Curriculum Description</label>
                <input
                  value={classForm.description}
                  onChange={(e) => setClassForm({ ...classForm, description: e.target.value })}
                  className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none"
                  placeholder="Optional description"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-white/10">
                <button type="button" onClick={() => setIsClassModalOpen(false)} className="px-4 py-2 font-semibold text-gray-500">Cancel</button>
                <button
                  type="submit"
                  disabled={submittingClass}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  {submittingClass ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Save Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}