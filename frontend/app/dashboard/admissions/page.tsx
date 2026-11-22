// frontend/app/dashboard/admissions/page.tsx
"use client";

import React, { useEffect, useState, useMemo } from "react";
import { 
  Users, UserPlus, Search, Filter, CheckCircle2, XCircle, Clock, 
  CreditCard, FileText, Printer, AlertTriangle, ArrowRight, ShieldCheck, 
  Sparkles, Calendar, BookOpen, GraduationCap, Building2, Check, RefreshCw, Eye
} from "lucide-react";
import { fetchWithTenant } from "@/lib/api-client";
import { useInstitution } from "@/lib/institution";

interface AdmissionSession {
  id: string;
  tenant_id: string;
  academic_year: string;
  session_name: string;
  admission_model: "MODEL_A" | "MODEL_B";
  status: "DRAFT" | "OPEN" | "CLOSED" | "ARCHIVED";
  start_date?: string | null;
  end_date?: string | null;
  application_fee: string | number;
  final_admission_fee: string | number;
  class_fees?: Record<string, number> | null;
  max_seats?: Record<string, number> | null;
  eligibility_criteria?: string | null;
}

interface AdmissionApplication {
  id: string;
  tenant_id: string;
  session_id?: string | null;
  admission_model: "MODEL_A" | "MODEL_B";
  application_number: string;
  status: string;
  academic_year: string;
  class_name: string;
  shift?: string | null;
  group?: string | null;
  desired_section?: string | null;
  first_name: string;
  last_name: string;
  first_name_bn?: string | null;
  last_name_bn?: string | null;
  name_bn?: string | null;
  gender: string;
  date_of_birth?: string | null;
  blood_group?: string | null;
  guardian_name: string;
  guardian_phone: string;
  guardian_relationship: string;
  guardian_email?: string | null;
  present_address?: string | null;
  application_fee: string | number;
  payment_status: string;
  final_admission_fee: string | number;
  final_fee_payment_status: string;
  admit_card_number?: string | null;
  entrance_exam_roll?: string | null;
  entrance_exam_score?: string | number | null;
  entrance_exam_details?: Record<string, any> | null;
  selection_status: string;
  rejection_reason?: string | null;
  review_notes?: string | null;
  enrolled_student_id?: string | null;
  created_at: string;
}

interface AdmissionReceipt {
  id: string;
  tenant_id: string;
  receipt_number: string;
  application_id: string;
  student_id?: string | null;
  amount_paid: string | number;
  currency: string;
  payment_method: string;
  transaction_reference: string;
  fee_category: string;
  receipt_payload: Record<string, any>;
  issued_at: string;
}

export default function AdmissionsCenterPage() {
  const { name: institutionName, address: institutionAddress, phone: institutionPhone } = useInstitution();
  
  // Role & Authentication
  const [userRole, setUserRole] = useState<string>("admin");
  const [activeTab, setActiveTab] = useState<"applications" | "exams" | "payments" | "sessions" | "receipts">("applications");
  
  // Data State
  const [sessions, setSessions] = useState<AdmissionSession[]>([]);
  const [applications, setApplications] = useState<AdmissionApplication[]>([]);
  const [receipts, setReceipts] = useState<AdmissionReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [classFilter, setClassFilter] = useState<string>("ALL");
  const [sessionFilter, setSessionFilter] = useState<string>("ALL");

  // Modals & Active Selections
  const [selectedApp, setSelectedApp] = useState<AdmissionApplication | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<AdmissionReceipt | null>(null);

  // Form States
  const [scoreInput, setScoreInput] = useState("");
  const [scoreNotes, setScoreNotes] = useState("");
  const [verifyCategory, setVerifyCategory] = useState<"APPLICATION_FEE" | "FINAL_ADMISSION_FEE">("APPLICATION_FEE");
  const [verifyMethod, setVerifyMethod] = useState("Cash Counter");
  const [verifyRef, setVerifyRef] = useState("");
  const [enrollSection, setEnrollSection] = useState("A");
  const [enrollRoll, setEnrollRoll] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // New Session Form State
  const [newSessionName, setNewSessionName] = useState("");
  const [newSessionModel, setNewSessionModel] = useState<"MODEL_A" | "MODEL_B">("MODEL_B");
  const [newSessionAppFee, setNewSessionAppFee] = useState("0");
  const [newSessionFinalFee, setNewSessionFinalFee] = useState("0");
  const [newSessionYear, setNewSessionYear] = useState("2026");

  useEffect(() => {
    const role = (localStorage.getItem("user_role") || "admin").toLowerCase();
    setUserRole(role);
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setActionError(null);
    try {
      const currentRole = (localStorage.getItem("user_role") || userRole || "").toLowerCase();
      const isAdminOrSuper = currentRole === "admin" || currentRole === "superadmin";

      const [sessRes, appRes, rcpRes] = await Promise.all([
        fetchWithTenant("/api/v1/admissions/sessions"),
        fetchWithTenant("/api/v1/admissions"),
        isAdminOrSuper ? fetchWithTenant("/api/v1/admissions/receipts/all") : Promise.resolve(null),
      ]);

      if (sessRes && sessRes.ok) {
        const sessData = await sessRes.json();
        setSessions(sessData);
      }
      if (appRes && appRes.ok) {
        const appData = await appRes.json();
        setApplications(appData);
      }
      if (rcpRes && rcpRes.ok) {
        const rcpData = await rcpRes.json();
        setReceipts(rcpData);
      } else if (!isAdminOrSuper) {
        setReceipts([]);
      }
    } catch (err: any) {
      console.warn("Admission data fetch error:", err);
      setActionError(err.message || "Failed to load admission data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadAllData();
  };

  // Filtered Applications
  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const matchesSearch =
        !searchQuery ||
        app.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.application_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.guardian_phone.includes(searchQuery);

      const matchesStatus = statusFilter === "ALL" || app.status === statusFilter;
      const matchesClass = classFilter === "ALL" || app.class_name === classFilter;
      const matchesSession = sessionFilter === "ALL" || app.session_id === sessionFilter;

      return matchesSearch && matchesStatus && matchesClass && matchesSession;
    });
  }, [applications, searchQuery, statusFilter, classFilter, sessionFilter]);

  // Statistics Computations
  const stats = useMemo(() => {
    const total = applications.length;
    const pendingReview = applications.filter((a) => a.status === "SUBMITTED" || a.status === "UNDER_REVIEW").length;
    const examScheduled = applications.filter((a) => a.status === "EXAM_SCHEDULED" || a.status === "EXAM_EVALUATED").length;
    const selected = applications.filter((a) => a.status === "SELECTED" || a.status === "APPROVED").length;
    const enrolled = applications.filter((a) => a.status === "ENROLLED").length;
    const totalRevenue = receipts.reduce((sum, r) => sum + Number(r.amount_paid || 0), 0);

    return { total, pendingReview, examScheduled, selected, enrolled, totalRevenue };
  }, [applications, receipts]);

  // Handler: Review Application
  const handleReview = async (appId: string) => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetchWithTenant(`/api/v1/admissions/${appId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Reviewed by admission officer" }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to mark application under review.");
      }
      setActionSuccess("Application marked UNDER REVIEW.");
      loadAllData();
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Schedule Exam (Model A)
  const handleScheduleExam = async (app: AdmissionApplication) => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetchWithTenant(`/api/v1/admissions/${app.id}/schedule-exam`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venue: "Main Campus Auditorium",
          exam_date: new Date(Date.now() + 7 * 86400000).toISOString(),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to schedule entrance exam.");
      }
      setActionSuccess(`Entrance exam scheduled. Admit Card issued.`);
      loadAllData();
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Submit Score (Teacher/Admin)
  const handleSubmitScore = async () => {
    if (!selectedApp) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const scoreNum = parseFloat(scoreInput);
      if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) {
        throw new Error("Score must be a valid number between 0 and 100.");
      }
      const res = await fetchWithTenant(`/api/v1/admissions/${selectedApp.id}/exam-score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: scoreNum,
          notes: scoreNotes,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to record exam score.");
      }
      setActionSuccess(`Exam score of ${scoreNum} recorded successfully.`);
      setIsScoreModalOpen(false);
      setScoreInput("");
      setScoreNotes("");
      loadAllData();
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Select Candidate (Model A)
  const handleSelectCandidate = async (appId: string, selectionStatus: "SELECTED" | "WAITLISTED" | "NOT_SELECTED") => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetchWithTenant(`/api/v1/admissions/${appId}/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selection_status: selectionStatus }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to update candidate selection status.");
      }
      setActionSuccess(`Candidate status updated to ${selectionStatus}.`);
      loadAllData();
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Verify Payment (Cashier/Admin)
  const handleVerifyPayment = async () => {
    if (!selectedApp) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetchWithTenant(`/api/v1/admissions/${selectedApp.id}/payments/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fee_category: verifyCategory,
          payment_method: verifyMethod,
          transaction_reference: verifyRef || `TXN-${Date.now().toString().slice(-6)}`,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to verify payment.");
      }
      const receiptData = await res.json();
      setActiveReceipt(receiptData);
      setIsVerifyModalOpen(false);
      setIsReceiptModalOpen(true);
      setActionSuccess(`Payment verified! Anti-fraud receipt ${receiptData.receipt_number} issued.`);
      loadAllData();
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Enroll Student (Idempotent)
  const handleEnrollStudent = async () => {
    if (!selectedApp) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetchWithTenant(`/api/v1/admissions/${selectedApp.id}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: enrollSection || "A",
          roll_number: enrollRoll || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Enrollment failed.");
      }
      setActionSuccess(`Student officially enrolled into ${selectedApp.class_name} Section ${enrollSection}!`);
      setIsEnrollModalOpen(false);
      loadAllData();
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Create Intake Session
  const handleCreateSession = async () => {
    if (!newSessionName.trim()) {
      setActionError("Session name is required.");
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetchWithTenant("/api/v1/admissions/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academic_year: newSessionYear,
          session_name: newSessionName,
          admission_model: newSessionModel,
          application_fee: parseFloat(newSessionAppFee) || 0,
          final_admission_fee: parseFloat(newSessionFinalFee) || 0,
          status: "OPEN",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to create session.");
      }
      setActionSuccess(`Intake session '${newSessionName}' opened successfully.`);
      setIsSessionModalOpen(false);
      setNewSessionName("");
      loadAllData();
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: View Receipt
  const handleViewReceipt = async (appId: string) => {
    try {
      const res = await fetchWithTenant(`/api/v1/admissions/${appId}/receipt`);
      if (res.ok) {
        const data = await res.json();
        setActiveReceipt(data);
        setIsReceiptModalOpen(true);
      } else {
        throw new Error("No official receipt found for this application.");
      }
    } catch (e: any) {
      setActionError(e.message);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <UserPlus className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Institutional Admission Center
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {institutionName ? `${institutionName} · ` : ""}
            Model A (Entrance Examination) & Model B (Direct Admission) Lifecycle Management
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {userRole === "admin" && (
            <button
              onClick={() => setIsSessionModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
            >
              <Calendar className="w-4 h-4" />
              Configure Intake Session
            </button>
          )}
        </div>
      </div>

      {/* Teacher Role Scoped Banner */}
      {userRole === "teacher" && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-4 rounded-xl flex items-center gap-3 text-amber-900 dark:text-amber-200 text-sm">
          <ShieldCheck className="w-5 h-5 flex-shrink-0 text-amber-600" />
          <div>
            <span className="font-semibold">Teacher Evaluation Scoping Active:</span> You have view and marks-evaluation access restricted to applications in your assigned class. Financial verification and student enrollment are reserved for administration.
          </div>
        </div>
      )}

      {/* Action Alerts */}
      {actionError && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 p-4 rounded-xl flex items-center justify-between text-rose-900 dark:text-rose-200 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-700 font-bold ml-4">✕</button>
        </div>
      )}
      {actionSuccess && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-4 rounded-xl flex items-center justify-between text-emerald-900 dark:text-emerald-200 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-700 font-bold ml-4">✕</button>
        </div>
      )}

      {/* 2. Interactive KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Applicants</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.total}</p>
        </div>
        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Pending Review</p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">{stats.pendingReview}</p>
        </div>
        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Entrance Exams</p>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">{stats.examScheduled}</p>
        </div>
        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-xs font-medium text-purple-600 dark:text-purple-400">Selected / Approved</p>
          <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 mt-1">{stats.selected}</p>
        </div>
        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Official Enrolled</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{stats.enrolled}</p>
        </div>
        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Revenue (BDT)</p>
          <p className="text-xl font-bold text-indigo-700 dark:text-indigo-300 mt-1">৳{stats.totalRevenue.toLocaleString()}</p>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-800 flex gap-4 text-sm font-medium">
        <button
          onClick={() => setActiveTab("applications")}
          className={`pb-3 px-1 border-b-2 transition ${
            activeTab === "applications"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          All Applications ({filteredApplications.length})
        </button>
        <button
          onClick={() => setActiveTab("exams")}
          className={`pb-3 px-1 border-b-2 transition ${
            activeTab === "exams"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          Model A: Exams & Selection ({stats.examScheduled})
        </button>
        <button
          onClick={() => setActiveTab("payments")}
          className={`pb-3 px-1 border-b-2 transition ${
            activeTab === "payments"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          Counter Payment Verification
        </button>
        <button
          onClick={() => setActiveTab("receipts")}
          className={`pb-3 px-1 border-b-2 transition ${
            activeTab === "receipts"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          Receipts Ledger ({receipts.length})
        </button>
        {userRole === "admin" && (
          <button
            onClick={() => setActiveTab("sessions")}
            className={`pb-3 px-1 border-b-2 transition ${
              activeTab === "sessions"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            Intake Cycles ({sessions.length})
          </button>
        )}
      </div>

      {/* 4. Tab 1: Applications Queue */}
      {activeTab === "applications" && (
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by student name, application number, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="EXAM_SCHEDULED">Exam Scheduled</option>
              <option value="EXAM_EVALUATED">Exam Evaluated</option>
              <option value="SELECTED">Selected</option>
              <option value="APPROVED">Approved</option>
              <option value="ENROLLED">Enrolled</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Applications Table */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="py-3 px-4">Application #</th>
                    <th className="py-3 px-4">Candidate Name</th>
                    <th className="py-3 px-4">Class</th>
                    <th className="py-3 px-4">Model</th>
                    <th className="py-3 px-4">Guardian Contact</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredApplications.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-gray-400">
                        No admission applications found matching current criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredApplications.map((app) => (
                      <tr key={app.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition">
                        <td className="py-3 px-4 font-mono font-medium text-gray-900 dark:text-white">
                          {app.application_number}
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                          {app.first_name} {app.last_name}
                          {app.admit_card_number && (
                            <span className="block text-xs font-mono text-indigo-600 dark:text-indigo-400">
                              Admit: {app.admit_card_number}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">{app.class_name}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            app.admission_model === "MODEL_A"
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                          }`}>
                            {app.admission_model === "MODEL_A" ? "Model A (Exam)" : "Model B (Direct)"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div>{app.guardian_name}</div>
                          <div className="text-xs text-gray-400">{app.guardian_phone}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            app.status === "ENROLLED"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : app.status === "APPROVED" || app.status === "SELECTED"
                              ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                              : app.status === "REJECTED"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          }`}>
                            {app.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium ${
                              app.payment_status === "PAID"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}>
                              App: {app.payment_status} (৳{Number(app.application_fee)})
                            </span>
                            {Number(app.final_admission_fee) > 0 && (
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium ${
                                app.final_fee_payment_status === "PAID"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}>
                                Fin: {app.final_fee_payment_status} (৳{Number(app.final_admission_fee)})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1">
                          <button
                            onClick={() => {
                              setSelectedApp(app);
                              setIsViewModalOpen(true);
                            }}
                            className="p-1.5 text-gray-500 hover:text-indigo-600 rounded transition"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Quick Admin Actions */}
                          {userRole === "admin" && app.status === "SUBMITTED" && (
                            <button
                              onClick={() => handleReview(app.id)}
                              className="px-2 py-1 text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-200"
                            >
                              Review
                            </button>
                          )}

                          {userRole === "admin" && app.admission_model === "MODEL_A" && app.status === "UNDER_REVIEW" && (
                            <button
                              onClick={() => handleScheduleExam(app)}
                              className="px-2 py-1 text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 rounded"
                            >
                              Schedule Exam
                            </button>
                          )}

                          {/* Teacher or Admin Score Entry */}
                          {(userRole === "admin" || userRole === "teacher") && 
                           app.admission_model === "MODEL_A" && 
                           (app.status === "EXAM_SCHEDULED" || app.status === "EXAM_EVALUATED") && (
                            <button
                              onClick={() => {
                                setSelectedApp(app);
                                setScoreInput(app.entrance_exam_score ? String(app.entrance_exam_score) : "");
                                setIsScoreModalOpen(true);
                              }}
                              className="px-2 py-1 text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded"
                            >
                              Grade Exam
                            </button>
                          )}

                          {/* Payment Verification Button */}
                          {userRole === "admin" && (app.payment_status !== "PAID" || (Number(app.final_admission_fee) > 0 && app.final_fee_payment_status !== "PAID")) && (
                            <button
                              onClick={() => {
                                setSelectedApp(app);
                                setVerifyCategory(app.payment_status !== "PAID" ? "APPLICATION_FEE" : "FINAL_ADMISSION_FEE");
                                setIsVerifyModalOpen(true);
                              }}
                              className="px-2 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 rounded"
                            >
                              Verify Pay
                            </button>
                          )}

                          {/* Enrollment Button */}
                          {userRole === "admin" && app.status === "APPROVED" && (
                            <button
                              onClick={() => {
                                setSelectedApp(app);
                                setIsEnrollModalOpen(true);
                              }}
                              className="px-2 py-1 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700"
                            >
                              Enroll
                            </button>
                          )}

                          {/* View Receipt */}
                          {(app.payment_status === "PAID" || app.final_fee_payment_status === "PAID") && (
                            <button
                              onClick={() => handleViewReceipt(app.id)}
                              className="p-1.5 text-gray-500 hover:text-emerald-600 rounded transition"
                              title="Print / View Receipt"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. Tab 2: Model A Entrance Exams & Scoring */}
      {activeTab === "exams" && (
        <div className="space-y-4">
          <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 p-4 rounded-xl text-sm text-indigo-900 dark:text-indigo-200">
            <h3 className="font-semibold text-base mb-1">Model A Examination & Selection Desk</h3>
            <p className="text-xs text-indigo-700 dark:text-indigo-300">
              Assigned educators evaluate candidates, enter entrance examination marks, and administrators make formal selection decisions.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase font-semibold text-gray-500">
                  <tr>
                    <th className="py-3 px-4">Admit Card</th>
                    <th className="py-3 px-4">Candidate</th>
                    <th className="py-3 px-4">Class</th>
                    <th className="py-3 px-4">Roll</th>
                    <th className="py-3 px-4">Score</th>
                    <th className="py-3 px-4">Selection State</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {applications
                    .filter((a) => a.admission_model === "MODEL_A" && a.admit_card_number)
                    .map((app) => (
                      <tr key={app.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50">
                        <td className="py-3 px-4 font-mono font-medium text-indigo-600 dark:text-indigo-400">
                          {app.admit_card_number}
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                          {app.first_name} {app.last_name}
                        </td>
                        <td className="py-3 px-4">{app.class_name}</td>
                        <td className="py-3 px-4 font-mono">{app.entrance_exam_roll || "—"}</td>
                        <td className="py-3 px-4 font-semibold">
                          {app.entrance_exam_score !== null && app.entrance_exam_score !== undefined
                            ? `${app.entrance_exam_score} / 100`
                            : "Not Evaluated"}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            app.selection_status === "SELECTED"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : app.selection_status === "WAITLISTED"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                          }`}>
                            {app.selection_status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button
                            onClick={() => {
                              setSelectedApp(app);
                              setScoreInput(app.entrance_exam_score ? String(app.entrance_exam_score) : "");
                              setIsScoreModalOpen(true);
                            }}
                            className="px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded"
                          >
                            Enter Marks
                          </button>
                          {userRole === "admin" && (
                            <>
                              <button
                                onClick={() => handleSelectCandidate(app.id, "SELECTED")}
                                className="px-2.5 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 rounded"
                              >
                                Select
                              </button>
                              <button
                                onClick={() => handleSelectCandidate(app.id, "WAITLISTED")}
                                className="px-2.5 py-1 text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 rounded"
                              >
                                Waitlist
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. Tab 3: Counter Payment Verification */}
      {activeTab === "payments" && (
        <div className="space-y-4">
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-4 rounded-xl text-sm text-emerald-900 dark:text-emerald-200">
            <h3 className="font-semibold text-base mb-1">Cash Desk & Mobile Payment Verification</h3>
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              Formally verify counter cash deposits, bank transfers, or bKash/Nagad transactions with anti-fraud unique sequential receipts.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase font-semibold text-gray-500">
                  <tr>
                    <th className="py-3 px-4">Application #</th>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Class</th>
                    <th className="py-3 px-4">Pending Fee Category</th>
                    <th className="py-3 px-4">Payable Amount</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {applications
                    .filter((a) => a.payment_status !== "PAID" || (Number(a.final_admission_fee) > 0 && a.final_fee_payment_status !== "PAID"))
                    .map((app) => (
                      <tr key={app.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50">
                        <td className="py-3 px-4 font-mono font-medium">{app.application_number}</td>
                        <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                          {app.first_name} {app.last_name}
                        </td>
                        <td className="py-3 px-4">{app.class_name}</td>
                        <td className="py-3 px-4">
                          {app.payment_status !== "PAID" ? (
                            <span className="text-amber-600 font-semibold">Application Fee</span>
                          ) : (
                            <span className="text-purple-600 font-semibold">Final Admission Fee</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold">
                          ৳{app.payment_status !== "PAID" ? Number(app.application_fee) : Number(app.final_admission_fee)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedApp(app);
                              setVerifyCategory(app.payment_status !== "PAID" ? "APPLICATION_FEE" : "FINAL_ADMISSION_FEE");
                              setIsVerifyModalOpen(true);
                            }}
                            className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                          >
                            Verify & Issue Receipt
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 7. Tab 4: Receipts Ledger */}
      {activeTab === "receipts" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase font-semibold text-gray-500">
                  <tr>
                    <th className="py-3 px-4">Receipt #</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4">Txn Ref</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Print</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {receipts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-gray-400">
                        No receipts issued yet.
                      </td>
                    </tr>
                  ) : (
                    receipts.map((rcp) => (
                      <tr key={rcp.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50">
                        <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {rcp.receipt_number}
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                          {rcp.receipt_payload?.student_name || "Applicant"}
                        </td>
                        <td className="py-3 px-4 text-xs font-semibold text-gray-600">
                          {rcp.fee_category}
                        </td>
                        <td className="py-3 px-4">{rcp.payment_method}</td>
                        <td className="py-3 px-4 font-mono text-xs">{rcp.transaction_reference}</td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-600">
                          ৳{Number(rcp.amount_paid).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-400">
                          {new Date(rcp.issued_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              setActiveReceipt(rcp);
                              setIsReceiptModalOpen(true);
                            }}
                            className="p-1.5 text-gray-500 hover:text-indigo-600 rounded"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 8. Tab 5: Intake Cycles (Admin Only) */}
      {activeTab === "sessions" && userRole === "admin" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((sess) => (
              <div
                key={sess.id}
                className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">{sess.session_name}</h3>
                    <p className="text-xs text-gray-400">Academic Year: {sess.academic_year}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    sess.status === "OPEN"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-gray-100 text-gray-800"
                  }`}>
                    {sess.status}
                  </span>
                </div>

                <div className="text-xs space-y-1 text-gray-600 dark:text-gray-300">
                  <div><span className="font-semibold">Model:</span> {sess.admission_model === "MODEL_A" ? "Entrance Exam (Model A)" : "Direct Admission (Model B)"}</div>
                  <div><span className="font-semibold">Application Fee:</span> ৳{Number(sess.application_fee)}</div>
                  <div><span className="font-semibold">Final Admission Fee:</span> ৳{Number(sess.final_admission_fee)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: View Application Details */}
      {/* ========================================================================= */}
      {isViewModalOpen && selectedApp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Application {selectedApp.application_number}
              </h2>
              <button onClick={() => setIsViewModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-400">Candidate Name</p>
                <p className="font-semibold text-gray-900 dark:text-white">{selectedApp.first_name} {selectedApp.last_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Target Class</p>
                <p className="font-semibold text-gray-900 dark:text-white">{selectedApp.class_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Admission Model</p>
                <p className="font-semibold text-gray-900 dark:text-white">{selectedApp.admission_model}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Status</p>
                <p className="font-semibold text-indigo-600">{selectedApp.status}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Guardian Name</p>
                <p className="font-semibold text-gray-900 dark:text-white">{selectedApp.guardian_name} ({selectedApp.guardian_relationship})</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Guardian Phone</p>
                <p className="font-semibold text-gray-900 dark:text-white">{selectedApp.guardian_phone}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Application Fee</p>
                <p className="font-semibold text-gray-900 dark:text-white">৳{Number(selectedApp.application_fee)} ({selectedApp.payment_status})</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Final Admission Fee</p>
                <p className="font-semibold text-gray-900 dark:text-white">৳{Number(selectedApp.final_admission_fee)} ({selectedApp.final_fee_payment_status})</p>
              </div>
              {selectedApp.admit_card_number && (
                <div>
                  <p className="text-xs text-gray-400">Admit Card Number</p>
                  <p className="font-mono font-bold text-indigo-600">{selectedApp.admit_card_number}</p>
                </div>
              )}
              {selectedApp.entrance_exam_score !== null && (
                <div>
                  <p className="text-xs text-gray-400">Entrance Exam Score</p>
                  <p className="font-bold text-emerald-600">{selectedApp.entrance_exam_score} / 100</p>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex justify-end">
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: Enter Exam Score */}
      {/* ========================================================================= */}
      {isScoreModalOpen && selectedApp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Grade Entrance Exam · {selectedApp.first_name} {selectedApp.last_name}
            </h2>
            <p className="text-xs text-gray-400">Class: {selectedApp.class_name} | Admit Card: {selectedApp.admit_card_number || "N/A"}</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Total Score (Out of 100) *
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={scoreInput}
                  onChange={(e) => setScoreInput(e.target.value)}
                  placeholder="e.g. 85.5"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Evaluator Observations / Notes
                </label>
                <textarea
                  rows={2}
                  value={scoreNotes}
                  onChange={(e) => setScoreNotes(e.target.value)}
                  placeholder="Reading fluency, numeracy confidence, etc."
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsScoreModalOpen(false)}
                className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitScore}
                disabled={actionLoading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm"
              >
                {actionLoading ? "Saving..." : "Submit Score"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: Verify Payment & Issue Receipt */}
      {/* ========================================================================= */}
      {isVerifyModalOpen && selectedApp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Verify Payment & Issue Anti-Fraud Receipt
            </h2>
            <p className="text-xs text-gray-400">
              Candidate: {selectedApp.first_name} {selectedApp.last_name} ({selectedApp.application_number})
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Fee Category
                </label>
                <select
                  value={verifyCategory}
                  onChange={(e: any) => setVerifyCategory(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm font-medium"
                >
                  <option value="APPLICATION_FEE">Application Fee (৳{Number(selectedApp.application_fee)})</option>
                  <option value="FINAL_ADMISSION_FEE">Final Admission Fee (৳{Number(selectedApp.final_admission_fee)})</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Payment Method
                </label>
                <select
                  value={verifyMethod}
                  onChange={(e) => setVerifyMethod(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                >
                  <option value="Cash Counter">Cash Counter</option>
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Transaction Reference / Cash Slip ID
                </label>
                <input
                  type="text"
                  value={verifyRef}
                  onChange={(e) => setVerifyRef(e.target.value)}
                  placeholder="e.g. SLIP-2026-001 or bKash TrxID"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsVerifyModalOpen(false)}
                className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyPayment}
                disabled={actionLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-sm"
              >
                {actionLoading ? "Verifying..." : "Verify & Issue Receipt"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: Official Enrollment */}
      {/* ========================================================================= */}
      {isEnrollModalOpen && selectedApp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Official Student Enrollment
            </h2>
            <p className="text-xs text-gray-400">
              Candidate: {selectedApp.first_name} {selectedApp.last_name} · Admitting to {selectedApp.class_name}
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Assigned Section *
                </label>
                <input
                  type="text"
                  value={enrollSection}
                  onChange={(e) => setEnrollSection(e.target.value)}
                  placeholder="e.g. A, Morning Glory, Rose"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Roll Number
                </label>
                <input
                  type="text"
                  value={enrollRoll}
                  onChange={(e) => setEnrollRoll(e.target.value)}
                  placeholder="e.g. 101"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                />
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/40 p-3 rounded-lg text-xs text-blue-800 dark:text-blue-300">
              Enrollment will provision permanent Student, Guardian, and Academic Enrollment History records, and issue activation credentials.
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsEnrollModalOpen(false)}
                className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleEnrollStudent}
                disabled={actionLoading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm"
              >
                {actionLoading ? "Enrolling..." : "Confirm Enrollment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: Configure Intake Session */}
      {/* ========================================================================= */}
      {isSessionModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Create New Admission Intake Cycle
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Session Name *
                </label>
                <input
                  type="text"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  placeholder="e.g. Spring 2026 Primary Intake"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Admission Model *
                </label>
                <select
                  value={newSessionModel}
                  onChange={(e: any) => setNewSessionModel(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm font-medium"
                >
                  <option value="MODEL_B">Model B: Direct Admission (Review → Approval → Enroll)</option>
                  <option value="MODEL_A">Model A: Entrance Exam (Admit Card → Exam → Select → Enroll)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Application Fee (৳)
                  </label>
                  <input
                    type="number"
                    value={newSessionAppFee}
                    onChange={(e) => setNewSessionAppFee(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Final Admission Fee (৳)
                  </label>
                  <input
                    type="number"
                    value={newSessionFinalFee}
                    onChange={(e) => setNewSessionFinalFee(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsSessionModalOpen(false)}
                className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSession}
                disabled={actionLoading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm"
              >
                {actionLoading ? "Creating..." : "Save Session"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: Official Anti-Fraud Receipt Print View */}
      {/* ========================================================================= */}
      {isReceiptModalOpen && activeReceipt && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full p-6 space-y-4 border border-gray-200 dark:border-gray-700 shadow-2xl">
            {/* Header / Watermark */}
            <div className="text-center border-b border-gray-200 dark:border-gray-800 pb-4 relative">
              <div className="text-xs uppercase tracking-wider font-bold text-indigo-600 dark:text-indigo-400">
                Official Institutional Counter Receipt
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                {institutionName || "EducationOS Institution"}
              </h2>
              {institutionAddress && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{institutionAddress}</p>
              )}
              {institutionPhone && (
                <p className="text-xs text-gray-400">Helpline: {institutionPhone}</p>
              )}

              <div className="mt-3 inline-block bg-emerald-50 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-full text-xs font-mono font-bold tracking-wider">
                RECEIPT NO: {activeReceipt.receipt_number}
              </div>
            </div>

            {/* Receipt Body */}
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1 border-b border-dashed border-gray-200 dark:border-gray-800">
                <span className="text-gray-500">Student Name:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {activeReceipt.receipt_payload?.student_name || "Applicant"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-dashed border-gray-200 dark:border-gray-800">
                <span className="text-gray-500">Class:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {activeReceipt.receipt_payload?.class_name || "N/A"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-dashed border-gray-200 dark:border-gray-800">
                <span className="text-gray-500">Fee Category:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {activeReceipt.fee_category}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-dashed border-gray-200 dark:border-gray-800">
                <span className="text-gray-500">Payment Channel:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {activeReceipt.payment_method}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-dashed border-gray-200 dark:border-gray-800">
                <span className="text-gray-500">Transaction Ref:</span>
                <span className="font-mono text-xs font-bold text-gray-700 dark:text-gray-300">
                  {activeReceipt.transaction_reference}
                </span>
              </div>
              <div className="flex justify-between py-2 bg-gray-50 dark:bg-gray-800 px-3 rounded-lg font-bold text-base">
                <span>Amount Paid:</span>
                <span className="text-emerald-600 font-mono">
                  ৳{Number(activeReceipt.amount_paid).toLocaleString()} {activeReceipt.currency}
                </span>
              </div>
              <div className="text-[11px] text-gray-400 text-center pt-2">
                Issued At: {new Date(activeReceipt.issued_at).toLocaleString()} · Cryptographically Verified & Immutable
              </div>
            </div>

            {/* Actions */}
            <div className="border-t border-gray-200 dark:border-gray-800 pt-4 flex justify-between">
              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-semibold"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="w-4 h-4" />
                Print Official Slip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

