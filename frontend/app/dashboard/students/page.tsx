"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/providers";
import { 
  Users, UserPlus, Search, Phone, 
  CheckCircle2, AlertCircle, Loader2, X, Printer, FileText,
  Edit, ArrowRight, ArrowLeft, ShieldCheck, Calendar, BookOpen,
  Award, Wallet, Clock, MapPin, HeartPulse, History, ChevronRight
} from "lucide-react";
import { useInstitution } from "@/lib/institution";
import { fetchWithTenant } from "@/lib/api-client";
import { useAcademicClasses } from "@/lib/useAcademicClasses";
import { CustomSelect } from "@/components/ui/CustomSelect";

interface StudentItem {
  id: string;
  first_name: string;
  last_name: string;
  name_bn?: string | null;
  admission_number: string;
  class_name: string | null;
  section?: string | null;
  roll_number: string | null;
  group?: string | null;
  shift?: string | null;
  academic_year?: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  status: string;
}

export default function StudentsDirectoryPage() {
  const { language } = useLanguage();
  const { name } = useInstitution();
  const { classNames: classes, getClassByName } = useAcademicClasses();

  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  
  // Modals & Slips State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedStudentForSlip, setSelectedStudentForSlip] = useState<any | null>(null);

  // Student 360 Workspace State
  const [profile360, setProfile360] = useState<any | null>(null);
  const [loading360, setLoading360] = useState(false);
  const [active360Tab, setActive360Tab] = useState<"card" | "academic" | "personal" | "guardian" | "history">("card");
  const [isEditing360, setIsEditing360] = useState(false);
  const [saving360, setSaving360] = useState(false);
  const [editSuccessMsg, setEditSuccessMsg] = useState<string | null>(null);
  
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    name_bn: "",
    admission_number: "",
    class_name: "",
    section: "A",
    roll_number: "",
    group: "",
    shift: "Morning",
    academic_year: "",
    gender: "Male",
    date_of_birth: "",
    blood_group: "",
    birth_certificate_no: "",
    address: "",
    emergency_contact: "",
    previous_school: "",
    guardian_name: "",
    guardian_phone: "",
    health_notes: "",
    disciplinary_notes: "",
    status: "Active",
  });

  // 8-Step Bangladesh Admission Intake Form State
  const [admissionForm, setAdmissionForm] = useState({
    // Step 1: Session & Academic Level
    academic_year: "",
    class_name: "Class 1",
    desired_section: "A",
    shift: "Morning",
    group: "",
    
    // Step 2: Student Identity
    first_name: "",
    last_name: "",
    first_name_bn: "",
    last_name_bn: "",
    name_bn: "",
    date_of_birth: "",
    gender: "Male",
    blood_group: "O+",
    nationality: "Bangladeshi",
    religion: "Islam",
    birth_certificate_no: "",

    // Step 3: Parent & Guardian Details
    father_name_en: "",
    father_name_bn: "",
    mother_name_en: "",
    mother_name_bn: "",
    guardian_name: "",
    guardian_relationship: "Father",
    guardian_phone: "",
    guardian_email: "",
    guardian_nid: "",
    guardian_profession: "",

    // Step 4: Geographic Address Hierarchy
    division: "",
    district: "",
    upazila: "",
    union_ward: "Ward 10",
    present_address: "",
    permanent_address: "",
    same_as_present: true,

    // Step 5: Previous Academic Record
    previous_school: "",
    previous_board: "Dhaka",
    previous_roll: "",
    previous_gpa: "",

    // Step 6: Academic Placement
    roll_number: "",

    // Step 7: Documents Checklist
    doc_birth_cert: true,
    doc_photo: true,
    doc_transcript: false,
    doc_transfer_cert: false,

    // Step 8: Declaration & Consent
    declaration_accepted: false,
  });

  const handleOpen360 = async (studentId: string) => {
    setLoading360(true);
    setIsEditing360(false);
    setEditSuccessMsg(null);
    try {
      const res = await fetchWithTenant(`/api/v1/students/${studentId}/profile-360`);
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || "Unable to retrieve student profile.");
      }
      const data = await res.json();
      setProfile360(data);
      
      // Populate Edit Form
      const s = data.student || {};
      const g = data.guardian || {};
      setEditForm({
        first_name: s.first_name || "",
        last_name: s.last_name || "",
        name_bn: s.name_bn || "",
        admission_number: s.admission_number || "",
        class_name: s.class_name || "Class 1",
        section: s.section || "A",
        roll_number: s.roll_number && s.roll_number !== "—" ? s.roll_number : "",
        group: s.group || "",
        shift: s.shift || "Morning",
        academic_year: s.academic_year || "",
        gender: s.gender || "Male",
        date_of_birth: s.date_of_birth || "",
        blood_group: s.blood_group && s.blood_group !== "N/A" ? s.blood_group : "",
        birth_certificate_no: s.birth_certificate_no && s.birth_certificate_no !== "N/A" ? s.birth_certificate_no : "",
        address: s.address || "",
        emergency_contact: s.emergency_contact || "",
        previous_school: s.previous_school || "",
        guardian_name: g.name && g.name !== "Not Linked" ? g.name : "",
        guardian_phone: g.phone && g.phone !== "N/A" ? g.phone : "",
        health_notes: s.health_notes || "",
        disciplinary_notes: s.disciplinary_notes || "",
        status: s.status || "Active",
      });
    } catch (err: any) {
      alert(err.message || "Failed to load student 360 profile.");
    } finally {
      setLoading360(false);
    }
  };

  const handleSaveStudentEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile360?.student?.id) return;
    setSaving360(true);
    setEditSuccessMsg(null);

    try {
      const res = await fetchWithTenant(`/api/v1/students/${profile360.student.id}`, {
        method: "PATCH",
        body: JSON.stringify(editForm),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || "Failed to update student profile.");
      }

      setEditSuccessMsg("Student profile updated successfully with audit trail.");
      setIsEditing360(false);
      // Reload updated profile
      handleOpen360(profile360.student.id);
      fetchStudents();
    } catch (err: any) {
      alert(err.message || "Update failed.");
    } finally {
      setSaving360(false);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      let url = `/api/v1/students/?`;
      if (selectedClass) url += `class_name=${encodeURIComponent(selectedClass)}&`;
      if (search) url += `search=${encodeURIComponent(search)}&`;

      const res = await fetchWithTenant(url);
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
    fetchStudents();
  }, [selectedClass, search]);

  // Global Escape key dismissal for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedStudentForSlip) {
          setSelectedStudentForSlip(null);
        } else if (profile360) {
          setProfile360(null);
        } else if (isModalOpen) {
          setIsModalOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedStudentForSlip, profile360, isModalOpen]);

  const handleAdmissionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admissionForm.declaration_accepted) {
      setErrorMsg("Please accept the accuracy declaration before submitting.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    // Primary Admission Payload
    const appPayload = {
      ...admissionForm,
      permanent_address: admissionForm.same_as_present ? admissionForm.present_address : admissionForm.permanent_address,
      name_bn: admissionForm.name_bn || `${admissionForm.first_name_bn} ${admissionForm.last_name_bn}`.trim(),
    };

    // Backward-compatible direct student admit fallback
    const directPayload = {
      first_name: admissionForm.first_name,
      last_name: admissionForm.last_name,
      class_name: admissionForm.class_name,
      roll_number: admissionForm.roll_number || null,
      gender: admissionForm.gender,
      birth_certificate_no: admissionForm.birth_certificate_no || null,
      guardian: {
        first_name: admissionForm.guardian_name.split(" ")[0] || "Guardian",
        last_name: admissionForm.guardian_name.split(" ").slice(1).join(" ") || "",
        phone_number: admissionForm.guardian_phone,
        relationship_type: admissionForm.guardian_relationship,
        profession: admissionForm.guardian_profession || null
      }
    };

    try {
      // 1. Try modern Bangladesh admissions application endpoint
      const res = await fetchWithTenant("/api/v1/admissions/apply", {
        method: "POST",
        body: JSON.stringify(appPayload)
      });

      if (res.ok) {
        const appData = await res.json();
        // Auto enroll or show application record
        setSelectedStudentForSlip({
          ...admissionForm,
          admission_number: appData.application_number,
          admitted_date: new Date().toLocaleDateString(),
        });
      } else {
        // Fallback to direct student registration endpoint
        const fbRes = await fetchWithTenant("/api/v1/students/admit", {
          method: "POST",
          body: JSON.stringify(directPayload)
        });
        if (!fbRes.ok) {
          const err = await fbRes.json();
          throw new Error(err.detail || "Admission submission failed.");
        }
        const resData = await fbRes.json();
        setSelectedStudentForSlip({
          ...directPayload,
          admission_number: resData.admission_number || `STU-${admissionForm.academic_year || "2027"}-0001`,
          guardian_name: `${directPayload.guardian.first_name} ${directPayload.guardian.last_name}`,
          guardian_phone: directPayload.guardian.phone_number,
          relationship: directPayload.guardian.relationship_type,
          admitted_date: new Date().toLocaleDateString()
        });
      }

      setIsModalOpen(false);
      setWizardStep(1);
      fetchStudents();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit admission record.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    if (!confirm(`Are you sure you want to remove ${studentName}? This action cannot be undone.`)) return;
    try {
      const res = await fetchWithTenant(`/api/v1/students/${studentId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchStudents();
      }
    } catch (err) {
      alert("Failed to delete student record.");
    }
  };

  const currentClassDef = getClassByName(admissionForm.class_name);
  const supportedGroups = currentClassDef?.supported_groups || [];

  return (
    <div className="space-y-6">
      
      {/* Screen Controls */}
      <div className="print:hidden space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-white/[0.08] pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2.5">
              <Users className="text-blue-600 dark:text-blue-400" size={26} />
              {language === "EN" ? "Student Management & Registry" : "শিক্ষার্থী ব্যবস্থাপনা ও তথ্যভাণ্ডার"}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {name} • Central Student Information Workspace (Class 1–12)
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                setWizardStep(1);
                setErrorMsg(null);
                setIsModalOpen(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
            >
              <UserPlus size={16} />
              <span>{language === "EN" ? "New Admission (8-Step Wizard)" : "নতুন ভর্তি আবেদন"}</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder={language === "EN" ? "Search by student name, roll, or admission ID..." : "শিক্ষার্থীর নাম, রোল বা ভর্তি নম্বর দিয়ে খুঁজুন..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:border-blue-500"
            />
          </div>

          <div className="w-full sm:w-56">
            <CustomSelect
              value={selectedClass}
              onChange={(val) => setSelectedClass(val)}
              options={[{ value: "", label: language === "EN" ? "All Classes" : "সকল শ্রেণি" }, ...classes.map(c => ({ value: c, label: c }))]}
              placeholder={language === "EN" ? "Filter by Class" : "শ্রেণি বাছাই করুন"}
            />
          </div>
        </div>

        {/* Students Table */}
        <div className="border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden bg-white dark:bg-[#0f0f11] shadow-sm">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Loader2 className="animate-spin text-blue-600" size={28} />
              <span className="text-xs text-gray-500">Loading student registry...</span>
            </div>
          ) : students.length === 0 ? (
            <div className="py-20 text-center text-gray-400 text-xs">
              No students found for the selected criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50/75 dark:bg-black/20 border-b border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-semibold">
                    <th className="p-3.5">{language === "EN" ? "Admission ID" : "ভর্তি আইডি"}</th>
                    <th className="p-3.5">{language === "EN" ? "Student Name" : "শিক্ষার্থীর নাম"}</th>
                    <th className="p-3.5">{language === "EN" ? "Class & Roll" : "শ্রেণি ও রোল"}</th>
                    <th className="p-3.5">{language === "EN" ? "Stream / Shift" : "শাখা / শিফট"}</th>
                    <th className="p-3.5">{language === "EN" ? "Guardian Contact" : "অভিভাবক যোগাযোগ"}</th>
                    <th className="p-3.5">{language === "EN" ? "Status" : "অবস্থা"}</th>
                    <th className="p-3.5 text-right">{language === "EN" ? "Actions" : "পদক্ষেপ"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {students.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="p-3.5 font-mono font-medium text-gray-700 dark:text-gray-400">
                        {s.admission_number}
                      </td>
                      <td className="p-3.5 cursor-pointer group" onClick={() => handleOpen360(s.id)}>
                        <div className="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                          <span>{s.first_name} {s.last_name}</span>
                          {s.name_bn && <span className="text-gray-400 text-[10px]">({s.name_bn})</span>}
                        </div>
                        <div className="text-[10px] text-blue-600 dark:text-purple-400 flex items-center gap-1 mt-0.5">
                          {language === "EN" ? "View 360° Profile" : "৩৬০° প্রোফাইল দেখুন"} <ChevronRight size={10} />
                        </div>
                      </td>
                      <td className="p-3.5 font-medium">
                        {s.class_name || "Unassigned"} {s.section && `(${s.section})`} — Roll: {s.roll_number || "—"}
                      </td>
                      <td className="p-3.5 text-gray-500">
                        {s.group ? (
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 font-mono text-[10px]">
                            {s.group}
                          </span>
                        ) : (
                          <span>{s.shift || "Morning"}</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <div className="font-medium text-gray-900 dark:text-white">{s.guardian_name || "Not Linked"}</div>
                        <div className="text-[10px] text-gray-400 flex items-center gap-1 font-mono">
                          <Phone size={10} /> {s.guardian_phone || "N/A"}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300">
                          {s.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right space-x-2">
                        <button
                          onClick={() => handleOpen360(s.id)}
                          className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-400 hover:bg-gray-100 text-[11px] font-semibold"
                        >
                          {language === "EN" ? "360° Details" : "৩৬০° বিস্তারিত"}
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(s.id, `${s.first_name} ${s.last_name}`)}
                          className="px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-50 text-[11px]"
                        >
                          {language === "EN" ? "Remove" : "মুছে ফেলুন"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ================= 8-STEP BANGLADESH ADMISSION WIZARD MODAL ================= */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm print:hidden animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
          role="presentation"
        >
          <div
            className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl sm:rounded-3xl w-full max-w-3xl max-h-[92vh] max-w-[calc(100vw-1.5rem)] overflow-y-auto p-5 sm:p-8 shadow-2xl custom-scrollbar flex flex-col"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-white/10 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <UserPlus className="text-blue-600" size={20} />
                  {language === "EN" ? "Bangladesh School & College Admission Intake" : "বাংলাদেশ স্কুল ও কলেজ ভর্তি আবেদন"}
                </h3>
                <p className="text-xs text-gray-500">{name} • Step {wizardStep} of 8: {
                  wizardStep === 1 ? "Session & Grade Level" :
                  wizardStep === 2 ? "Student Identity" :
                  wizardStep === 3 ? "Parents & Guardian" :
                  wizardStep === 4 ? "Geographic Address" :
                  wizardStep === 5 ? "Previous Education" :
                  wizardStep === 6 ? "Academic Placement" :
                  wizardStep === 7 ? "Documents Checklist" : "Review & Declaration"
                }</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {/* Wizard Progress Bar */}
            <div className="w-full bg-gray-100 dark:bg-white/10 h-1.5 rounded-full mb-6 overflow-hidden">
              <div
                className="bg-blue-600 h-full transition-all duration-300"
                style={{ width: `${(wizardStep / 8) * 100}%` }}
              />
            </div>

            {errorMsg && (
              <div className="p-3 mb-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-700 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle size={14} /> {errorMsg}
              </div>
            )}

            {/* Form Steps */}
            <form onSubmit={wizardStep === 8 ? handleAdmissionSubmit : (e) => { e.preventDefault(); setWizardStep(prev => prev + 1); }} className="space-y-4 flex-1">
              
              {/* STEP 1: Academic Year & Level */}
              {wizardStep === 1 && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                    Step 1: Academic Year & Target Class
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Academic Year *</label>
                      <input
                        required
                        value={admissionForm.academic_year}
                        onChange={(e) => setAdmissionForm({ ...admissionForm, academic_year: e.target.value })}
                        className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs text-gray-900 dark:text-white"
                        placeholder="2026"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Admission Class *</label>
                      <CustomSelect
                        value={admissionForm.class_name}
                        onChange={(val) => setAdmissionForm({ ...admissionForm, class_name: val, group: "" })}
                        options={classes.map(c => ({ value: c, label: c }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Shift *</label>
                      <CustomSelect
                        value={admissionForm.shift}
                        onChange={(val) => setAdmissionForm({ ...admissionForm, shift: val })}
                        options={[{ value: "Morning", label: "Morning Shift (প্রভাতী)" }, { value: "Day", label: "Day Shift (দিবা)" }]}
                      />
                    </div>
                    {supportedGroups.length > 0 && (
                      <div>
                        <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Disciplinary Group (SSC/HSC) *</label>
                        <CustomSelect
                          value={admissionForm.group}
                          onChange={(val) => setAdmissionForm({ ...admissionForm, group: val })}
                          options={supportedGroups.map(g => ({ value: g, label: g }))}
                          placeholder="Select Stream..."
                        />
                      </div>
                    )}
                    <div className="sm:col-span-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                          <span>✨</span> System-Generated Unique ID
                        </div>
                        <div className="text-[11px] text-blue-700 dark:text-blue-400 mt-0.5">
                          Institutional student admission ID is auto-assigned upon admission (e.g. STU-{admissionForm.academic_year || "2026"}-XXXX).
                        </div>
                      </div>
                      <span className="px-2.5 py-1 text-[11px] font-mono font-medium rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 shrink-0">
                        Auto-Assigned
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Student Identity */}
              {wizardStep === 2 && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                    Step 2: Student Identity & Birth Registry
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">First Name (English) *</label>
                      <input
                        required
                        value={admissionForm.first_name}
                        onChange={(e) => setAdmissionForm({ ...admissionForm, first_name: e.target.value })}
                        className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2 text-xs text-gray-900 dark:text-white"
                        placeholder="Aarav"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Last Name (English) *</label>
                      <input
                        required
                        value={admissionForm.last_name}
                        onChange={(e) => setAdmissionForm({ ...admissionForm, last_name: e.target.value })}
                        className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2 text-xs text-gray-900 dark:text-white"
                        placeholder="Rahman"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">পূর্ণ নাম (বাংলায়)</label>
                      <input
                        value={admissionForm.name_bn}
                        onChange={(e) => setAdmissionForm({ ...admissionForm, name_bn: e.target.value })}
                        className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2 text-xs text-gray-900 dark:text-white"
                        placeholder="আরভ রহমান"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Date of Birth</label>
                      <input
                        type="date"
                        value={admissionForm.date_of_birth}
                        onChange={(e) => setAdmissionForm({ ...admissionForm, date_of_birth: e.target.value })}
                        className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2 text-xs text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Gender</label>
                      <CustomSelect
                        value={admissionForm.gender}
                        onChange={(val) => setAdmissionForm({ ...admissionForm, gender: val })}
                        options={[{ value: "Male", label: "Male (ছাত্র)" }, { value: "Female", label: "Female (ছাত্রী)" }]}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Blood Group</label>
                      <CustomSelect
                        value={admissionForm.blood_group}
                        onChange={(val) => setAdmissionForm({ ...admissionForm, blood_group: val })}
                        options={["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Birth Certificate Registration No (IPEMIS / জন্ম নিবন্ধন নম্বর)</label>
                      <input
                        value={admissionForm.birth_certificate_no}
                        onChange={(e) => setAdmissionForm({ ...admissionForm, birth_certificate_no: e.target.value })}
                        className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2 text-xs font-mono text-gray-900 dark:text-white"
                        placeholder="17-digit national birth registration number"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Parents & Guardian */}
              {wizardStep === 3 && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                    Step 3: Parents & Legal Guardian Information
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Father's Name (English)</label>
                      <input
                        value={admissionForm.father_name_en}
                        onChange={(e) => setAdmissionForm({ ...admissionForm, father_name_en: e.target.value })}
                        className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2 text-xs text-gray-900 dark:text-white"
                        placeholder="Md. Rafiqul Islam"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">পিতার নাম (বাংলা)</label>
                      <input
                        value={admissionForm.father_name_bn}
                        onChange={(e) => setAdmissionForm({ ...admissionForm, father_name_bn: e.target.value })}
                        className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2 text-xs text-gray-900 dark:text-white"
                        placeholder="মো: রফিকুল ইসলাম"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Mother's Name (English)</label>
                      <input
                        value={admissionForm.mother_name_en}
                        onChange={(e) => setAdmissionForm({ ...admissionForm, mother_name_en: e.target.value })}
                        className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2 text-xs text-gray-900 dark:text-white"
                        placeholder="Nasreen Akter"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">মাতার নাম (বাংলা)</label>
                      <input
                        value={admissionForm.mother_name_bn}
                        onChange={(e) => setAdmissionForm({ ...admissionForm, mother_name_bn: e.target.value })}
                        className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2 text-xs text-gray-900 dark:text-white"
                        placeholder="নাসরীন আক্তার"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Primary Guardian Name *</label>
                      <input
                        required
                        value={admissionForm.guardian_name}
                        onChange={(e) => setAdmissionForm({ ...admissionForm, guardian_name: e.target.value })}
                        className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2 text-xs text-gray-900 dark:text-white"
                        placeholder="Md. Rafiqul Islam"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Guardian Mobile Number (WhatsApp) *</label>
                      <input
                        required
                        value={admissionForm.guardian_phone}
                        onChange={(e) => setAdmissionForm({ ...admissionForm, guardian_phone: e.target.value })}
                        className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2 text-xs font-mono text-gray-900 dark:text-white"
                        placeholder="017XXXXXXXX"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Geographic Address */}
              {wizardStep === 4 && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                    Step 4: Geographic Hierarchy & Address
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Division (বিভাগ)</label>
                      <CustomSelect
                        value={admissionForm.division}
                        onChange={(val) => setAdmissionForm({ ...admissionForm, division: val })}
                        options={["Dhaka", "Chittagong", "Rajshahi", "Khulna", "Barisal", "Sylhet", "Rangpur", "Mymensingh"]}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">District (জেলা)</label>
                      <input
                        value={admissionForm.district}
                        onChange={(e) => setAdmissionForm({ ...admissionForm, district: e.target.value })}
                        className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2 text-xs text-gray-900 dark:text-white"
                        placeholder="Dhaka"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Upazila / Thana (থানা / উপজেলা)</label>
                      <input
                        value={admissionForm.upazila}
                        onChange={(e) => setAdmissionForm({ ...admissionForm, upazila: e.target.value })}
                        className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2 text-xs text-gray-900 dark:text-white"
                        placeholder="Dhanmondi"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Union / Ward (ওয়ার্ড / ইউনিয়ন)</label>
                      <input
                        value={admissionForm.union_ward}
                        onChange={(e) => setAdmissionForm({ ...admissionForm, union_ward: e.target.value })}
                        className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2 text-xs text-gray-900 dark:text-white"
                        placeholder="Ward 15"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Present Residential Address *</label>
                      <textarea
                        required
                        rows={2}
                        value={admissionForm.present_address}
                        onChange={(e) => setAdmissionForm({ ...admissionForm, present_address: e.target.value })}
                        className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2 text-xs text-gray-900 dark:text-white outline-none"
                        placeholder="House #, Road #, Area..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5: Previous Education */}
              {wizardStep === 5 && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                    Step 5: Previous School & Board Results
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Previous School / College Name</label>
                      <input
                        value={admissionForm.previous_school}
                        onChange={(e) => setAdmissionForm({ ...admissionForm, previous_school: e.target.value })}
                        className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2 text-xs text-gray-900 dark:text-white"
                        placeholder="St. Joseph / Government Laboratory School"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Education Board</label>
                      <CustomSelect
                        value={admissionForm.previous_board}
                        onChange={(val) => setAdmissionForm({ ...admissionForm, previous_board: val })}
                        options={["Dhaka", "Chittagong", "Rajshahi", "Jessore", "Comilla", "Barisal", "Sylhet", "Dinajpur", "Mymensingh", "Madrasah", "Technical"]}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Previous Exam GPA / Grade</label>
                      <input
                        value={admissionForm.previous_gpa}
                        onChange={(e) => setAdmissionForm({ ...admissionForm, previous_gpa: e.target.value })}
                        className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2 text-xs font-mono text-gray-900 dark:text-white"
                        placeholder="5.00"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 6: Placement */}
              {wizardStep === 6 && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                    Step 6: Class Placement & Roll Allocation
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Allocated Class</label>
                      <input
                        disabled
                        value={admissionForm.class_name}
                        className="w-full mt-1 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-2 text-xs font-bold text-gray-700 dark:text-gray-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Section Allocation</label>
                      <input
                        value={admissionForm.desired_section}
                        onChange={(e) => setAdmissionForm({ ...admissionForm, desired_section: e.target.value })}
                        className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2 text-xs font-semibold text-gray-900 dark:text-white"
                        placeholder="A"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Class Roll Number</label>
                      <input
                        value={admissionForm.roll_number}
                        onChange={(e) => setAdmissionForm({ ...admissionForm, roll_number: e.target.value })}
                        className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2 text-xs font-mono text-gray-900 dark:text-white"
                        placeholder="01"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 7: Documents Checklist */}
              {wizardStep === 7 && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                    Step 7: Required Document Physical / Digital Checklist
                  </div>
                  <div className="space-y-3 bg-gray-50 dark:bg-white/[0.02] p-4 rounded-xl border border-gray-200 dark:border-white/10">
                    <label className="flex items-center gap-3 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={admissionForm.doc_birth_cert}
                        onChange={(e) => setAdmissionForm({ ...admissionForm, doc_birth_cert: e.target.checked })}
                        className="rounded text-blue-600"
                      />
                      <span>Birth Registration Certificate (Verified Copy)</span>
                    </label>
                    <label className="flex items-center gap-3 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={admissionForm.doc_photo}
                        onChange={(e) => setAdmissionForm({ ...admissionForm, doc_photo: e.target.checked })}
                        className="rounded text-blue-600"
                      />
                      <span>Passport Size Photographs (2 Copies)</span>
                    </label>
                    <label className="flex items-center gap-3 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={admissionForm.doc_transcript}
                        onChange={(e) => setAdmissionForm({ ...admissionForm, doc_transcript: e.target.checked })}
                        className="rounded text-blue-600"
                      />
                      <span>Previous Academic Transcript / Report Card</span>
                    </label>
                    <label className="flex items-center gap-3 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={admissionForm.doc_transfer_cert}
                        onChange={(e) => setAdmissionForm({ ...admissionForm, doc_transfer_cert: e.target.checked })}
                        className="rounded text-blue-600"
                      />
                      <span>Transfer Certificate (TC) from Previous Institution</span>
                    </label>
                  </div>
                </div>
              )}

              {/* STEP 8: Review & Declaration */}
              {wizardStep === 8 && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                    Step 8: Review Summary & Legal Consent
                  </div>
                  <div className="bg-gray-50 dark:bg-white/[0.02] p-4 rounded-xl border border-gray-200 dark:border-white/10 text-xs space-y-2">
                    <div><strong>Applicant:</strong> {admissionForm.first_name} {admissionForm.last_name} ({admissionForm.name_bn || "—"})</div>
                    <div><strong>Class & Stream:</strong> {admissionForm.class_name} {admissionForm.group && `(${admissionForm.group})`} • {admissionForm.shift} Shift</div>
                    <div><strong>Guardian:</strong> {admissionForm.guardian_name} ({admissionForm.guardian_phone})</div>
                    <div><strong>Address:</strong> {admissionForm.present_address}, {admissionForm.upazila}, {admissionForm.district}</div>
                  </div>

                  <label className="flex items-start gap-3 p-3 bg-blue-50/50 dark:bg-blue-500/10 rounded-xl border border-blue-200 dark:border-blue-500/20 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      required
                      checked={admissionForm.declaration_accepted}
                      onChange={(e) => setAdmissionForm({ ...admissionForm, declaration_accepted: e.target.checked })}
                      className="mt-0.5 rounded text-blue-600"
                    />
                    <span className="text-gray-700 dark:text-gray-400">
                      I solemnly declare that all information provided in this admission form is complete, accurate, and truthful according to official institutional records and the laws of Bangladesh.
                    </span>
                  </label>
                </div>
              )}

              {/* Wizard Navigation Buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-white/10 mt-6">
                {wizardStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setWizardStep(prev => prev - 1)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5 flex items-center gap-1.5"
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                ) : <div />}

                {wizardStep < 8 ? (
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                  >
                    Continue <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting || !admissionForm.declaration_accepted}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    Submit Official Admission
                  </button>
                )}
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ================= STUDENT 360° WORKSPACE MODAL ================= */}
      {profile360 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm print:p-0 print:static print:bg-transparent animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setProfile360(null);
          }}
          role="presentation"
        >
          <div
            className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl sm:rounded-3xl w-full max-w-4xl max-h-[92vh] max-w-[calc(100vw-1.5rem)] overflow-y-auto p-5 sm:p-6 shadow-2xl print:border-none print:shadow-none print:p-0 print:max-w-none custom-scrollbar flex flex-col"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            
            {/* Modal Topbar Controls */}
            <div className="flex justify-between items-center pb-3 mb-4 border-b border-gray-100 dark:border-white/10 print:hidden">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Student 360° Comprehensive Workspace
                </span>
                {profile360.student?.group && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-purple-500/20 dark:text-purple-300 font-mono">
                    {profile360.student.group}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditing360(prev => !prev)}
                  className="bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-800 dark:text-gray-200 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Edit size={13} /> {isEditing360 ? "View Profile" : "Edit Student Records"}
                </button>
                <button
                  onClick={() => window.print()}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <Printer size={13} /> Print Card
                </button>
                <button onClick={() => setProfile360(null)} className="text-gray-400 hover:text-gray-600 p-1">
                  <X size={18} />
                </button>
              </div>
            </div>

            {editSuccessMsg && (
              <div className="p-3 mb-4 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-xl text-green-700 dark:text-green-300 text-xs flex items-center gap-2 print:hidden">
                <CheckCircle2 size={14} /> {editSuccessMsg}
              </div>
            )}

            {/* Editing Mode Form */}
            {isEditing360 ? (
              <form onSubmit={handleSaveStudentEdit} className="space-y-4 print:hidden">
                <div className="bg-amber-50 dark:bg-amber-500/10 p-3 rounded-xl border border-amber-200 dark:border-amber-500/20 text-xs text-amber-800 dark:text-amber-200">
                  <ShieldCheck size={14} className="inline mr-1" />
                  <strong>Administrative Editing Mode:</strong> All changes made here are logged with actor identity, timestamp, and before/after diffs in the security audit trail.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">First Name (EN)</label>
                    <input
                      required
                      value={editForm.first_name}
                      onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                      className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2 text-xs text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Last Name (EN)</label>
                    <input
                      required
                      value={editForm.last_name}
                      onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                      className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2 text-xs text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">বাংলা নাম (Bengali)</label>
                    <input
                      value={editForm.name_bn}
                      onChange={(e) => setEditForm({ ...editForm, name_bn: e.target.value })}
                      className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2 text-xs text-gray-900 dark:text-white"
                      placeholder="আরভ রহমান"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Class Level</label>
                    <CustomSelect
                      value={editForm.class_name}
                      onChange={(val) => setEditForm({ ...editForm, class_name: val })}
                      options={classes.map(c => ({ value: c, label: c }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Section</label>
                    <input
                      value={editForm.section}
                      onChange={(e) => setEditForm({ ...editForm, section: e.target.value })}
                      className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2 text-xs text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Class Roll Number</label>
                    <input
                      value={editForm.roll_number}
                      onChange={(e) => setEditForm({ ...editForm, roll_number: e.target.value })}
                      className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2 text-xs font-mono text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Disciplinary Group (SSC/HSC)</label>
                    <CustomSelect
                      value={editForm.group}
                      onChange={(val) => setEditForm({ ...editForm, group: val })}
                      options={[
                        { value: "", label: "None / General" },
                        { value: "Science", label: "Science (বিজ্ঞান)" },
                        { value: "Humanities", label: "Humanities (মানবিক)" },
                        { value: "Business Studies", label: "Business Studies (ব্যবসায় শিক্ষা)" },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Shift</label>
                    <CustomSelect
                      value={editForm.shift}
                      onChange={(val) => setEditForm({ ...editForm, shift: val })}
                      options={[{ value: "Morning", label: "Morning" }, { value: "Day", label: "Day" }]}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Blood Group</label>
                    <CustomSelect
                      value={editForm.blood_group}
                      onChange={(val) => setEditForm({ ...editForm, blood_group: val })}
                      options={["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Guardian Name</label>
                    <input
                      value={editForm.guardian_name}
                      onChange={(e) => setEditForm({ ...editForm, guardian_name: e.target.value })}
                      className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2 text-xs text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Guardian Phone</label>
                    <input
                      value={editForm.guardian_phone}
                      onChange={(e) => setEditForm({ ...editForm, guardian_phone: e.target.value })}
                      className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2 text-xs font-mono text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Emergency Contact</label>
                    <input
                      value={editForm.emergency_contact}
                      onChange={(e) => setEditForm({ ...editForm, emergency_contact: e.target.value })}
                      className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2 text-xs text-gray-900 dark:text-white"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-400">Residential Address</label>
                    <textarea
                      rows={2}
                      value={editForm.address}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                      className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2 text-xs text-gray-900 dark:text-white outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsEditing360(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving360}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    {saving360 ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    Save Changes & Log Audit
                  </button>
                </div>
              </form>
            ) : (
              /* View Tabs */
              <div className="flex-1 flex flex-col space-y-4">
                
                {/* Workspace Navigation Tabs */}
                <div className="flex border-b border-gray-200 dark:border-white/10 gap-1 print:hidden text-xs font-semibold">
                  <button
                    onClick={() => setActive360Tab("card")}
                    className={`px-3 py-2 border-b-2 transition-colors ${active360Tab === "card" ? "border-blue-600 text-blue-600 dark:text-blue-400 font-bold" : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white"}`}
                  >
                    Digital Twin Card
                  </button>
                  <button
                    onClick={() => setActive360Tab("academic")}
                    className={`px-3 py-2 border-b-2 transition-colors ${active360Tab === "academic" ? "border-blue-600 text-blue-600 dark:text-blue-400 font-bold" : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white"}`}
                  >
                    Academic & Stream
                  </button>
                  <button
                    onClick={() => setActive360Tab("personal")}
                    className={`px-3 py-2 border-b-2 transition-colors ${active360Tab === "personal" ? "border-blue-600 text-blue-600 dark:text-blue-400 font-bold" : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white"}`}
                  >
                    Demographics
                  </button>
                  <button
                    onClick={() => setActive360Tab("history")}
                    className={`px-3 py-2 border-b-2 transition-colors ${active360Tab === "history" ? "border-blue-600 text-blue-600 dark:text-blue-400 font-bold" : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white"}`}
                  >
                    Enrollment History
                  </button>
                </div>

                {/* TAB 1: Digital Twin Card (Official Printable) */}
                {active360Tab === "card" && (
                  <div className="font-serif text-black p-6 bg-white border border-gray-300 rounded-2xl print:border-none print:p-0 text-xs leading-relaxed">
                    <div className="text-center border-b-2 border-black pb-3 mb-4">
                      <h2 className="text-xl font-black uppercase tracking-wider">{name}</h2>
                      <p className="text-[10px] text-gray-600 italic">Student Cumulative Profile & Academic History</p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-3 rounded-xl mb-4 font-sans text-xs border border-gray-200">
                      <div>
                        <span className="text-gray-500 block text-[10px]">Student Name</span>
                        <strong>{profile360.student?.name || "—"}</strong>
                        {profile360.student?.name_bn && <div className="text-[10px] text-gray-600">{profile360.student.name_bn}</div>}
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[10px]">Admission ID</span>
                        <strong className="font-mono">{profile360.student?.admission_number || "—"}</strong>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[10px]">Class & Roll</span>
                        <strong>{profile360.student?.class_name || "Unassigned"} ({profile360.student?.section || "A"}) (Roll: {profile360.student?.roll_number || "—"})</strong>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[10px]">Attendance Rate</span>
                        <strong className="text-green-700">{profile360.attendance?.attendance_rate ?? 100}%</strong>
                      </div>
                    </div>

                    {/* Guardian & Background */}
                    <div className="mb-4 font-sans text-xs">
                      <h4 className="font-bold text-[11px] uppercase border-b border-gray-200 pb-1 mb-2">Guardian & Contact</h4>
                      <div className="grid grid-cols-3 gap-2">
                        <div>Guardian: <strong>{profile360.guardian?.name || "Not Linked"}</strong> ({profile360.guardian?.relationship || "Guardian"})</div>
                        <div>Phone: <strong>{profile360.guardian?.phone || "N/A"}</strong></div>
                        <div>Profession: <strong>{profile360.guardian?.profession || "N/A"}</strong></div>
                      </div>
                    </div>

                    {/* Academic Performance */}
                    <div className="mb-4 font-sans text-xs">
                      <h4 className="font-bold text-[11px] uppercase border-b border-gray-200 pb-1 mb-2">
                        Academic Performance (Term GPA: {profile360.academics?.average_gpa ?? "0.00"})
                      </h4>
                      {(!profile360.academics?.grades || profile360.academics.grades.length === 0) ? (
                        <p className="text-gray-400 italic">No exam evaluations recorded yet.</p>
                      ) : (
                        <table className="w-full text-left border-collapse border border-gray-300">
                          <thead>
                            <tr className="bg-gray-100 text-[10px]">
                              <th className="border p-1.5">Subject</th>
                              <th className="border p-1.5">Term</th>
                              <th className="border p-1.5 text-center">Marks</th>
                              <th className="border p-1.5 text-center">Grade</th>
                            </tr>
                          </thead>
                          <tbody>
                            {profile360.academics.grades.map((g: any, i: number) => (
                              <tr key={i}>
                                <td className="border p-1.5 font-semibold">{g.subject}</td>
                                <td className="border p-1.5 text-gray-500">{g.term || "General"}</td>
                                <td className="border p-1.5 text-center font-mono">{g.marks ?? "—"}</td>
                                <td className="border p-1.5 text-center font-bold">{g.grade || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {/* Fee Clearance Ledger */}
                    <div className="mb-6 font-sans text-xs">
                      <h4 className="font-bold text-[11px] uppercase border-b border-gray-200 pb-1 mb-2">Fee Clearance Ledger</h4>
                      {(!profile360.fees || profile360.fees.length === 0) ? (
                        <p className="text-gray-400 italic">No fee payments archived.</p>
                      ) : (
                        <div className="space-y-1 text-[11px]">
                          {profile360.fees.map((f: any, i: number) => (
                            <div key={i} className="flex justify-between py-1 border-b border-dashed border-gray-200">
                              <span>{f.fee_type || "Tuition Fee"} ({f.month || "Current"}) • Receipt: {f.receipt_number || f.receipt_no || "—"}</span>
                              <span className="font-mono font-bold text-green-700">৳{f.amount} ({f.date || "—"})</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 2: Academic & Stream */}
                {active360Tab === "academic" && (
                  <div className="grid grid-cols-2 gap-4 text-xs font-sans">
                    <div className="p-4 bg-gray-50 dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-white/10 space-y-2">
                      <div className="font-bold text-gray-700 dark:text-gray-400">Enrollment Placement</div>
                      <div>Class: <strong>{profile360.student?.class_name || "Unassigned"}</strong></div>
                      <div>Section: <strong>{profile360.student?.section || "A"}</strong></div>
                      <div>Roll: <strong>{profile360.student?.roll_number || "—"}</strong></div>
                      <div>Shift: <strong>{profile360.student?.shift || "Morning"}</strong></div>
                      <div>Group / Stream: <strong>{profile360.student?.group || "General"}</strong></div>
                      <div>Academic Session: <strong>{profile360.student?.academic_year || "2027"}</strong></div>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-white/10 space-y-2">
                      <div className="font-bold text-gray-700 dark:text-gray-400">Academic Standing</div>
                      <div>Average GPA: <strong>{profile360.academics?.average_gpa ?? "0.00"}</strong></div>
                      <div>Attendance Rate: <strong>{profile360.attendance?.attendance_rate ?? 100}%</strong></div>
                      <div>Total Records: <strong>{profile360.attendance?.total_records ?? 0} days</strong></div>
                    </div>
                  </div>
                )}

                {/* TAB 3: Demographics */}
                {active360Tab === "personal" && (
                  <div className="p-4 bg-gray-50 dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-white/10 text-xs font-sans space-y-2">
                    <div>Student Name (EN): <strong>{profile360.student?.name}</strong></div>
                    <div>Student Name (BN): <strong>{profile360.student?.name_bn || "—"}</strong></div>
                    <div>Gender: <strong>{profile360.student?.gender}</strong></div>
                    <div>Blood Group: <strong>{profile360.student?.blood_group}</strong></div>
                    <div>Birth Certificate No: <strong className="font-mono">{profile360.student?.birth_certificate_no}</strong></div>
                    <div>Residential Address: <strong>{profile360.student?.address || "—"}</strong></div>
                    <div>Emergency Contact: <strong>{profile360.student?.emergency_contact || "—"}</strong></div>
                    <div>Health Notes: <strong>{profile360.student?.health_notes || "None"}</strong></div>
                  </div>
                )}

                {/* TAB 4: Enrollment History */}
                {active360Tab === "history" && (
                  <div className="border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden text-xs">
                    {(!profile360.enrollment_history || profile360.enrollment_history.length === 0) ? (
                      <div className="p-6 text-center text-gray-400">No previous annual promotion sessions recorded.</div>
                    ) : (
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-gray-100 dark:bg-white/5 border-b border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 text-[10px] uppercase">
                            <th className="p-2.5">Academic Year</th>
                            <th className="p-2.5">Class & Section</th>
                            <th className="p-2.5">Roll</th>
                            <th className="p-2.5">Group</th>
                            <th className="p-2.5">Status</th>
                            <th className="p-2.5">Promoted Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                          {profile360.enrollment_history.map((h: any, i: number) => (
                            <tr key={i}>
                              <td className="p-2.5 font-bold">{h.academic_year}</td>
                              <td className="p-2.5">{h.class_name} ({h.section})</td>
                              <td className="p-2.5 font-mono">{h.roll_number || "—"}</td>
                              <td className="p-2.5">{h.group || "General"}</td>
                              <td className="p-2.5 font-semibold text-green-600">{h.status}</td>
                              <td className="p-2.5 text-gray-400">{h.date}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

              </div>
            )}

          </div>
        </div>
      )}

      {/* Slip Preview Modal (Printable) */}
      {selectedStudentForSlip && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm print:p-0 print:static print:bg-transparent animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedStudentForSlip(null);
          }}
          role="presentation"
        >
          <div
            className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl sm:rounded-3xl w-full max-w-xl max-h-[92vh] max-w-[calc(100vw-1.5rem)] overflow-y-auto p-5 sm:p-8 shadow-2xl print:border-none print:shadow-none print:p-0 print:max-w-none custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-gray-100 dark:border-white/10 print:hidden">
              <span className="text-sm font-bold text-gray-700 dark:text-gray-400">Admission Record Slip</span>
              <div className="flex items-center gap-2">
                <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm">
                  <Printer size={14} /> Print / Save PDF
                </button>
                <button onClick={() => setSelectedStudentForSlip(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="font-serif text-black p-6 bg-white border border-gray-300 rounded-2xl print:border-none print:p-0 text-xs leading-relaxed">
              <div className="text-center border-b-2 border-black pb-3 mb-4">
                <h2 className="text-lg font-black uppercase">{name}</h2>
                <p className="text-[10px] text-gray-600">Official Student Admission Slip • Session {selectedStudentForSlip.academic_year || "2027"}</p>
              </div>

              <div className="space-y-2 font-sans text-xs">
                <div>Applicant: <strong>{selectedStudentForSlip.first_name} {selectedStudentForSlip.last_name}</strong></div>
                <div>Admission ID: <strong className="font-mono">{selectedStudentForSlip.admission_number}</strong></div>
                <div>Class: <strong>{selectedStudentForSlip.class_name}</strong> (Roll: {selectedStudentForSlip.roll_number || "—"})</div>
                <div>Guardian: <strong>{selectedStudentForSlip.guardian_name || selectedStudentForSlip.guardian?.first_name}</strong></div>
                <div>Phone: <strong>{selectedStudentForSlip.guardian_phone || selectedStudentForSlip.guardian?.phone_number}</strong></div>
                <div>Date: <strong>{selectedStudentForSlip.admitted_date}</strong></div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
