"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/providers";
import { safeFetch, fetchWithTenant } from "@/lib/api-client";
import { 
  Users, Plus, Clock, Calendar, BookOpen, 
  CheckCircle2, AlertCircle, Loader2, X, GraduationCap 
} from "lucide-react";

interface BatchItem {
  id: string;
  batch_name: string;
  shift_time: string;
  schedule: string;
  seats_available: number;
  enrolled_count: number;
}

interface ProgramItem {
  id: string;
  name: string;
  target_exam: string;
  course_fee: number;
  duration_months: number;
  total_batches: number;
  batches: BatchItem[];
}

export default function BatchesManagementPage() {
  const { language } = useLanguage();
  const [programs, setPrograms] = useState<ProgramItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState<string>("");

  // Form States
  const [progName, setProgName] = useState("");
  const [targetExam, setTargetExam] = useState("");
  const [courseFee, setCourseFee] = useState("12000");
  const [durationMonths, setDurationMonths] = useState("6");

  const [batchName, setBatchName] = useState("");
  const [shiftTime, setShiftTime] = useState("08:00 AM - 11:30 AM");
  const [schedule, setSchedule] = useState("Sat, Mon, Wed");
  const [capacity, setCapacity] = useState("60");

  const fetchPrograms = async () => {
    setLoading(true);
    try {
      const { data } = await safeFetch<ProgramItem[]>("/api/v1/academy/programs");
      if (data) setPrograms(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
  }, []);

  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetchWithTenant("/api/v1/academy/programs", {
        method: "POST",
        body: JSON.stringify({
          name: progName,
          target_exam: targetExam,
          course_fee: parseFloat(courseFee),
          duration_months: parseInt(durationMonths)
        })
      });
      if (res.ok) {
        setShowProgramModal(false);
        setProgName("");
        setTargetExam("");
        fetchPrograms();
      }
    } catch (err) {
      alert("Failed to create program.");
    }
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetchWithTenant("/api/v1/academy/batches", {
        method: "POST",
        body: JSON.stringify({
          program_id: selectedProgramId,
          batch_name: batchName,
          shift_time: shiftTime,
          days_schedule: schedule,
          max_seat_capacity: parseInt(capacity)
        })
      });
      if (res.ok) {
        setShowBatchModal(false);
        setBatchName("");
        fetchPrograms();
      }
    } catch (err) {
      alert("Failed to create batch.");
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-white/10 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <GraduationCap className="text-blue-600 dark:text-purple-400" size={26} />
            <span>{language === "EN" ? "Programs & Batch Management" : "কোর্স ও ব্যাচ ব্যবস্থাপনা"}</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {language === "EN" 
              ? "Manage coaching programs, shift batches, room seat capacities, and enrollments." 
              : "প্রোগ্রাম, শিফট ব্যাচ ও আসন সংখ্যা পরিচালনা করুন।"}
          </p>
        </div>

        <button
          onClick={() => setShowProgramModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
        >
          <Plus size={16} />
          <span>{language === "EN" ? "Create Program" : "নতুন কোর্স প্রোগ্রাম"}</span>
        </button>
      </div>

      {/* Program & Batches List */}
      {loading ? (
        <div className="p-12 text-center text-gray-400 flex items-center justify-center gap-2">
          <Loader2 className="animate-spin text-blue-600" size={20} />
          <span>লোড হচ্ছে...</span>
        </div>
      ) : programs.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-[#0f0f11] rounded-3xl border border-gray-200 dark:border-white/10 text-gray-400 text-xs">
          কোনো কোর্স প্রোগ্রাম তৈরি করা হয়নি। "Create Program" বাটনে ক্লিক করে প্রথম প্রোগ্রাম যুক্ত করুন।
        </div>
      ) : (
        <div className="space-y-6">
          {programs.map((prog) => (
            <div key={prog.id} className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-100 dark:border-white/5 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">{prog.name}</h3>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                    <span>Target: <strong>{prog.target_exam}</strong></span>
                    <span>•</span>
                    <span>Fee: <strong className="text-emerald-600 dark:text-emerald-400">৳{prog.course_fee.toLocaleString()}</strong></span>
                    <span>•</span>
                    <span>Duration: {prog.duration_months} Months</span>
                  </div>
                </div>

                <button
                  onClick={() => { setSelectedProgramId(prog.id); setShowBatchModal(true); }}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 text-xs font-semibold flex items-center gap-1 text-gray-700 dark:text-gray-400"
                >
                  <Plus size={14} /> Add Shift Batch
                </button>
              </div>

              {/* Batches Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {prog.batches.length === 0 ? (
                  <div className="col-span-full py-6 text-center text-xs text-gray-400">
                    এই প্রোগ্রামে এখনো কোনো ব্যাচ চালু করা হয়নি।
                  </div>
                ) : (
                  prog.batches.map((b) => (
                    <div key={b.id} className="p-4 rounded-2xl bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/5 space-y-2">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-xs text-gray-900 dark:text-white">{b.batch_name}</h4>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                          {b.seats_available} Seats Left
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500 space-y-1">
                        <div className="flex items-center gap-1.5"><Clock size={12} /> {b.shift_time}</div>
                        <div className="flex items-center gap-1.5"><Calendar size={12} /> {b.schedule}</div>
                        <div className="flex items-center gap-1.5"><Users size={12} /> Enrolled: {b.enrolled_count} Students</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal 1: Create Program */}
      {showProgramModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">Create Academic Program</h3>
              <button onClick={() => setShowProgramModal(false)}><X size={16} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleCreateProgram} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-gray-600 dark:text-gray-400">Program Name *</label>
                <input
                  required
                  value={progName}
                  onChange={(e) => setProgName(e.target.value)}
                  placeholder="e.g. Engineering Admission Care 2026"
                  className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-600 dark:text-gray-400">Target Exam / Goal *</label>
                <input
                  required
                  value={targetExam}
                  onChange={(e) => setTargetExam(e.target.value)}
                  placeholder="e.g. BUET, CKET & Public Engg."
                  className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-600 dark:text-gray-400">Course Fee (BDT) *</label>
                  <input
                    type="number"
                    required
                    value={courseFee}
                    onChange={(e) => setCourseFee(e.target.value)}
                    className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-gray-600 dark:text-gray-400">Duration (Months)</label>
                  <input
                    type="number"
                    value={durationMonths}
                    onChange={(e) => setDurationMonths(e.target.value)}
                    className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowProgramModal(false)} className="px-4 py-2 text-gray-500">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-xl">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Create Batch */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">Add Shift Batch</h3>
              <button onClick={() => setShowBatchModal(false)}><X size={16} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleCreateBatch} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-gray-600 dark:text-gray-400">Batch Name *</label>
                <input
                  required
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="e.g. Morning Shift - Batch Alpha"
                  className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-600 dark:text-gray-400">Shift Timing *</label>
                <input
                  required
                  value={shiftTime}
                  onChange={(e) => setShiftTime(e.target.value)}
                  placeholder="e.g. 08:00 AM - 11:30 AM"
                  className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-600 dark:text-gray-400">Schedule Days *</label>
                  <input
                    required
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value)}
                    placeholder="Sat, Mon, Wed"
                    className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-gray-600 dark:text-gray-400">Seat Capacity *</label>
                  <input
                    type="number"
                    required
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    className="w-full mt-1 p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowBatchModal(false)} className="px-4 py-2 text-gray-500">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-xl">Save Batch</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}