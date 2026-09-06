"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/providers";
import { 
  GraduationCap, UserPlus, Phone, BookOpen, 
  Trash2, Edit, Loader2, CheckCircle2, X 
} from "lucide-react";

interface TeacherItem {
  id: string;
  first_name: string;
  last_name: string;
  designation: string;
  assigned_class: string | null;
  subjects_taught: string | null;
  phone_number: string | null;
  email: string | null;
  password: string | null;
  status: string;
}

export default function TeachersCommandCenter() {
  const { language } = useLanguage();
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    designation: "Senior Teacher",
    assigned_class: "Class 1",
    subjects_taught: "English, Bangla",
    phone_number: "",
    email: "",
    password: "",
  });

  const classes = ["Play", "Nursery", "KG", "Class 1", "Class 2", "Class 3", "Class 4", "Class 5"];

  const fetchTeachers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/teachers/", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setTeachers(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/teachers/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const errorDetail = await res.json().catch(() => null);
        throw new Error(errorDetail?.detail || `Error: ${res.statusText}`);
      }

      setIsModalOpen(false);
      setFormData({
        first_name: "",
        last_name: "",
        designation: "Assistant Teacher",
        assigned_class: "Class 1",
        subjects_taught: "English, Bangla",
        phone_number: "",
        email: "",
        password: "Teacher@2026",
      });
      fetchTeachers();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create teacher account.");
      alert(err.message || "Failed to create teacher account.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name}?`)) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://127.0.0.1:8000/api/v1/teachers/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchTeachers();
    } catch (err) {
      alert("Failed to delete record.");
    }
  };

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
            Kids Shine International School • Class assignments, workload distribution & directory.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 shadow-sm"
        >
          <UserPlus size={18} />
          {language === "EN" ? "Onboard Educator" : "নতুন শিক্ষক যুক্ত করুন"}
        </button>
      </div>

      {/* Directory Table */}
      <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-gray-500 flex justify-center items-center gap-2">
            <Loader2 className="animate-spin text-indigo-600" size={20} /> Loading staff records...
          </div>
        ) : teachers.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            No educators registered yet.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/[0.05] text-xs font-bold uppercase text-gray-500">
              <tr>
                <th className="p-4">Faculty Member</th>
                <th className="p-4">Designation</th>
                <th className="p-4">Class Teacher</th>
                <th className="p-4">Subjects Taught</th>
                <th className="p-4">Contact</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {teachers.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="p-4">
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {t.first_name} {t.last_name}
                    </div>
                  </td>
                  <td className="p-4 text-gray-600 dark:text-gray-400 text-xs">
                    {t.designation || "Educator"}
                  </td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400">
                      {t.assigned_class || "None"}
                    </span>
                  </td>
                  <td className="p-4 text-xs font-medium text-gray-700 dark:text-gray-300">
                    {t.subjects_taught || "—"}
                  </td>
                  <td className="p-4 font-mono text-xs text-gray-500">
                    {t.phone_number ? (
                      <a href={`tel:${t.phone_number}`} className="inline-flex items-center gap-1 hover:underline">
                        <Phone size={12} /> {t.phone_number}
                      </a>
                    ) : "—"}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleDelete(t.id, `${t.first_name} ${t.last_name}`)}
                      className="px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 text-xs font-medium transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Onboard Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-white/10">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Onboard New Educator</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateTeacher} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">First Name *</label>
                  <input required value={formData.first_name} onChange={(e) => setFormData({...formData, first_name: e.target.value})} className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm outline-none focus:border-indigo-500" placeholder="e.g. Farhana" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Last Name *</label>
                  <input required value={formData.last_name} onChange={(e) => setFormData({...formData, last_name: e.target.value})} className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm outline-none focus:border-indigo-500" placeholder="e.g. Yasmin" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Official Email (Login ID) *</label>
                  <input 
                    type="email" 
                    required 
                    value={formData.email} 
                    onChange={(e) => setFormData({...formData, email: e.target.value})} 
                    className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm" 
                    placeholder="teacher@school.edu.bd" 
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Initial Password *</label>
                  <input 
                    type="password" 
                    required 
                    value={formData.password} 
                    onChange={(e) => setFormData({...formData, password: e.target.value})} 
                    className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm" 
                    placeholder="••••••••" 
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Designation *</label>
                <input required value={formData.designation} onChange={(e) => setFormData({...formData, designation: e.target.value})} className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm outline-none focus:border-indigo-500" placeholder="e.g. Senior Teacher" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Assigned Class</label>
                  <select value={formData.assigned_class} onChange={(e) => setFormData({...formData, assigned_class: e.target.value})} className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm outline-none">
                    {classes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Phone</label>
                  <input value={formData.phone_number} onChange={(e) => setFormData({...formData, phone_number: e.target.value})} className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm outline-none focus:border-indigo-500" placeholder="017XXXXXXXX" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Subjects Taught</label>
                <input value={formData.subjects_taught} onChange={(e) => setFormData({...formData, subjects_taught: e.target.value})} className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-sm outline-none focus:border-indigo-500" placeholder="e.g. English, Science" />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-white/10">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500">Cancel</button>
                <button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm">
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Complete Onboarding
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}