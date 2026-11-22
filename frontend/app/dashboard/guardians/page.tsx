"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/providers";
import { 
  Users, Phone, MessageSquare, Search, 
  Send, ExternalLink, Loader2, Sparkles, X,
  UserPlus, KeyRound, Copy, Check, Ban, RefreshCw,
  ShieldCheck, Clock, CheckCircle2, AlertCircle, Link as LinkIcon
} from "lucide-react";
import { useInstitution } from "@/lib/institution";
import { fetchWithTenant } from "@/lib/api-client";
import { useAcademicClasses } from "@/lib/useAcademicClasses";

interface LinkedChild {
  student_id: string;
  student_name: string;
  admission_number: string;
  class_name?: string | null;
  roll_number?: string | null;
  relationship: string;
  is_primary: boolean;
  verification_status: string;
}

interface GuardianAdminRecord {
  id: string;
  user_id?: string | null;
  first_name: string;
  last_name?: string | null;
  guardian_name: string;
  phone_number: string;
  email?: string | null;
  profession?: string | null;
  portal_status: "NOT_PROVISIONED" | "INVITED" | "ACTIVE" | "SUSPENDED";
  invitation_expires_at?: string | null;
  linked_students: LinkedChild[];
}

interface DirectoryItem {
  id: string;
  guardian_name: string;
  phone_number: string;
  relationship: string;
  student_name: string;
  class_name: string;
  roll_number: string;
  admission_number: string;
}

interface StudentOption {
  id: string;
  name: string;
  admission_number: string;
  class_name: string;
  roll_number?: string | null;
}

export default function GuardianDirectoryPage() {
  const { language } = useLanguage();
  const { name } = useInstitution();
  const { classNames: classes } = useAcademicClasses();

  // Active view: "accounts" (Portal Access & Management) or "whatsapp" (Notice Hub)
  const [activeView, setActiveView] = useState<"accounts" | "whatsapp">("accounts");

  // Data states
  const [guardians, setGuardians] = useState<GuardianAdminRecord[]>([]);
  const [directoryItems, setDirectoryItems] = useState<DirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState("");

  // Action & Modal States
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [selectedGuardianForLink, setSelectedGuardianForLink] = useState<GuardianAdminRecord | null>(null);

  // Activation Link Modal State
  const [activationModal, setActivationModal] = useState<{
    guardianName: string;
    phoneNumber: string;
    activationUrl: string;
    activationToken: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // WhatsApp Broadcast Modal State
  const [selectedGuardianForMsg, setSelectedGuardianForMsg] = useState<DirectoryItem | null>(null);
  const [messageType, setMessageType] = useState<"absent" | "fee" | "meeting" | "custom">("absent");
  const [customMsg, setCustomMsg] = useState("");

  // Available Students for Linking
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [searchingStudents, setSearchingStudents] = useState(false);

  // Onboard Form State
  const [onboardForm, setOnboardForm] = useState({
    first_name: "",
    last_name: "",
    phone_number: "",
    email: "",
    profession: "",
    relationship_type: "Father",
    student_id: "",
    is_primary: true,
  });
  const [onboardSubmitting, setOnboardSubmitting] = useState(false);
  const [onboardError, setOnboardError] = useState<string | null>(null);

  // Link Child Form State
  const [linkForm, setLinkForm] = useState({
    student_id: "",
    relationship_type: "Father",
    is_primary: false,
  });
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const fetchGuardians = async () => {
    setLoading(true);
    try {
      const q = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await fetchWithTenant(`/api/v1/guardians/admin/all${q}`);
      if (res.ok) {
        setGuardians(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDirectory = async () => {
    try {
      let url = `/api/v1/guardians/directory?`;
      if (selectedClass) url += `class_name=${encodeURIComponent(selectedClass)}&`;
      if (search) url += `search=${encodeURIComponent(search)}&`;

      const res = await fetchWithTenant(url);
      if (res.ok) {
        setDirectoryItems(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchGuardians();
    fetchDirectory();
  }, [search, selectedClass]);

  // Search students for selector
  const handleSearchStudents = async (term: string) => {
    setStudentSearch(term);
    if (!term || term.trim().length < 2) {
      setStudentOptions([]);
      return;
    }
    setSearchingStudents(true);
    try {
      const res = await fetchWithTenant(`/api/v1/students/search?q=${encodeURIComponent(term.trim())}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setStudentOptions(data.map((s: any) => ({
          id: s.id,
          name: `${s.first_name} ${s.last_name}`.trim(),
          admission_number: s.admission_number,
          class_name: s.class_name,
          roll_number: s.roll_number
        })));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearchingStudents(false);
    }
  };

  // Onboard new guardian
  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOnboardError(null);
    setOnboardSubmitting(true);
    try {
      const res = await fetchWithTenant("/api/v1/guardians/onboard", {
        method: "POST",
        body: JSON.stringify({
          first_name: onboardForm.first_name.trim(),
          last_name: onboardForm.last_name.trim() || "",
          phone_number: onboardForm.phone_number.trim(),
          email: onboardForm.email.trim() || null,
          profession: onboardForm.profession.trim() || null,
          relationship_type: onboardForm.relationship_type,
          student_id: onboardForm.student_id || null,
          is_primary: onboardForm.is_primary,
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || "Failed to onboard guardian.");
      }

      const data = await res.json();
      setIsOnboardModalOpen(false);
      setOnboardForm({
        first_name: "",
        last_name: "",
        phone_number: "",
        email: "",
        profession: "",
        relationship_type: "Father",
        student_id: "",
        is_primary: true,
      });

      setActivationModal({
        guardianName: data.guardian_name,
        phoneNumber: data.phone_number,
        activationUrl: data.activation_url,
        activationToken: data.activation_token
      });

      fetchGuardians();
      fetchDirectory();
    } catch (err: any) {
      setOnboardError(err.message || "Failed to onboard guardian.");
    } finally {
      setOnboardSubmitting(false);
    }
  };

  // Reissue invitation / reset password
  const handleInviteGuardian = async (g: GuardianAdminRecord) => {
    setActionLoading(g.id);
    try {
      const res = await fetchWithTenant(`/api/v1/guardians/${g.id}/portal/invite`, {
        method: "POST"
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || "Failed to generate invitation.");
      }
      const data = await res.json();
      setActivationModal({
        guardianName: g.guardian_name,
        phoneNumber: g.phone_number,
        activationUrl: data.activation_url,
        activationToken: data.activation_token
      });
      fetchGuardians();
    } catch (err: any) {
      alert(err.message || "Failed to issue invitation.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetPassword = async (g: GuardianAdminRecord) => {
    if (!confirm(language === "EN" ? `Reset password and generate new activation link for ${g.guardian_name}? Existing sessions will be terminated.` : `${g.guardian_name} এর পাসওয়ার্ড রিসেট এবং নতুন লিংক তৈরি করবেন?`)) return;
    setActionLoading(g.id);
    try {
      const res = await fetchWithTenant(`/api/v1/guardians/${g.id}/portal/reset-password`, {
        method: "POST"
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || "Failed to reset password.");
      }
      const data = await res.json();
      setActivationModal({
        guardianName: g.guardian_name,
        phoneNumber: g.phone_number,
        activationUrl: data.activation_url,
        activationToken: data.activation_token
      });
      fetchGuardians();
    } catch (err: any) {
      alert(err.message || "Failed to reset password.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspendGuardian = async (g: GuardianAdminRecord) => {
    if (!confirm(language === "EN" ? `Suspend portal access for ${g.guardian_name}?` : `${g.guardian_name} এর পোর্টাল প্রবেশাধিকার স্থগিত করবেন?`)) return;
    setActionLoading(g.id);
    try {
      const res = await fetchWithTenant(`/api/v1/guardians/${g.id}/portal/suspend`, {
        method: "POST"
      });
      if (!res.ok) throw new Error("Failed to suspend guardian access.");
      fetchGuardians();
    } catch (err: any) {
      alert(err.message || "Failed to suspend access.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivateGuardian = async (g: GuardianAdminRecord) => {
    setActionLoading(g.id);
    try {
      const res = await fetchWithTenant(`/api/v1/guardians/${g.id}/portal/reactivate`, {
        method: "POST"
      });
      if (!res.ok) throw new Error("Failed to reactivate access.");
      fetchGuardians();
    } catch (err: any) {
      alert(err.message || "Failed to reactivate access.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleLinkStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGuardianForLink || !linkForm.student_id) return;
    setLinkSubmitting(true);
    setLinkError(null);
    try {
      const res = await fetchWithTenant(`/api/v1/guardians/${selectedGuardianForLink.id}/link-student/${linkForm.student_id}`, {
        method: "POST",
        body: JSON.stringify({
          relationship_type: linkForm.relationship_type,
          is_primary: linkForm.is_primary
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || "Failed to link student.");
      }
      setIsLinkModalOpen(false);
      setSelectedGuardianForLink(null);
      setLinkForm({ student_id: "", relationship_type: "Father", is_primary: false });
      fetchGuardians();
      fetchDirectory();
    } catch (err: any) {
      setLinkError(err.message || "Failed to link child.");
    } finally {
      setLinkSubmitting(false);
    }
  };

  const handleUnlinkStudent = async (guardianId: string, studentId: string, studentName: string) => {
    if (!confirm(language === "EN" ? `Unlink child ${studentName} from this guardian?` : `এই অভিভাবক থেকে শিক্ষার্থী ${studentName} কে বিচ্ছিন্ন করবেন?`)) return;
    try {
      const res = await fetchWithTenant(`/api/v1/guardians/${guardianId}/unlink-student/${studentId}`, {
        method: "POST"
      });
      if (!res.ok) throw new Error("Failed to unlink student.");
      fetchGuardians();
      fetchDirectory();
    } catch (err: any) {
      alert(err.message || "Failed to unlink child.");
    }
  };

  const handleCopyLink = (path: string) => {
    const fullUrl = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleShareWhatsApp = (path: string, guardianName: string, phone: string) => {
    const fullUrl = `${window.location.origin}${path}`;
    const schoolName = name || "School Administration";
    const message = language === "EN"
      ? `Assalamu Alaikum, ${guardianName}. Greetings from ${schoolName}. Here is your secure Guardian Portal activation invitation link: ${fullUrl} . Please click the link to set your permanent login password and access your child's academic updates, attendance, and fee invoices.`
      : `আসসালামু আলাইকুম, সম্মানিত অভিভাবক ${guardianName}। ${schoolName}-এর পক্ষ থেকে আপনার অভিভাবক পোর্টাল অ্যাক্টিভেশন লিংক: ${fullUrl} । লিংকে ক্লিক করে পাসওয়ার্ড সেট করুন এবং সন্তানের উপস্থিতি, পরীক্ষার ফলাফল ও ফি সংক্রান্ত তথ্য সরাসরি দেখুন।`;
    
    let clean = (phone || "").replace(/\D/g, "");
    if (clean.length >= 10 && !clean.startsWith("88")) {
      clean = "88" + clean;
    }
    const target = clean ? `https://wa.me/${clean}?text=${encodeURIComponent(message)}` : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(target, "_blank");
  };

  // WhatsApp Broadcast Helper
  const getTemplateText = () => {
    if (!selectedGuardianForMsg) return "";
    const sName = selectedGuardianForMsg.student_name;
    const cls = selectedGuardianForMsg.class_name;
    const schoolDisplay = name || "School Administration";
    switch (messageType) {
      case "absent":
        return `আসসালামু আলাইকুম। সম্মানিত অভিভাবক, আপনার সন্তান ${sName} (শ্রেণি: ${cls}, আইডি: ${selectedGuardianForMsg.admission_number}) আজ বিদ্যালয়ে উপস্থিত নেই। কোনো জরুরি সমস্যা থাকলে বিদ্যালয় কর্তৃপক্ষকে অবহিত করার জন্য অনুরোধ করা হলো। - ${schoolDisplay}`;
      case "fee":
        return `আসসালামু আলাইকুম। সম্মানিত অভিভাবক, ${sName}-এর চলতি মাসের টিউশন ফি বকেয়া রয়েছে। নির্ধারিত সময়ের মধ্যে ফি পরিশোধ করার জন্য বিনীত অনুরোধ জানাচ্ছি। - ${schoolDisplay}`;
      case "meeting":
        return `আসসালামু আলাইকুম। সম্মানিত অভিভাবক, আগামী বৃহস্পতিবার বিদ্যালয়ে অভিভাবক সমাবেশ অনুষ্ঠিত হবে। আপনার উপস্থিতি একান্ত কাম্য। - ${schoolDisplay}`;
      case "custom":
        return customMsg;
    }
  };

  const handleOpenNoticeWhatsApp = () => {
    if (!selectedGuardianForMsg) return;
    let phone = selectedGuardianForMsg.phone_number.replace(/\D/g, "");
    if (!phone.startsWith("88")) {
      phone = "88" + phone;
    }
    const text = encodeURIComponent(getTemplateText());
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-white/[0.08] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2.5">
            <Users className="text-emerald-600 dark:text-emerald-400" />
            {language === "EN" ? "Guardian Portal & Directory Hub" : "অভিভাবক পোর্টাল ও তথ্যভাণ্ডার"}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {name} • Centralized Guardian Identity, Child Linking & Secure Authentication Hub
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setOnboardError(null);
              setIsOnboardModalOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
          >
            <UserPlus size={16} />
            <span>{language === "EN" ? "Invite New Guardian" : "নতুন অভিভাবক যুক্ত ও আমন্ত্রণ"}</span>
          </button>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex border-b border-gray-200 dark:border-white/10 gap-2 text-xs font-semibold">
        <button
          onClick={() => setActiveView("accounts")}
          className={`pb-3 px-3 border-b-2 transition-all flex items-center gap-2 ${
            activeView === "accounts"
              ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          <KeyRound size={14} />
          <span>{language === "EN" ? "Portal Accounts & Family Links" : "পোর্টাল অ্যাকাউন্ট ও সন্তান সংযোগ"}</span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px]">
            {guardians.length}
          </span>
        </button>

        <button
          onClick={() => setActiveView("whatsapp")}
          className={`pb-3 px-3 border-b-2 transition-all flex items-center gap-2 ${
            activeView === "whatsapp"
              ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          <MessageSquare size={14} />
          <span>{language === "EN" ? "Quick WhatsApp Notice Hub" : "জরুরি হোয়াটসঅ্যাপ নোটিশ হাব"}</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-xl flex items-center px-3.5 py-2 shadow-sm">
          <Search className="text-gray-400 mr-2 shrink-0" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={language === "EN" ? "Search by guardian name, phone, email, or child..." : "অভিভাবকের নাম, ফোন, ইমেইল বা সন্তানের নাম দিয়ে খুঁজুন..."}
            className="w-full bg-transparent text-xs text-gray-900 dark:text-white outline-none"
          />
        </div>

        {activeView === "whatsapp" && (
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white outline-none shadow-sm"
          >
            <option value="">{language === "EN" ? "All Classes" : "সকল শ্রেণি"}</option>
            {classes.map((cls) => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>
        )}
      </div>

      {/* VIEW 1: Portal Accounts & Family Links */}
      {activeView === "accounts" && (
        <div className="border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden bg-white dark:bg-[#0f0f11] shadow-sm">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Loader2 className="animate-spin text-emerald-600" size={28} />
              <span className="text-xs text-gray-500">Loading guardian accounts...</span>
            </div>
          ) : guardians.length === 0 ? (
            <div className="py-20 text-center text-gray-400 text-xs">
              No guardians registered yet. Click &quot;Invite New Guardian&quot; to onboard.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50/75 dark:bg-black/20 border-b border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-semibold">
                    <th className="p-3.5">{language === "EN" ? "Guardian Profile" : "অভিভাবকের তথ্য"}</th>
                    <th className="p-3.5">{language === "EN" ? "Contact & WhatsApp" : "মোবাইল ও ইমেইল"}</th>
                    <th className="p-3.5">{language === "EN" ? "Linked Enrolled Children" : "সংযুক্ত শিক্ষার্থী(গণ)"}</th>
                    <th className="p-3.5">{language === "EN" ? "Portal Status" : "পোর্টাল অবস্থা"}</th>
                    <th className="p-3.5 text-right">{language === "EN" ? "Actions" : "পদক্ষেপ"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {guardians.map((g) => (
                    <tr key={g.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-gray-900 dark:text-white">
                          {g.guardian_name}
                        </div>
                        {g.profession && (
                          <div className="text-[10px] text-gray-500">
                            {g.profession}
                          </div>
                        )}
                      </td>

                      <td className="p-3.5">
                        <div className="font-mono text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                          <Phone size={12} className="text-emerald-600" />
                          <a href={`tel:${g.phone_number}`} className="hover:underline">{g.phone_number}</a>
                        </div>
                        {g.email && (
                          <div className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[180px]">
                            {g.email}
                          </div>
                        )}
                      </td>

                      <td className="p-3.5">
                        <div className="flex flex-col gap-1.5">
                          {g.linked_students && g.linked_students.length > 0 ? (
                            g.linked_students.map((child) => (
                              <div
                                key={child.student_id}
                                className="inline-flex items-center justify-between gap-2 p-1.5 px-2 bg-gray-50 dark:bg-white/[0.03] rounded-lg border border-gray-100 dark:border-white/5 text-[11px]"
                              >
                                <div>
                                  <span className="font-semibold text-gray-900 dark:text-white">
                                    {child.student_name}
                                  </span>{" "}
                                  <span className="font-mono text-gray-500 text-[10px]">
                                    ({child.admission_number})
                                  </span>
                                  <span className="text-[10px] text-blue-600 dark:text-blue-400 ml-1.5 font-sans">
                                    • {child.relationship}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleUnlinkStudent(g.id, child.student_id, child.student_name)}
                                  className="text-gray-400 hover:text-red-500 p-0.5"
                                  title="Unlink student"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))
                          ) : (
                            <span className="text-[11px] text-gray-400 italic">No students linked</span>
                          )}

                          <div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedGuardianForLink(g);
                                setLinkError(null);
                                setStudentSearch("");
                                setStudentOptions([]);
                                setIsLinkModalOpen(true);
                              }}
                              className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-semibold inline-flex items-center gap-1"
                            >
                              <LinkIcon size={10} /> + Link Another Child
                            </button>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5">
                        {g.portal_status === "ACTIVE" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                            <CheckCircle2 size={11} /> Active
                          </span>
                        ) : g.portal_status === "INVITED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                            <Clock size={11} /> Invitation Pending
                          </span>
                        ) : g.portal_status === "SUSPENDED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">
                            <Ban size={11} /> Suspended
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400">
                            Not Provisioned
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                        {(!g.portal_status || g.portal_status === "NOT_PROVISIONED") && (
                          <button
                            onClick={() => handleInviteGuardian(g)}
                            disabled={actionLoading === g.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                          >
                            {actionLoading === g.id ? <Loader2 size={12} className="animate-spin" /> : <KeyRound size={12} />}
                            {language === "EN" ? "Enable Portal" : "আমন্ত্রণ জানান"}
                          </button>
                        )}

                        {g.portal_status === "INVITED" && (
                          <>
                            <button
                              onClick={() => handleResetPassword(g)}
                              disabled={actionLoading === g.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-semibold transition-all disabled:opacity-50"
                            >
                              {actionLoading === g.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                              {language === "EN" ? "Reissue Link" : "পুনরায় লিংক"}
                            </button>
                          </>
                        )}

                        {g.portal_status === "ACTIVE" && (
                          <>
                            <button
                              onClick={() => handleResetPassword(g)}
                              disabled={actionLoading === g.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 text-xs font-semibold transition-all disabled:opacity-50"
                            >
                              <RefreshCw size={11} /> Reset
                            </button>
                            <button
                              onClick={() => handleSuspendGuardian(g)}
                              disabled={actionLoading === g.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 text-xs font-semibold transition-all disabled:opacity-50"
                            >
                              <Ban size={11} /> Suspend
                            </button>
                          </>
                        )}

                        {g.portal_status === "SUSPENDED" && (
                          <button
                            onClick={() => handleReactivateGuardian(g)}
                            disabled={actionLoading === g.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                          >
                            {actionLoading === g.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                            Reactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: Quick WhatsApp Notice Broadcast */}
      {activeView === "whatsapp" && (
        <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-sm">
          {directoryItems.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400 text-xs">
              No matching verified guardian-student links found.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/[0.05] text-[10px] font-bold uppercase text-gray-500">
                <tr>
                  <th className="p-3.5">Guardian Name</th>
                  <th className="p-3.5">Phone (WhatsApp)</th>
                  <th className="p-3.5">Relation</th>
                  <th className="p-3.5">Enrolled Student</th>
                  <th className="p-3.5">Class</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {directoryItems.map((g) => (
                  <tr key={g.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="p-3.5 font-semibold text-gray-900 dark:text-white">{g.guardian_name}</td>
                    <td className="p-3.5 font-mono text-xs text-gray-600 dark:text-gray-400">
                      <a href={`tel:${g.phone_number}`} className="hover:underline">{g.phone_number}</a>
                    </td>
                    <td className="p-3.5 text-gray-500">{g.relationship}</td>
                    <td className="p-3.5 font-medium text-gray-900 dark:text-white">
                      {g.student_name} <span className="text-[10px] text-gray-400 font-mono">({g.admission_number})</span>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                        {g.class_name}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => {
                          setSelectedGuardianForMsg(g);
                          setCustomMsg("");
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-semibold shadow-sm transition-all"
                      >
                        <MessageSquare size={13} /> WhatsApp
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal 1: Onboard New Guardian */}
      {isOnboardModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOnboardModalOpen(false);
          }}
          role="presentation"
        >
          <div
            className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {language === "EN" ? "Onboard & Invite Guardian" : "নতুন অভিভাবক নিবন্ধন ও আমন্ত্রণ"}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Registers identity, links child, and generates activation link.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOnboardModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            {onboardError && (
              <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-700 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle size={14} /> {onboardError}
              </div>
            )}

            <form onSubmit={handleOnboardSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-700 dark:text-gray-400 block mb-1">
                    First Name *
                  </label>
                  <input
                    required
                    value={onboardForm.first_name}
                    onChange={(e) => setOnboardForm({ ...onboardForm, first_name: e.target.value })}
                    placeholder="e.g. Tariqul"
                    className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-gray-700 dark:text-gray-400 block mb-1">
                    Last Name
                  </label>
                  <input
                    value={onboardForm.last_name}
                    onChange={(e) => setOnboardForm({ ...onboardForm, last_name: e.target.value })}
                    placeholder="e.g. Islam"
                    className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-400 block mb-1">
                  Mobile Number (WhatsApp Login ID) *
                </label>
                <input
                  required
                  type="tel"
                  value={onboardForm.phone_number}
                  onChange={(e) => setOnboardForm({ ...onboardForm, phone_number: e.target.value })}
                  placeholder="017XXXXXXXX"
                  className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 font-mono outline-none focus:border-emerald-500"
                />
                <span className="text-[10px] text-gray-400">Standard 11-digit Bangladeshi mobile number.</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-700 dark:text-gray-400 block mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={onboardForm.email}
                    onChange={(e) => setOnboardForm({ ...onboardForm, email: e.target.value })}
                    placeholder="parent@example.com"
                    className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-gray-700 dark:text-gray-400 block mb-1">
                    Profession
                  </label>
                  <input
                    value={onboardForm.profession}
                    onChange={(e) => setOnboardForm({ ...onboardForm, profession: e.target.value })}
                    placeholder="e.g. Business / Doctor"
                    className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Student Linking */}
              <div className="pt-2 border-t border-gray-100 dark:border-white/10 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="font-semibold text-gray-700 dark:text-gray-400 block">
                    Link Enrolled Child (Optional)
                  </label>
                  <select
                    value={onboardForm.relationship_type}
                    onChange={(e) => setOnboardForm({ ...onboardForm, relationship_type: e.target.value })}
                    className="bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1 text-xs"
                  >
                    <option value="Father">Father (বাবা)</option>
                    <option value="Mother">Mother (মা)</option>
                    <option value="Guardian">Legal Guardian (অভিভাবক)</option>
                    <option value="Brother">Brother (ভাই)</option>
                    <option value="Sister">Sister (বোন)</option>
                    <option value="Uncle">Uncle (চাচা/মামা)</option>
                  </select>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => handleSearchStudents(e.target.value)}
                    placeholder="Search child by name or admission ID..."
                    className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none focus:border-emerald-500"
                  />
                  {searchingStudents && (
                    <Loader2 size={14} className="animate-spin absolute right-3 top-3 text-gray-400" />
                  )}
                </div>

                {studentOptions.length > 0 && (
                  <div className="border border-gray-200 dark:border-white/10 rounded-xl p-2 max-h-36 overflow-y-auto space-y-1 bg-white dark:bg-[#111]">
                    {studentOptions.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => {
                          setOnboardForm({ ...onboardForm, student_id: s.id });
                          setStudentSearch(`${s.name} (${s.admission_number})`);
                          setStudentOptions([]);
                        }}
                        className={`p-2 rounded-lg cursor-pointer flex justify-between items-center transition-colors ${
                          onboardForm.student_id === s.id
                            ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 font-semibold"
                            : "hover:bg-gray-50 dark:hover:bg-white/5 text-gray-800 dark:text-gray-200"
                        }`}
                      >
                        <span>{s.name} ({s.class_name})</span>
                        <span className="font-mono text-[10px] text-gray-400">{s.admission_number}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-gray-100 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setIsOnboardModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={onboardSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {onboardSubmitting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                  <span>Save & Generate Invitation Link</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Link Additional Child */}
      {isLinkModalOpen && selectedGuardianForLink && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsLinkModalOpen(false);
          }}
          role="presentation"
        >
          <div
            className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-white/10">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Link Student to Guardian
                </h3>
                <p className="text-xs text-gray-500 font-mono">
                  {selectedGuardianForLink.guardian_name} • {selectedGuardianForLink.phone_number}
                </p>
              </div>
              <button
                onClick={() => setIsLinkModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            {linkError && (
              <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-700 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle size={14} /> {linkError}
              </div>
            )}

            <form onSubmit={handleLinkStudentSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-400 block mb-1">
                  Relationship Type
                </label>
                <select
                  value={linkForm.relationship_type}
                  onChange={(e) => setLinkForm({ ...linkForm, relationship_type: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs outline-none"
                >
                  <option value="Father">Father (বাবা)</option>
                  <option value="Mother">Mother (মা)</option>
                  <option value="Guardian">Legal Guardian (অভিভাবক)</option>
                  <option value="Brother">Brother (ভাই)</option>
                  <option value="Sister">Sister (বোন)</option>
                  <option value="Uncle">Uncle (চাচা/মামা)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-400 block mb-1">
                  Search & Select Student *
                </label>
                <input
                  type="text"
                  required
                  value={studentSearch}
                  onChange={(e) => handleSearchStudents(e.target.value)}
                  placeholder="Type student name or admission ID..."
                  className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none focus:border-emerald-500"
                />
              </div>

              {studentOptions.length > 0 && (
                <div className="border border-gray-200 dark:border-white/10 rounded-xl p-2 max-h-40 overflow-y-auto space-y-1 bg-white dark:bg-[#111]">
                  {studentOptions.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => {
                        setLinkForm({ ...linkForm, student_id: s.id });
                        setStudentSearch(`${s.name} (${s.admission_number})`);
                        setStudentOptions([]);
                      }}
                      className={`p-2 rounded-lg cursor-pointer flex justify-between items-center transition-colors ${
                        linkForm.student_id === s.id
                          ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 font-semibold"
                          : "hover:bg-gray-50 dark:hover:bg-white/5 text-gray-800 dark:text-gray-200"
                      }`}
                    >
                      <span>{s.name} ({s.class_name})</span>
                      <span className="font-mono text-[10px] text-gray-400">{s.admission_number}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-3 flex justify-end gap-2 border-t border-gray-100 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={linkSubmitting || !linkForm.student_id}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {linkSubmitting ? <Loader2 size={14} className="animate-spin" /> : <LinkIcon size={14} />}
                  <span>Authorize & Link Child</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Guardian Portal Activation Link Modal */}
      {activationModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActivationModal(null);
          }}
          role="presentation"
        >
          <div
            className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Guardian Portal Activation Link
                  </h3>
                  <p className="text-xs text-gray-500 font-mono">
                    {activationModal.guardianName} • {activationModal.phoneNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActivationModal(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              This single-use cryptographic invitation link allows the guardian to set their permanent password. It expires automatically in 72 hours.
            </p>

            {/* Link Box */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Single-Use Activation URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={typeof window !== "undefined" ? `${window.location.origin}${activationModal.activationUrl}` : activationModal.activationUrl}
                  className="flex-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-gray-800 dark:text-gray-200 select-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleCopyLink(activationModal.activationUrl)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
                    copiedLink
                      ? "bg-emerald-600 text-white"
                      : "bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/15 text-gray-800 dark:text-gray-200"
                  }`}
                >
                  {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedLink ? "Copied!" : "Copy"}</span>
                </button>
              </div>
            </div>

            {/* Quick Share Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => handleShareWhatsApp(
                  activationModal.activationUrl,
                  activationModal.guardianName,
                  activationModal.phoneNumber
                )}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <MessageSquare size={15} />
                <span>Share via WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => setActivationModal(null)}
                className="py-2.5 px-4 rounded-xl text-xs font-semibold border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Message Composer Modal (Existing broadcast tool) */}
      {selectedGuardianForMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-white/10">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <MessageSquare className="text-green-600" size={18} /> Send Message to Guardian
                </h3>
                <p className="text-xs text-gray-500">{selectedGuardianForMsg.guardian_name} • {selectedGuardianForMsg.phone_number}</p>
              </div>
              <button onClick={() => setSelectedGuardianForMsg(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            {/* Quick Templates */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block">Select Institutional Template</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "absent", label: "অনুপস্থিতি (Absence)" },
                  { id: "fee", label: "ফি বকেয়া (Fee Due)" },
                  { id: "meeting", label: "মিটিং (Meeting)" },
                  { id: "custom", label: "কাস্টম বার্তা (Custom)" }
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setMessageType(t.id as "absent" | "fee" | "meeting" | "custom")}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-left ${
                      messageType === t.id
                        ? "bg-green-50 dark:bg-green-500/10 border-green-600 text-green-700 dark:text-green-400 font-bold"
                        : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-gray-300"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message Preview */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1 block">Message Content (Editable)</label>
              {messageType === "custom" ? (
                <textarea
                  rows={4}
                  value={customMsg}
                  onChange={(e) => setCustomMsg(e.target.value)}
                  placeholder="Type your message in Bangla..."
                  className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm text-gray-900 dark:text-white outline-none focus:border-green-500 resize-none"
                />
              ) : (
                <div className="p-3 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-800 dark:text-gray-200 leading-relaxed font-sans">
                  {getTemplateText()}
                </div>
              )}
            </div>

            {/* Action */}
            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-white/10">
              <button onClick={() => setSelectedGuardianForMsg(null)} className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500">
                Cancel
              </button>
              <button
                onClick={handleOpenNoticeWhatsApp}
                className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
              >
                <Send size={14} /> Open WhatsApp Web
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
