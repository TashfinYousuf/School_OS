"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/providers";
import { 
  GraduationCap, UserPlus, Phone, BookOpen, 
  Trash2, Edit, Loader2, CheckCircle2, X, Search,
  Calendar, Clock, Award, Briefcase, Mail, MapPin,
  AlertCircle, Printer, ChevronRight, FileText, Sparkles,
  Building2, Save
} from "lucide-react";
import { useInstitution } from "@/lib/institution";
import { fetchWithTenant } from "@/lib/api-client";
import { useAcademicClasses } from "@/lib/useAcademicClasses";
import ResponsiveDialog from "@/components/ui/ResponsiveDialog";

interface QualificationItem {
  degree: string;
  major?: string;
  institution: string;
  year?: string;
  result?: string;
}

interface ExperienceItem {
  role: string;
  institution: string;
  duration?: string;
  responsibilities?: string;
}

interface TeacherItem {
  id: string;
  first_name: string;
  last_name: string;
  name_bn?: string | null;
  employee_id?: string | null;
  designation: string;
  department?: string | null;
  employment_type?: string | null;
  joining_date?: string | null;
  assigned_class: string | null;
  subjects_taught: string | null;
  phone_number: string | null;
  email: string | null;
  address?: string | null;
  emergency_contact?: string | null;
  qualifications?: QualificationItem[] | null;
  experience?: ExperienceItem[] | null;
  cv_url?: string | null;
  bio?: string | null;
  attendance_today?: string | null;
  status: string;
}

interface RoutineSlot {
  id: string;
  class_name: string;
  section: string;
  shift: string;
  period_number: string;
  start_time: string;
  end_time: string;
  subject: string;
  room_number: string;
}

interface Teacher360Data {
  teacher: TeacherItem;
  workload: {
    total_weekly_periods: number;
    unique_subjects: string[];
    assigned_class_student_count: number;
    weekly_routine: Record<string, RoutineSlot[]>;
  };
}

export default function TeachersCommandCenter() {
  const { language } = useLanguage();
  const { name } = useInstitution();
  const { classNames: classes } = useAcademicClasses();

  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");

  // Onboard Modal State
  const [isOnboardOpen, setIsOnboardOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Teacher 360 Workspace State
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [profile360, setProfile360] = useState<Teacher360Data | null>(null);
  const [loading360, setLoading360] = useState(false);
  const [activeTab, setActiveTab] = useState<"workload" | "qualifications" | "actions" | "demographics">("workload");
  const [isEditing, setIsEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<TeacherItem>>({});

  // Onboarding Form State
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    name_bn: "",
    employee_id: "",
    designation: "Senior Teacher",
    department: "Science",
    employment_type: "Permanent",
    joining_date: new Date().toISOString().split("T")[0],
    assigned_class: "Class 1",
    subjects_taught: "General Science, Mathematics",
    phone_number: "",
    email: "",
    password: "",
    address: "",
    emergency_contact: "",
    bio: "",
    qualifications: [
      { degree: "B.Sc (Hons)", major: "Physics", institution: "University of Dhaka", year: "2018", result: "First Class" }
    ] as QualificationItem[],
  });

  const fetchTeachers = async () => {
    setLoading(true);
    try {
      const res = await fetchWithTenant("/api/v1/teachers/");
      if (res.ok) setTeachers(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  // Fetch Teacher 360 profile
  const fetchTeacher360 = async (teacherId: string) => {
    setLoading360(true);
    setSelectedTeacherId(teacherId);
    setIsEditing(false);
    try {
      const res = await fetchWithTenant(`/api/v1/teachers/${teacherId}/profile-360`);
      if (res.ok) {
        const data = await res.json();
        setProfile360(data);
        setEditFormData(data.teacher);
      }
    } finally {
      setLoading360(false);
    }
  };

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const autoId = formData.employee_id.trim() || `EMP-${Date.now().toString().slice(-4)}`;
      const payload = {
        ...formData,
        employee_id: autoId,
      };

      const res = await fetchWithTenant("/api/v1/teachers/", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorDetail = await res.json().catch(() => null);
        throw new Error(errorDetail?.detail || `Error: ${res.statusText}`);
      }

      setIsOnboardOpen(false);
      setFormData({
        first_name: "",
        last_name: "",
        name_bn: "",
        employee_id: "",
        designation: "Assistant Teacher",
        department: "Science",
        employment_type: "Permanent",
        joining_date: new Date().toISOString().split("T")[0],
        assigned_class: "Class 1",
        subjects_taught: "English, Bangla",
        phone_number: "",
        email: "",
        password: "",
        address: "",
        emergency_contact: "",
        bio: "",
        qualifications: [
          { degree: "B.Sc (Hons)", major: "Physics", institution: "University of Dhaka", year: "2018", result: "First Class" }
        ],
      });
      fetchTeachers();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create teacher account.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacherId) return;
    setSavingEdit(true);
    try {
      const res = await fetchWithTenant(`/api/v1/teachers/${selectedTeacherId}`, {
        method: "PATCH",
        body: JSON.stringify(editFormData),
      });
      if (res.ok) {
        setIsEditing(false);
        fetchTeacher360(selectedTeacherId);
        fetchTeachers();
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: string, teacherName: string) => {
    if (!confirm(`Are you sure you want to remove ${teacherName}?`)) return;
    try {
      const res = await fetchWithTenant(`/api/v1/teachers/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        if (selectedTeacherId === id) {
          setSelectedTeacherId(null);
          setProfile360(null);
        }
        fetchTeachers();
      }
    } catch {
      alert("Failed to delete record.");
    }
  };

  // Filter teachers by search and department
  const filteredTeachers = teachers.filter((t) => {
    const q = search.toLowerCase();
    const matchesSearch = 
      t.first_name.toLowerCase().includes(q) ||
      t.last_name.toLowerCase().includes(q) ||
      (t.name_bn && t.name_bn.includes(q)) ||
      (t.employee_id && t.employee_id.toLowerCase().includes(q)) ||
      (t.assigned_class && t.assigned_class.toLowerCase().includes(q)) ||
      (t.subjects_taught && t.subjects_taught.toLowerCase().includes(q));

    const matchesDept = 
      departmentFilter === "ALL" || 
      (t.department && t.department.toLowerCase() === departmentFilter.toLowerCase());

    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-white/[0.08] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <GraduationCap className="text-indigo-600 dark:text-indigo-400" />
            {language === "EN" ? "Teachers & Workload Center" : "শিক্ষক ও কর্মভার ব্যবস্থাপনা"}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {name} • {language === "EN" ? "Educator dossier, class assignments & workload timetable." : "শিক্ষক তথ্যভাণ্ডার, শ্রেণি দায়িত্ব ও সাপ্তাহিক রুটিন।"}
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMsg(null);
            setIsOnboardOpen(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 shadow-sm min-h-[44px]"
        >
          <UserPlus size={18} />
          {language === "EN" ? "Onboard Educator" : "নতুন শিক্ষক যুক্ত করুন"}
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={language === "EN" ? "Search teacher by name, ID, class, or subject..." : "নাম, আইডি, ক্লাস বা বিষয় দিয়ে শিক্ষক খুঁজুন..."}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-xl text-xs sm:text-sm outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {["ALL", "Science", "Arts", "Commerce", "General"].map((dept) => (
            <button
              key={dept}
              onClick={() => setDepartmentFilter(dept)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                departmentFilter === dept
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white dark:bg-[#0f0f11] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5"
              }`}
            >
              {dept === "ALL" ? (language === "EN" ? "All Depts" : "সকল বিভাগ") : dept}
            </button>
          ))}
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-gray-500 flex justify-center items-center gap-2">
            <Loader2 className="animate-spin text-indigo-600" size={20} /> Loading staff records...
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            {language === "EN" ? "No educators match the search criteria." : "কোনো শিক্ষক পাওয়া যায়নি।"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/[0.05] text-xs font-bold uppercase text-gray-500">
                <tr>
                  <th className="p-4">Faculty Member</th>
                  <th className="p-4">Employee ID</th>
                  <th className="p-4">Designation & Dept</th>
                  <th className="p-4">Class Teacher</th>
                  <th className="p-4">Subjects Taught</th>
                  <th className="p-4">Contact</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {filteredTeachers.map((t) => (
                  <tr 
                    key={t.id} 
                    className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer group"
                    onClick={() => fetchTeacher360(t.id)}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center text-xs shrink-0">
                          {t.first_name[0]}{t.last_name[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {t.first_name} {t.last_name}
                          </div>
                          {t.name_bn && (
                            <div className="text-[11px] text-gray-400 font-serif">{t.name_bn}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-mono text-xs text-gray-600 dark:text-gray-400">
                      {t.employee_id || "—"}
                    </td>
                    <td className="p-4 text-gray-600 dark:text-gray-400 text-xs">
                      <div className="font-medium text-gray-900 dark:text-gray-200">{t.designation || "Educator"}</div>
                      <div className="text-[11px] text-gray-400">{t.department || "General"}</div>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400">
                        {t.assigned_class || "None"}
                      </span>
                    </td>
                    <td className="p-4 text-xs font-medium text-gray-700 dark:text-gray-400 max-w-[180px] truncate">
                      {t.subjects_taught || "—"}
                    </td>
                    <td className="p-4 font-mono text-xs text-gray-500">
                      {t.phone_number ? (
                        <span className="inline-flex items-center gap-1">
                          <Phone size={12} /> {t.phone_number}
                        </span>
                      ) : t.email ? (
                        <span className="inline-flex items-center gap-1 text-[11px]">
                          <Mail size={12} /> {t.email}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => fetchTeacher360(t.id)}
                          className="px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-xs font-medium transition-colors flex items-center gap-1"
                        >
                          <FileText size={12} /> {language === "EN" ? "360° Dossier" : "প্রোফাইল"}
                        </button>
                        <button
                          onClick={() => handleDelete(t.id, `${t.first_name} ${t.last_name}`)}
                          className="p-1.5 rounded-lg border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 text-xs font-medium transition-colors"
                          title="Delete educator"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================= TEACHER 360° WORKSPACE MODAL ================= */}
      {selectedTeacherId && (
        <ResponsiveDialog
          isOpen={!!selectedTeacherId}
          onClose={() => {
            setSelectedTeacherId(null);
            setProfile360(null);
          }}
          size="2xl"
          title={
            profile360 ? (
              <div className="flex items-center gap-2">
                <span>{profile360.teacher.first_name} {profile360.teacher.last_name}</span>
                {profile360.teacher.name_bn && (
                  <span className="text-xs font-normal text-gray-400">({profile360.teacher.name_bn})</span>
                )}
                {profile360.teacher.employee_id && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    {profile360.teacher.employee_id}
                  </span>
                )}
              </div>
            ) : "Educator 360° Dossier"
          }
          subtitle={
            profile360 ? `${profile360.teacher.designation || "Senior Teacher"} • ${profile360.teacher.department || "General"} Department • ${profile360.teacher.employment_type || "Permanent"}` : "Loading..."
          }
          icon={<GraduationCap size={20} />}
        >
          {loading360 || !profile360 ? (
            <div className="p-12 text-center text-gray-500 flex justify-center items-center gap-2">
              <Loader2 className="animate-spin text-indigo-600" size={24} /> Loading educator profile...
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Workspace Navigation Tabs */}
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/10 pb-3">
                <div className="flex items-center gap-2 overflow-x-auto">
                  <button
                    onClick={() => setActiveTab("workload")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      activeTab === "workload"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
                    }`}
                  >
                    <Clock size={14} /> Workload & Timetable
                  </button>
                  <button
                    onClick={() => setActiveTab("qualifications")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      activeTab === "qualifications"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
                    }`}
                  >
                    <Award size={14} /> Qualifications & Experience
                  </button>
                  <button
                    onClick={() => setActiveTab("actions")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      activeTab === "actions"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
                    }`}
                  >
                    <Sparkles size={14} /> Quick Classroom Actions
                  </button>
                  <button
                    onClick={() => setActiveTab("demographics")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      activeTab === "demographics"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
                    }`}
                  >
                    <Mail size={14} /> Profile & Records
                  </button>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => window.print()}
                    className="p-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 text-xs font-medium transition-colors"
                    title="Print educator profile"
                  >
                    <Printer size={14} />
                  </button>
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center gap-1 hover:bg-indigo-100 transition-colors"
                  >
                    <Edit size={12} /> {isEditing ? "View Dossier" : "Edit Details"}
                  </button>
                </div>
              </div>

              {/* TAB 1: WORKLOAD & TIMETABLE */}
              {activeTab === "workload" && (
                <div className="space-y-6">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/20">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Class Teacher Assignment</div>
                      <div className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                        {profile360.teacher.assigned_class || "Unassigned"}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {profile360.workload.assigned_class_student_count} Enrolled Students
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-500/5 border border-purple-100 dark:border-purple-500/20">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Weekly Teaching Load</div>
                      <div className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                        {profile360.workload.total_weekly_periods} Periods / Week
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Across {Object.keys(profile360.workload.weekly_routine).length} Active Teaching Days
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/20">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Subjects Assigned</div>
                      <div className="text-base font-bold text-gray-900 dark:text-white mt-1 truncate">
                        {profile360.teacher.subjects_taught || "None specified"}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {profile360.workload.unique_subjects.length} Unique Curricula
                      </p>
                    </div>
                  </div>

                  {/* Weekly Routine Matrix */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                      Weekly Classroom Schedule Matrix (Sunday – Thursday)
                    </h4>

                    {Object.keys(profile360.workload.weekly_routine).length === 0 ? (
                      <div className="p-8 text-center text-gray-400 bg-gray-50 dark:bg-white/[0.02] rounded-2xl border border-dashed border-gray-200 dark:border-white/10 text-xs">
                        No routine slots scheduled for this educator yet. Manage slots in Academic &gt; Routine.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {Object.entries(profile360.workload.weekly_routine).map(([day, slots]) => (
                          <div key={day} className="border border-gray-200 dark:border-white/10 rounded-2xl p-4 bg-white dark:bg-black/20">
                            <div className="font-bold text-xs uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-3 flex items-center justify-between">
                              <span>{day}</span>
                              <span className="text-[11px] font-normal text-gray-400">{slots.length} Periods</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {slots.map((s) => (
                                <div key={s.id} className="p-3 bg-gray-50 dark:bg-white/[0.03] rounded-xl border border-gray-100 dark:border-white/5 space-y-1">
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="font-bold text-gray-900 dark:text-white">{s.subject}</span>
                                    <span className="font-mono text-[10px] bg-white dark:bg-white/10 px-1.5 py-0.5 rounded border border-gray-200 dark:border-white/10">
                                      {s.period_number}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-gray-500 flex items-center justify-between">
                                    <span>{s.class_name} ({s.section})</span>
                                    <span>{s.room_number}</span>
                                  </div>
                                  <div className="text-[10px] text-gray-400 font-mono">
                                    {s.start_time} - {s.end_time}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: QUALIFICATIONS & EXPERIENCE */}
              {activeTab === "qualifications" && (
                <div className="space-y-6">
                  {/* Academic Qualifications */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                      <Award size={14} className="text-indigo-600" /> Academic Qualifications & Degrees
                    </h4>

                    {(!profile360.teacher.qualifications || profile360.teacher.qualifications.length === 0) ? (
                      <div className="p-6 text-center text-gray-400 bg-gray-50 dark:bg-white/[0.02] rounded-2xl border border-dashed border-gray-200 dark:border-white/10 text-xs">
                        No qualifications registered. Click &quot;Edit Details&quot; to add degrees.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {profile360.teacher.qualifications.map((q, idx) => (
                          <div key={idx} className="p-4 bg-gray-50 dark:bg-white/[0.03] rounded-2xl border border-gray-200 dark:border-white/10 space-y-1">
                            <div className="font-bold text-sm text-gray-900 dark:text-white">{q.degree}</div>
                            {q.major && (
                              <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Major: {q.major}</div>
                            )}
                            <div className="text-xs text-gray-500">{q.institution}</div>
                            <div className="flex justify-between items-center text-[11px] text-gray-400 font-mono pt-2 border-t border-gray-100 dark:border-white/5">
                              <span>Passing Year: {q.year || "—"}</span>
                              <span>Result: {q.result || "—"}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Prior Experience */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                      <Briefcase size={14} className="text-purple-600" /> Professional Teaching Experience
                    </h4>

                    {(!profile360.teacher.experience || profile360.teacher.experience.length === 0) ? (
                      <div className="p-6 text-center text-gray-400 bg-gray-50 dark:bg-white/[0.02] rounded-2xl border border-dashed border-gray-200 dark:border-white/10 text-xs">
                        No prior employment records logged.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {profile360.teacher.experience.map((exp, idx) => (
                          <div key={idx} className="p-4 bg-gray-50 dark:bg-white/[0.03] rounded-2xl border border-gray-200 dark:border-white/10">
                            <div className="font-bold text-sm text-gray-900 dark:text-white">{exp.role}</div>
                            <div className="text-xs text-gray-500">{exp.institution} • {exp.duration || "N/A"}</div>
                            {exp.responsibilities && (
                              <p className="text-xs text-gray-400 mt-2">{exp.responsibilities}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: CLASSROOM QUICK ACTIONS */}
              {activeTab === "actions" && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Direct Educator Shortcuts</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <a
                      href="/dashboard/attendance"
                      className="p-5 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0f0f11] hover:border-blue-500/50 hover:shadow-md transition-all group flex items-start gap-4"
                    >
                      <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                        <Clock size={20} />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">
                          Take Daily Attendance
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Mark attendance for {profile360.teacher.assigned_class || "assigned sections"} with 1-click roll call.
                        </p>
                      </div>
                    </a>

                    <a
                      href="/dashboard/results"
                      className="p-5 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0f0f11] hover:border-amber-500/50 hover:shadow-md transition-all group flex items-start gap-4"
                    >
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                        <Award size={20} />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-amber-600 transition-colors">
                          Grading & Marks Entry
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Record term examination marks and generate official NCTB progress reports.
                        </p>
                      </div>
                    </a>

                    <a
                      href="/dashboard/notices"
                      className="p-5 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0f0f11] hover:border-purple-500/50 hover:shadow-md transition-all group flex items-start gap-4"
                    >
                      <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
                        <FileText size={20} />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-purple-600 transition-colors">
                          Compose Classroom Notice
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Issue announcements to parents and students of {profile360.teacher.assigned_class || "your classes"}.
                        </p>
                      </div>
                    </a>

                    <a
                      href="/dashboard/exams"
                      className="p-5 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0f0f11] hover:border-emerald-500/50 hover:shadow-md transition-all group flex items-start gap-4"
                    >
                      <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                        <BookOpen size={20} />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                          Question Paper AI Generator
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Draft NCTB-aligned creative and MCQ question papers grounded on official curriculum.
                        </p>
                      </div>
                    </a>
                  </div>
                </div>
              )}

              {/* TAB 4: DEMOGRAPHICS & PROFILE RECORDS */}
              {activeTab === "demographics" && (
                <div className="space-y-4">
                  {isEditing ? (
                    <form onSubmit={handleUpdateTeacher} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">First Name</label>
                          <input
                            type="text"
                            value={editFormData.first_name || ""}
                            onChange={(e) => setEditFormData({ ...editFormData, first_name: e.target.value })}
                            className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Last Name</label>
                          <input
                            type="text"
                            value={editFormData.last_name || ""}
                            onChange={(e) => setEditFormData({ ...editFormData, last_name: e.target.value })}
                            className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Designation</label>
                          <input
                            type="text"
                            value={editFormData.designation || ""}
                            onChange={(e) => setEditFormData({ ...editFormData, designation: e.target.value })}
                            className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Department</label>
                          <input
                            type="text"
                            value={editFormData.department || ""}
                            onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                            className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Phone Number</label>
                          <input
                            type="text"
                            value={editFormData.phone_number || ""}
                            onChange={(e) => setEditFormData({ ...editFormData, phone_number: e.target.value })}
                            className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Assigned Class</label>
                          <select
                            value={editFormData.assigned_class || "Unassigned"}
                            onChange={(e) => setEditFormData({ ...editFormData, assigned_class: e.target.value })}
                            className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs outline-none"
                          >
                            <option value="Unassigned">Unassigned</option>
                            {classes.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Subjects Taught</label>
                          <input
                            type="text"
                            value={editFormData.subjects_taught || ""}
                            onChange={(e) => setEditFormData({ ...editFormData, subjects_taught: e.target.value })}
                            className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Emergency Contact</label>
                          <input
                            type="text"
                            value={editFormData.emergency_contact || ""}
                            onChange={(e) => setEditFormData({ ...editFormData, emergency_contact: e.target.value })}
                            className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Address</label>
                        <textarea
                          rows={2}
                          value={editFormData.address || ""}
                          onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                          className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs outline-none"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-white/10">
                        <button
                          type="button"
                          onClick={() => setIsEditing(false)}
                          className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingEdit}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                        >
                          {savingEdit ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save Changes
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="p-4 bg-gray-50 dark:bg-white/[0.02] rounded-2xl border border-gray-100 dark:border-white/5 space-y-2">
                        <div className="text-gray-400 font-semibold uppercase text-[10px]">Employment & Role</div>
                        <div>Employee ID: <strong className="font-mono">{profile360.teacher.employee_id || "N/A"}</strong></div>
                        <div>Employment Type: <strong>{profile360.teacher.employment_type || "Permanent"}</strong></div>
                        <div>Joining Date: <strong>{profile360.teacher.joining_date || "N/A"}</strong></div>
                        <div>Status: <span className="font-semibold text-green-600">{profile360.teacher.status}</span></div>
                      </div>

                      <div className="p-4 bg-gray-50 dark:bg-white/[0.02] rounded-2xl border border-gray-100 dark:border-white/5 space-y-2">
                        <div className="text-gray-400 font-semibold uppercase text-[10px]">Contact & Records</div>
                        <div>Official Email: <strong className="font-mono">{profile360.teacher.email || "N/A"}</strong></div>
                        <div>Phone Number: <strong>{profile360.teacher.phone_number || "N/A"}</strong></div>
                        <div>Emergency Contact: <strong>{profile360.teacher.emergency_contact || "N/A"}</strong></div>
                        <div>Address: <strong>{profile360.teacher.address || "N/A"}</strong></div>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </ResponsiveDialog>
      )}

      {/* ================= ONBOARD NEW EDUCATOR MODAL ================= */}
      <ResponsiveDialog
        isOpen={isOnboardOpen}
        onClose={() => setIsOnboardOpen(false)}
        size="xl"
        title={language === "EN" ? "Onboard New Educator" : "নতুন শিক্ষক যুক্ত করুন"}
        subtitle={language === "EN" ? "Register faculty account, assign classes & configure academic qualifications" : "শিক্ষক অ্যাকাউন্ট তৈরি, শ্রেণি দায়িত্ব ও শিক্ষাগত যোগ্যতা নির্ধারণ"}
        icon={<UserPlus size={20} />}
      >
        {errorMsg && (
          <div className="p-3 mb-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleCreateTeacher} className="space-y-5 text-xs">
          
          {/* Section 1: Basic Identity */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
              1. Basic Identity & Identification
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-400">First Name *</label>
                <input
                  required
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none focus:border-indigo-500"
                  placeholder="e.g. Farhana"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-400">Last Name *</label>
                <input
                  required
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none focus:border-indigo-500"
                  placeholder="e.g. Yasmin"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-400">Bengali Name</label>
                <input
                  value={formData.name_bn}
                  onChange={(e) => setFormData({ ...formData, name_bn: e.target.value })}
                  className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none focus:border-indigo-500 font-serif"
                  placeholder="উদাঃ ফারহানা ইয়াসমিন"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Employment & Department */}
          <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-white/10">
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
              2. Designation & Department
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-400">Employee ID</label>
                <input
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none font-mono"
                  placeholder="EMP-2026-001 (or auto)"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-400">Department *</label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none"
                >
                  <option value="Science">Science</option>
                  <option value="Arts">Arts / Humanities</option>
                  <option value="Commerce">Commerce / Business Studies</option>
                  <option value="General">General Education</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-400">Designation *</label>
                <select
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none"
                >
                  <option value="Senior Teacher">Senior Teacher</option>
                  <option value="Assistant Teacher">Assistant Teacher</option>
                  <option value="Junior Teacher">Junior Teacher</option>
                  <option value="Head Teacher">Head Teacher</option>
                  <option value="Assistant Head Teacher">Assistant Head Teacher</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-400">Employment Type *</label>
                <select
                  value={formData.employment_type}
                  onChange={(e) => setFormData({ ...formData, employment_type: e.target.value })}
                  className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none"
                >
                  <option value="Permanent">Permanent</option>
                  <option value="Contractual">Contractual</option>
                  <option value="Part-time">Part-time</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Account & Contact */}
          <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-white/10">
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
              3. Login Credentials & Contact Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-400">Official Email (Login ID) *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none"
                  placeholder="teacher@school.edu.bd"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-400">Initial Password *</label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-400">Mobile Phone Number</label>
                <input
                  type="tel"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none"
                  placeholder="017xxxxxxxx"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Class & Subject Assignment */}
          <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-white/10">
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
              4. Class Teacher Duty & Subjects
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-400">Assigned Class Teacher Duty</label>
                <select
                  value={formData.assigned_class}
                  onChange={(e) => setFormData({ ...formData, assigned_class: e.target.value })}
                  className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none"
                >
                  <option value="Unassigned">Unassigned (General Subject Teacher)</option>
                  {classes.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-400">Subjects Taught (Comma Separated)</label>
                <input
                  value={formData.subjects_taught}
                  onChange={(e) => setFormData({ ...formData, subjects_taught: e.target.value })}
                  className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none"
                  placeholder="e.g. Physics, Higher Mathematics"
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 dark:border-white/10">
            <button
              type="button"
              onClick={() => setIsOnboardOpen(false)}
              className="px-5 py-2.5 rounded-xl font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 shadow-sm disabled:opacity-50 min-h-[44px]"
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              Complete Educator Onboarding
            </button>
          </div>

        </form>
      </ResponsiveDialog>

    </div>
  );
}
