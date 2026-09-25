"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/providers";
import { 
  Users, UserPlus, Search, Phone, 
  CheckCircle2, AlertCircle, Loader2, X, Printer, FileText 
} from "lucide-react";

interface StudentItem {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  class_name: string | null;
  roll_number: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  status: string;
  created_at?: string;
  birth_certificate_no?: string;
}

export default function StudentsRegistryPage() {
  const { language } = useLanguage();
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  
  // Modals & Slips State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedStudentForSlip, setSelectedStudentForSlip] = useState<any | null>(null);

  const classes = ["Play", "Nursery", "KG", "Class 1", "Class 2", "Class 3", "Class 4", "Class 5"];

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    admission_number: "",
    class_name: "Play",
    roll_number: "",
    gender: "Male",
    birth_certificate_no: "",
    guardian_first_name: "",
    guardian_last_name: "",
    guardian_phone: "",
    relationship_type: "Father",
    guardian_profession: ""
  });

  // Student 360 State
  const [profile360, setProfile360] = useState<any | null>(null);
  const [loading360, setLoading360] = useState(false);

  const handleOpen360 = async (studentId: string) => {
    setLoading360(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://127.0.0.1:8000/api/v1/students/${studentId}/profile-360`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setProfile360(await res.json());
      }
    } finally {
      setLoading360(false);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");

      let url = `http://127.0.0.1:8000/api/v1/students/?`;
      if (selectedClass) url += `class_name=${encodeURIComponent(selectedClass)}&`;
      if (search) url += `search=${encodeURIComponent(search)}&`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
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

  const handleAdmissionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    const payload = {
      first_name: formData.first_name,
      last_name: formData.last_name,
      admission_number: formData.admission_number,
      class_name: formData.class_name,
      roll_number: formData.roll_number || null,
      gender: formData.gender,
      birth_certificate_no: formData.birth_certificate_no || null,
      guardian: {
        first_name: formData.guardian_first_name,
        last_name: formData.guardian_last_name,
        phone_number: formData.guardian_phone,
        relationship_type: formData.relationship_type,
        profession: formData.guardian_profession || null
      }
    };

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/students/admit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Admission failed. Please check details.");
      }

      // Prepare print slip for this new admission
      setSelectedStudentForSlip({
        ...payload,
        guardian_name: `${payload.guardian.first_name} ${payload.guardian.last_name}`,
        guardian_phone: payload.guardian.phone_number,
        relationship: payload.guardian.relationship_type,
        admitted_date: new Date().toLocaleDateString()
      });

      setIsModalOpen(false);
      fetchStudents();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit admission record.");
    } finally {
      setSubmitting(false);
    }
  };

  // 1. Delete Handler
  const handleDeleteStudent = async (studentId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name}? This action cannot be undone.`)) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://127.0.0.1:8000/api/v1/students/${studentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchStudents();
      }
    } catch (err) {
      alert("Failed to delete student record.");
    }
  };

  const handlePrintSlip = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      
      {/* Screen Controls (Hidden when printing) */}
      <div className="print:hidden space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-white/[0.08] pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              {language === "EN" ? "Student & Guardian Registry" : "শিক্ষার্থী ও অভিভাবক ডিরেক্টরি"}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Kids Shine International School • Central student records with linked guardians.
            </p>
          </div>

          <button
            onClick={() => {
              setErrorMsg(null);
              setIsModalOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 shadow-sm"
          >
            <UserPlus size={18} />
            {language === "EN" ? "New Admission" : "নতুন শিক্ষার্থী ভর্তি"}
          </button>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl flex items-center px-4 py-2.5 shadow-sm">
            <Search className="text-gray-400 mr-2" size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={language === "EN" ? "Search by student name or Admission ID..." : "শিক্ষার্থীর নাম অথবা ভর্তি আইডি দিয়ে খুঁজুন..."}
              className="w-full bg-transparent text-sm text-gray-900 dark:text-white outline-none"
            />
          </div>

          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none shadow-sm"
          >
            <option value="">{language === "EN" ? "All Classes" : "সকল শ্রেণি"}</option>
            {classes.map((cls) => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>
        </div>

        {/* Directory Table */}
        <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-gray-500 flex justify-center items-center gap-2">
              <Loader2 className="animate-spin text-blue-600" size={20} /> Loading directory...
            </div>
          ) : students.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
              {language === "EN" ? "No students found matching your criteria." : "কোনো শিক্ষার্থী পাওয়া যায়নি।"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/[0.05] text-xs font-bold uppercase text-gray-500">
                  <tr>
                    <th className="p-4">Roll</th>
                    <th className="p-4">Student</th>
                    <th className="p-4">Class</th>
                    <th className="p-4">Admission ID</th>
                    <th className="p-4">Primary Guardian</th>
                    <th className="p-4">Contact</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {students.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
  
                      {/* ১. রোল */}
                      <td className="p-4 font-mono font-bold text-gray-700 dark:text-gray-300">
                        {s.roll_number || "—"}
                      </td>

                      {/* ২. শিক্ষার্থীর নাম (এখানে ক্লিক করলে 360° প্রোফাইল ওপেন হবে) */}
                      <td className="p-4 cursor-pointer" onClick={() => handleOpen360(s.id)}>
                        <div className="font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                          {s.first_name} {s.last_name}
                        </div>
                        <div className="text-[10px] text-gray-400">Click to view 360° profile</div>
                      </td>

                      {/* ৩. ক্লাস */}
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                          {s.class_name || "Unassigned"}
                        </span>
                      </td>

                      {/* ৪. ভর্তি নম্বর */}
                      <td className="p-4 font-mono text-gray-500 text-xs">
                        {s.admission_number}
                      </td>

                      {/* ৫. অভিভাবক */}
                      <td className="p-4 text-gray-700 dark:text-gray-300">
                        {s.guardian_name || "—"}
                      </td>

                      {/* ৬. ফোন */}
                      <td className="p-4">
                        {s.guardian_phone ? (
                          <a href={`tel:${s.guardian_phone}`} className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-mono text-xs hover:underline">
                            <Phone size={12} /> {s.guardian_phone}
                          </a>
                        ) : "—"}
                      </td>

                      {/* ৭. অ্যাকশন বাটনসমূহ (স্লিপ ও ডিলিট) */}
                      <td className="p-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedStudentForSlip({
                                first_name: s.first_name,
                                last_name: s.last_name,
                                admission_number: s.admission_number,
                                class_name: s.class_name,
                                roll_number: s.roll_number,
                                guardian_name: s.guardian_name,
                                guardian_phone: s.guardian_phone,
                                relationship: "Guardian",
                                admitted_date: s.created_at ? new Date(s.created_at).toLocaleDateString() : new Date().toLocaleDateString()
                              });
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 text-xs font-medium text-gray-700 dark:text-gray-300 inline-flex items-center gap-1 transition-colors"
                            title="Print Admission Slip"
                          >
                            <Printer size={13} /> {language === "EN" ? "Slip" : "স্লিপ"}
                          </button>

                          <button
                            onClick={() => handleDeleteStudent(s.id, `${s.first_name} ${s.last_name}`)}
                            className="px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 text-xs font-medium transition-colors"
                            title="Delete Record"
                          >
                            Delete
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

      </div>

      {/* Admission Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm print:hidden animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl custom-scrollbar">
            
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-white/10 pb-4 mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {language === "EN" ? "Student Admission Form" : "নতুন শিক্ষার্থী ভর্তি ফর্ম"}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Kids Shine International School • Single-Entry Pipeline</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {errorMsg && (
              <div className="p-4 mb-6 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
                <AlertCircle size={16} /> {errorMsg}
              </div>
            )}

            <form onSubmit={handleAdmissionSubmit} className="space-y-6">
              
              {/* Student Details */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-3">
                  1. Student Information (শিক্ষার্থীর তথ্য)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">First Name *</label>
                    <input required value={formData.first_name} onChange={(e) => setFormData({...formData, first_name: e.target.value})} className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500" placeholder="Aarav" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Last Name *</label>
                    <input required value={formData.last_name} onChange={(e) => setFormData({...formData, last_name: e.target.value})} className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500" placeholder="Rahman" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Admission ID *</label>
                    <input required value={formData.admission_number} onChange={(e) => setFormData({...formData, admission_number: e.target.value})} className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500" placeholder="KS-2027-001" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Class *</label>
                    <select value={formData.class_name} onChange={(e) => setFormData({...formData, class_name: e.target.value})} className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500">
                      {classes.map(cls => <option key={cls} value={cls}>{cls}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Roll Number</label>
                    <input value={formData.roll_number} onChange={(e) => setFormData({...formData, roll_number: e.target.value})} className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500" placeholder="01" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Birth Certificate No. (IPEMIS)</label>
                    <input value={formData.birth_certificate_no} onChange={(e) => setFormData({...formData, birth_certificate_no: e.target.value})} className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500" placeholder="17-digit number" />
                  </div>
                </div>
              </div>

              {/* Guardian Details */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-3">
                  2. Primary Guardian Details (অভিভাবকের তথ্য)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Guardian First Name *</label>
                    <input required value={formData.guardian_first_name} onChange={(e) => setFormData({...formData, guardian_first_name: e.target.value})} className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-purple-500" placeholder="Rafiqul" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Guardian Last Name *</label>
                    <input required value={formData.guardian_last_name} onChange={(e) => setFormData({...formData, guardian_last_name: e.target.value})} className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-purple-500" placeholder="Islam" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Phone Number (WhatsApp) *</label>
                    <input required value={formData.guardian_phone} onChange={(e) => setFormData({...formData, guardian_phone: e.target.value})} className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-purple-500" placeholder="017XXXXXXXX" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Relationship *</label>
                    <select value={formData.relationship_type} onChange={(e) => setFormData({...formData, relationship_type: e.target.value})} className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-purple-500">
                      <option value="Father">Father (পিতা)</option>
                      <option value="Mother">Mother (মাতা)</option>
                      <option value="Legal Guardian">Legal Guardian (আইনগত অভিভাবক)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-white/10">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 shadow-sm disabled:opacity-50">
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Complete Admission
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Slip Preview Modal (On Screen) */}
      {selectedStudentForSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:p-0 print:static print:bg-transparent animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl w-full max-w-xl p-6 sm:p-8 shadow-2xl print:border-none print:shadow-none print:p-0 print:max-w-none">
            
            {/* Modal Actions */}
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-gray-100 dark:border-white/10 print:hidden">
              <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Admission Record Slip</span>
              <div className="flex items-center gap-2">
                <button onClick={handlePrintSlip} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm">
                  <Printer size={14} /> Print / Save PDF
                </button>
                <button onClick={() => setSelectedStudentForSlip(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Printable A4 Admission Slip Document */}
            <div className="font-serif text-black p-6 bg-white border border-gray-300 rounded-xl print:border-none print:p-0">
              
              {/* Slip Header */}
              <div className="text-center border-b-2 border-black pb-3 mb-4">
                <h2 className="text-xl font-black uppercase tracking-wider">Kids Shine International School</h2>
                <p className="text-[11px] italic">School Registration & Admission Record Slip</p>
                <div className="mt-2 inline-block bg-black text-white px-3 py-0.5 text-xs font-sans font-bold uppercase rounded">
                  Official Copy
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs mb-8">
                <div>
                  <span className="font-bold">Student Name: </span>
                  <span>{selectedStudentForSlip.first_name} {selectedStudentForSlip.last_name}</span>
                </div>
                <div>
                  <span className="font-bold">Admission ID: </span>
                  <span className="font-mono font-bold">{selectedStudentForSlip.admission_number}</span>
                </div>
                <div>
                  <span className="font-bold">Class: </span>
                  <span>{selectedStudentForSlip.class_name}</span>
                </div>
                <div>
                  <span className="font-bold">Roll Number: </span>
                  <span>{selectedStudentForSlip.roll_number || "Pending"}</span>
                </div>
                <div>
                  <span className="font-bold">Primary Guardian: </span>
                  <span>{selectedStudentForSlip.guardian_name}</span>
                </div>
                <div>
                  <span className="font-bold">Contact: </span>
                  <span className="font-mono">{selectedStudentForSlip.guardian_phone}</span>
                </div>
                <div>
                  <span className="font-bold">Relationship: </span>
                  <span>{selectedStudentForSlip.relationship || "Guardian"}</span>
                </div>
                <div>
                  <span className="font-bold">Date of Admission: </span>
                  <span>{selectedStudentForSlip.admitted_date}</span>
                </div>
              </div>

              {/* Institutional Signatures */}
              <div className="flex justify-between pt-12 mt-8 border-t border-dashed border-gray-400 text-[11px]">
                <div className="text-center">
                  <div className="w-32 border-t border-black mb-1"></div>
                  <span>Guardian Signature</span>
                </div>
                <div className="text-center">
                  <div className="w-32 border-t border-black mb-1"></div>
                  <span>Admission Officer</span>
                </div>
                <div className="text-center">
                  <div className="w-32 border-t border-black mb-1"></div>
                  <span>Head of Institution</span>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Student 360° Profile Modal */}
      {profile360 && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm print:p-0 print:static print:bg-transparent">
          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl print:border-none print:shadow-none print:p-0 print:max-w-none custom-scrollbar">
            
            <div className="flex justify-between items-center pb-3 mb-4 border-b border-gray-100 dark:border-white/10 print:hidden">
              <span className="text-xs font-bold text-gray-400">Student 360° Digital Twin Profile</span>
              <div className="flex items-center gap-2">
                <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm">
                  <Printer size={13} /> Print Profile Card
                </button>
                <button onClick={() => setProfile360(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
              </div>
            </div>

            {/* Printable Institutional Card */}
            <div className="font-serif text-black p-6 bg-white border border-gray-300 rounded-2xl print:border-none print:p-0 text-xs leading-relaxed">
              
              {/* Header */}
              <div className="text-center border-b-2 border-black pb-3 mb-4">
                <h2 className="text-xl font-black uppercase tracking-wider">Kids Shine International School</h2>
                <p className="text-[10px] text-gray-600 italic">Student Cumulative Profile & Academic History</p>
              </div>

              {/* Top Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-3 rounded-xl mb-4 font-sans text-xs border border-gray-200">
                <div>
                  <span className="text-gray-500 block text-[10px]">Student Name</span>
                  <strong>{profile360.student.name}</strong>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px]">Admission ID</span>
                  <strong className="font-mono">{profile360.student.admission_number}</strong>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px]">Class & Roll</span>
                  <strong>{profile360.student.class_name} (Roll: {profile360.student.roll_number})</strong>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px]">Attendance Rate</span>
                  <strong className="text-green-700">{profile360.attendance.attendance_rate}%</strong>
                </div>
              </div>

              {/* Guardian & Background */}
              <div className="mb-4 font-sans text-xs">
                <h4 className="font-bold text-[11px] uppercase border-b border-gray-200 pb-1 mb-2">Guardian & Contact</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div>Guardian: <strong>{profile360.guardian.name}</strong> ({profile360.guardian.relationship})</div>
                  <div>Phone: <strong>{profile360.guardian.phone}</strong></div>
                  <div>Profession: <strong>{profile360.guardian.profession}</strong></div>
                </div>
              </div>

              {/* Academic Grades */}
              <div className="mb-4 font-sans text-xs">
                <h4 className="font-bold text-[11px] uppercase border-b border-gray-200 pb-1 mb-2">
                  Academic Performance (Term GPA: {profile360.academics.average_gpa})
                </h4>
                {profile360.academics.grades.length === 0 ? (
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
                          <td className="border p-1.5 text-gray-500">{g.term}</td>
                          <td className="border p-1.5 text-center font-mono">{g.marks}</td>
                          <td className="border p-1.5 text-center font-bold">{g.grade}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Recent Tuition Payments */}
              <div className="mb-6 font-sans text-xs">
                <h4 className="font-bold text-[11px] uppercase border-b border-gray-200 pb-1 mb-2">Fee Clearance Ledger</h4>
                {profile360.fees.length === 0 ? (
                  <p className="text-gray-400 italic">No fee payments archived.</p>
                ) : (
                  <div className="space-y-1 text-[11px]">
                    {profile360.fees.map((f: any, i: number) => (
                      <div key={i} className="flex justify-between py-1 border-b border-dashed border-gray-200">
                        <span>{f.fee_type} ({f.month}) • Receipt: {f.receipt_no}</span>
                        <span className="font-mono font-bold text-green-700">৳{f.amount} ({f.date})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Signatures */}
              <div className="flex justify-between pt-8 text-[10px] font-sans">
                <div className="text-center">
                  <div className="w-24 border-t border-black mb-1"></div>
                  <span>Class Teacher</span>
                </div>
                <div className="text-center">
                  <div className="w-24 border-t border-black mb-1"></div>
                  <span>Head of Institution</span>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}