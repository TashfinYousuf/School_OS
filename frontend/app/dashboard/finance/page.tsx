"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/providers";
import { 
  Wallet, Receipt, Plus, Search, Printer, 
  Save, Loader2, CheckCircle2, X, ShieldAlert,
  Banknote, Building2, Smartphone, Calendar, FileText,
  User, ArrowRight, Clock
} from "lucide-react";
import { useInstitution } from "@/lib/institution";
import { fetchWithTenant } from "@/lib/api-client";
import { SearchableSelect, type SearchableOption } from "@/components/ui/SearchableSelect";
import ResponsiveDialog from "@/components/ui/ResponsiveDialog";

interface MonthlyReportData {
  year: number;
  month: number;
  month_name: string;
  total_collected: number;
  total_transactions: number;
  currency: string;
  breakdown_by_category: Array<{ category: string; amount: number; count: number }>;
  breakdown_by_method: Array<{ method: string; amount: number; count: number }>;
  itemized_transactions: Array<{
    receipt_no: string;
    transaction_id: string;
    student_id?: string;
    student_name: string;
    admission_number: string;
    class_name: string;
    fee_type: string;
    amount: number;
    payment_method: string;
    date: string;
  }>;
  institution: {
    name: string;
    address: string;
    phone: string;
    logo_url?: string;
  };
  generated_at: string;
}

interface StudentFeeHistoryData {
  student: {
    id: string;
    first_name: string;
    last_name: string;
    admission_number: string;
    class_name?: string;
    roll_number?: string;
    shift?: string;
    section?: string;
  };
  total_paid: number;
  total_due: number;
  currency: string;
  payment_history: Array<{
    id: string;
    receipt_no: string;
    transaction_id: string;
    fee_type: string;
    amount: number;
    payment_method: string;
    payment_status: string;
    date: string;
  }>;
  invoices: Array<{
    id: string;
    invoice_number: string;
    title: string;
    total_amount: number;
    paid_amount: number;
    due_amount: number;
    due_date?: string;
    status: string;
  }>;
}

interface PaymentItem {
  id: string;
  student_id?: string;
  receipt_no: string;
  student_name: string;
  admission_number: string;
  class_name: string;
  fee_type: string;
  billing_month: string;
  amount_paid: number;
  currency: string;
  payment_method: string;
  transaction_id: string;
  sender_number_or_wallet: string;
  payment_date: string;
}

interface StudentOption {
  id: string;
  first_name: string;
  last_name: string;
  name_bn?: string;
  admission_number: string;
  class_name?: string;
  section?: string;
  roll_number?: string;
  outstanding_balance?: number;
}

interface FinanceReceiptPreview {
  receipt_no: string;
  transaction_id: string;
  school_name: string;
  school_address: string;
  school_phone: string;
  student_name: string;
  admission_number: string;
  class_name: string;
  roll_number?: string;
  fee_type: string;
  billing_month: string;
  amount_paid: number;
  currency: string;
  payment_method: string;
  sender_ref: string;
  date: string;
}

interface PortalFeePayment {
  id: string;
  receipt_no: string;
  student_name: string;
  fee_type: string;
  billing_month: string;
  amount_paid: number;
  payment_method: string;
  transaction_id: string;
  payment_date: string;
}

interface PortalChildOption {
  id: string;
  student_name: string;
  admission_number: string;
  class_name?: string;
  roll_number?: string;
}

interface PortalFeePayload {
  student: {
    id: string;
    first_name: string;
    last_name: string;
    admission_number: string;
    class_name?: string;
  };
  total_paid: number;
  total_due: number;
  currency: string;
  invoices?: Array<{ id: string; invoice_number: string; title: string; amount: number; status: string }>;
  payments?: PortalFeePayment[];
}

export default function FeeLedgerPage() {
  const { language } = useLanguage();
  const { name, address, phone } = useInstitution();
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);

  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [summary, setSummary] = useState<{
    collected_today: number;
    today_collection?: number;
    transactions_today: number;
    total_revenue: number;
    current_month_label: number | string;
    this_month_collection: number;
    month_collection?: number;
  }>({ collected_today: 0, transactions_today: 0, total_revenue: 0, current_month_label: 0, this_month_collection: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [studentSearchResults, setStudentSearchResults] = useState<StudentOption[]>([]);
  const [studentSearchLoading, setStudentSearchLoading] = useState(false);
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<StudentOption | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Fiat Form State (Standard English Default)
  const [formData, setFormData] = useState({
    fee_type: "Monthly Tuition Fee",
    billing_month: "September 2026",
    amount_paid: 1500,
    currency: "BDT",
    discount: 0,
    payment_method: "CASH",
    transaction_id: "",
    sender_number_or_wallet: "",
    remarks: ""
  });

  const [receiptToPrint, setReceiptToPrint] = useState<FinanceReceiptPreview | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalChildren, setPortalChildren] = useState<PortalChildOption[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [portalFeeData, setPortalFeeData] = useState<PortalFeePayload | null>(null);

  // Role check: allow finance staff full ledger; render read-only portal view for guardian/student
  useEffect(() => {
    const role = (localStorage.getItem("user_role") || "").toLowerCase();
    queueMicrotask(() => setUserRole(role));
    const allowed = ["admin", "superadmin", "finance_officer", "accountant", "guardian", "student"];
    if (role && !allowed.includes(role)) {
      router.replace("/dashboard");
    }
  }, [router]);

  const [activeTab, setActiveTab] = useState<"ledger" | "monthly_report">("ledger");
  const [reportYear, setReportYear] = useState<number>(2026);
  const [reportMonth, setReportMonth] = useState<number>(new Date().getMonth() + 1);
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReportData | null>(null);
  const [loadingMonthlyReport, setLoadingMonthlyReport] = useState(false);

  const [studentHistoryModalId, setStudentHistoryModalId] = useState<string | null>(null);
  const [studentHistoryData, setStudentHistoryData] = useState<StudentFeeHistoryData | null>(null);
  const [loadingStudentHistory, setLoadingStudentHistory] = useState(false);
  const [studentStatementToPrint, setStudentStatementToPrint] = useState<StudentFeeHistoryData | null>(null);

  const fetchMonthlyReport = async (yr: number, mo: number) => {
    setLoadingMonthlyReport(true);
    try {
      const res = await fetchWithTenant(`/api/v1/finance/reports/monthly?year=${yr}&month=${mo}`);
      if (res.ok) {
        setMonthlyReport(await res.json());
      }
    } finally {
      setLoadingMonthlyReport(false);
    }
  };

  const fetchStudentHistory = async (studentId: string) => {
    if (!studentId) return;
    setStudentHistoryModalId(studentId);
    setLoadingStudentHistory(true);
    try {
      const res = await fetchWithTenant(`/api/v1/finance/students/${studentId}/history`);
      if (res.ok) {
        setStudentHistoryData(await res.json());
      }
    } finally {
      setLoadingStudentHistory(false);
    }
  };

  // Global Escape key listener for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (studentStatementToPrint) {
          setStudentStatementToPrint(null);
        } else if (studentHistoryModalId) {
          setStudentHistoryModalId(null);
          setStudentHistoryData(null);
        } else if (receiptToPrint) {
          setReceiptToPrint(null);
        } else if (isCollectModalOpen) {
          setIsCollectModalOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [receiptToPrint, isCollectModalOpen, studentHistoryModalId, studentStatementToPrint]);

  const fetchFinanceData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, payRes] = await Promise.all([
        fetchWithTenant("/api/v1/finance/summary"),
        fetchWithTenant(`/api/v1/finance/payments?search=${encodeURIComponent(search)}`)
      ]);

      if (sumRes.ok) setSummary(await sumRes.json());
      if (payRes.ok) setPayments(await payRes.json());
    } finally {
      setLoading(false);
    }
  }, [search]);

  // Debounced server-side student search for collector modal
  const searchStudents = useCallback(async (query: string) => {
    setStudentSearchLoading(true);
    try {
      const res = await fetchWithTenant(`/api/v1/students/?search=${encodeURIComponent(query)}&limit=15`);
      if (res.ok) {
        const raw = await res.json();
        const items: StudentOption[] = (Array.isArray(raw) ? raw : (raw.items || raw.students || [])).map((s: any) => ({
          id: s.id,
          first_name: s.first_name || "",
          last_name: s.last_name || "",
          name_bn: s.name_bn || "",
          admission_number: s.admission_number || "",
          class_name: s.class_name || "",
          section: s.section || "",
          roll_number: s.roll_number || "",
          outstanding_balance: s.outstanding_balance ?? 0
        }));
        setStudentSearchResults(items);
      }
    } finally {
      setStudentSearchLoading(false);
    }
  }, []);

  const handleStudentSearchChange = (query: string) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      searchStudents(query);
    }, 250);
  };

  const handleStudentSelect = (val: string) => {
    setSelectedStudentId(val);
    const found = studentSearchResults.find(s => s.id === val);
    setSelectedStudentDetail(found || null);
  };

  // Fetch read-only fee records for student or guardian
  const fetchPortalFeeSummary = useCallback(async (childId?: string) => {
    setPortalLoading(true);
    try {
      const url = childId ? `/api/v1/finance/portal/fee-summary?student_id=${childId}` : "/api/v1/finance/portal/fee-summary";
      const res = await fetchWithTenant(url);
      if (res.ok) {
        const data = await res.json();
        setPortalFeeData(data);
        if (data.children && Array.isArray(data.children)) {
          setPortalChildren(data.children);
          if (!selectedChildId && data.children.length > 0) {
            setSelectedChildId(data.children[0].id);
          }
        }
      }
    } finally {
      setPortalLoading(false);
    }
  }, [selectedChildId]);

  useEffect(() => {
    if (userRole && ["admin", "superadmin", "finance_officer", "accountant"].includes(userRole)) {
      fetchFinanceData();
    } else if (userRole && ["guardian", "student"].includes(userRole)) {
      fetchPortalFeeSummary(selectedChildId || undefined);
    }
  }, [userRole, fetchFinanceData, fetchPortalFeeSummary, selectedChildId]);

  useEffect(() => {
    if (isCollectModalOpen) {
      searchStudents("");
      setErrorMsg(null);
    }
  }, [isCollectModalOpen, searchStudents]);

  const handleCollectFeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      setErrorMsg(language === "EN" ? "Please select a student." : "অনুগ্রহ করে একজন শিক্ষার্থী নির্বাচন করুন।");
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetchWithTenant("/api/v1/finance/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: selectedStudentId,
          fee_type: formData.fee_type,
          billing_month: formData.billing_month,
          amount_paid: Number(formData.amount_paid),
          currency: formData.currency,
          discount: Number(formData.discount),
          payment_method: formData.payment_method,
          transaction_id: formData.payment_method === "CASH" ? undefined : formData.transaction_id,
          sender_number_or_wallet: formData.payment_method === "CASH" ? undefined : formData.sender_number_or_wallet,
          remarks: formData.remarks
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to collect fee");
      }

      const data = await res.json();
      setIsCollectModalOpen(false);
      setSelectedStudentId("");
      setSelectedStudentDetail(null);
      fetchFinanceData();

      // Trigger printable receipt preview
      setReceiptToPrint({
        receipt_no: data.receipt?.receipt_no || `REC-${Date.now().toString().slice(-6)}`,
        transaction_id: data.receipt?.transaction_id || (formData.payment_method === "CASH" ? "CASH-DESK" : formData.transaction_id),
        school_name: name,
        school_address: address,
        school_phone: phone,
        student_name: data.receipt?.student_name || `${selectedStudentDetail?.first_name || ""} ${selectedStudentDetail?.last_name || ""}`.trim(),
        admission_number: data.receipt?.admission_number || selectedStudentDetail?.admission_number || "N/A",
        class_name: data.receipt?.class_name || selectedStudentDetail?.class_name || "N/A",
        roll_number: data.receipt?.roll_number || selectedStudentDetail?.roll_number || "—",
        fee_type: formData.fee_type,
        billing_month: formData.billing_month,
        amount_paid: Number(formData.amount_paid),
        currency: formData.currency,
        payment_method: formData.payment_method,
        sender_ref: formData.sender_number_or_wallet || "N/A",
        date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
      });

    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // GUARDIAN & STUDENT PORTAL READ-ONLY VIEW
  // -------------------------------------------------------------
  if (userRole === "guardian" || userRole === "student") {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-white/10 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <Wallet className="text-emerald-600 dark:text-emerald-400" />
              <span>{language === "EN" ? "Student Fee Statement" : "শিক্ষার্থী ফি স্টেটমেন্ট"}</span>
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              {language === "EN" 
                ? "Official billing overview, outstanding dues, and money receipts." 
                : "অফিসিয়াল বকেয়া বিবরণী ও সম্পন্ন ফি জমার বিবরণ।"}
            </p>
          </div>

          {userRole === "guardian" && portalChildren.length > 1 && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-500">{language === "EN" ? "Child:" : "সন্তান:"}</label>
              <select
                value={selectedChildId}
                onChange={(e) => setSelectedChildId(e.target.value)}
                className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-semibold"
              >
                {portalChildren.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.student_name} ({c.admission_number})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {portalLoading ? (
          <div className="p-12 text-center text-gray-500 flex justify-center items-center gap-2">
            <Loader2 className="animate-spin text-emerald-600" size={20} /> Loading fee summary...
          </div>
        ) : portalFeeData ? (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                  {language === "EN" ? "Total Fees Paid" : "মোট জমা ফি"}
                </span>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                  ৳{(portalFeeData.total_paid ?? 0).toLocaleString()}
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {language === "EN" ? "Verified money receipts cleared" : "জমা সম্পন্ন হওয়া রসিদ"}
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">
                  {language === "EN" ? "Outstanding Balance Due" : "বর্তমান মোট বকেয়া"}
                </span>
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 font-mono">
                  ৳{(portalFeeData.total_due ?? 0).toLocaleString()}
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {(portalFeeData.total_due ?? 0) === 0 
                    ? (language === "EN" ? "All dues fully cleared" : "কোনো বকেয়া নেই") 
                    : (language === "EN" ? "Please pay tuition fees at school cash counter" : "বিদ্যালয়ের ক্যাশ কাউন্টারে বকেয়া জমা দিন")}
                </p>
              </div>
            </div>

            {/* Receipts List */}
            <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-gray-100 dark:border-white/10 pb-3">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Receipt size={16} className="text-emerald-600" />
                  <span>{language === "EN" ? "Payment History & Money Receipts" : "জমা ও রসিদ হিস্ট্রি"}</span>
                </h3>
              </div>

              {!portalFeeData.payments || portalFeeData.payments.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-400">
                  {language === "EN" ? "No money receipts on record yet." : "এখনও কোনো মানি রিসিট নেই।"}
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-white/5">
                  {portalFeeData.payments.map((p) => (
                    <div key={p.id} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold font-mono text-gray-800 dark:text-gray-200">{p.receipt_no}</div>
                        <div className="text-[11px] text-gray-500">{p.fee_type} • {p.billing_month}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{p.payment_date} via {p.payment_method}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold font-mono text-emerald-600 dark:text-emerald-400">৳{p.amount_paid.toLocaleString()}</div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 font-semibold">
                          {language === "EN" ? "Cleared" : "পরিশোধিত"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="p-10 text-center bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl text-xs text-gray-400">
            {userRole === "guardian"
              ? (language === "EN" 
                  ? "No verified children linked yet. Please contact school administration or submit a child link request."
                  : "এখনও কোনো সন্তান লিঙ্ক করা হয়নি। অনুগ্রহ করে বিদ্যালয় প্রশাসনের সাথে যোগাযোগ করুন।")
              : (language === "EN" 
                  ? "No student fee summary available."
                  : "কোনো শিক্ষার্থীর ফি বিবরণ পাওয়া যায়নি।")}
          </div>
        )}
      </div>
    );
  }

  if (userRole && !["admin", "superadmin", "finance_officer", "accountant"].includes(userRole)) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-6 space-y-3">
        <div className="p-3 bg-red-500/10 text-red-500 rounded-2xl border border-red-500/20">
          <ShieldAlert size={36} />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          {language === "EN" ? "403 — Unauthorized Access Restricted" : "৪০৩ — অননুমোদিত অ্যাক্সেস নিষিদ্ধ"}
        </h2>
        <p className="text-xs text-gray-500 max-w-sm">
          {language === "EN" 
            ? "Financial ledgers and cash collection are strictly restricted to authorized finance staff." 
            : "আর্থিক হিসাব ও ফি লেজার শুধুমাত্র বিদ্যালয়ের অনুমোদিত অর্থ প্রশাসকের জন্য সংরক্ষিত।"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Screen View Headers & Controls */}
      <div className="print:hidden space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-white/10 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <Wallet className="text-emerald-600 dark:text-emerald-400" />
              <span>{language === "EN" ? "Fee Collection & Fiat Gateway Ledger" : "ফি আদায় ও ফিয়াট গেটওয়ে ক্যাশ লেজার"}</span>
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              {language === "EN" 
                ? "Real-time tuition fee tracking with Cash, Bank, bKash, and Nagad receipt generation." 
                : "ক্যাশ, ব্যাংক, বিকাশ এবং নগদ মাধ্যমে রিয়েল-টাইম ফি আদায় ও রসিদ প্রস্তুতকরণ।"}
            </p>
          </div>

          <button
            onClick={() => setIsCollectModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
          >
            <Plus size={16} />
            <span>{language === "EN" ? "Receive Payment" : "ফি জমা নিন"}</span>
          </button>
        </div>

        {/* Top Tab Switcher */}
        <div className="flex items-center gap-2 border-b border-gray-200 dark:border-white/10 pb-4">
          <button
            onClick={() => setActiveTab("ledger")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === "ledger"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-white dark:bg-[#0f0f11] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5"
            }`}
          >
            <Receipt size={14} />
            <span>{language === "EN" ? "Daily Collection Ledger" : "দৈনন্দিন আদায় লেজার"}</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("monthly_report");
              if (!monthlyReport) {
                fetchMonthlyReport(reportYear, reportMonth);
              }
            }}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === "monthly_report"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-white dark:bg-[#0f0f11] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5"
            }`}
          >
            <Calendar size={14} />
            <span>{language === "EN" ? "Monthly Archive & Official Statement" : "মাসিক কালেকশন রিপোর্ট ও ভাউচার"}</span>
          </button>
        </div>

        {/* TAB 1: DAILY COLLECTION LEDGER */}
        {activeTab === "ledger" && (
          <div className="space-y-6">
            {/* Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                  {language === "EN" ? "Today's Collection" : "আজকের মোট আদায়"}
                </span>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                  ৳{(summary?.collected_today ?? summary?.today_collection ?? 0).toLocaleString()}
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {summary?.transactions_today ?? 0} {language === "EN" ? "payments recorded" : "টি ট্রানজ্যাকশন সম্পন্ন"}
                </p>
              </div>

              <div className="p-5 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">
                  {language === "EN" ? "Today's Transactions" : "আজকের মোট লেনদেন"}
                </span>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1 font-mono">
                  {summary?.transactions_today ?? 0}
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {language === "EN" ? "Completed receipts" : "সম্পন্ন মানি রিসিট"}
                </p>
              </div>

              <div className="p-5 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-500">
                  {language === "EN" ? "Cumulative Total Revenue" : "সর্বমোট আদায় (কিউমুলেটিভ)"}
                </span>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1 font-mono">
                  ৳{(summary?.total_revenue ?? 0).toLocaleString()}
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {language === "EN" ? "All-time verified payments" : "সর্বকালীন সম্পন্ন ফি এর মোট যোগফল"}
                </p>
              </div>

              <div className="p-5 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">
                  {language === "EN" ? "This Month's Total" : "চলতি মাসের মোট আদায়"}
                </span>
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 font-mono">
                  ৳{(summary?.this_month_collection ?? summary?.month_collection ?? 0).toLocaleString()}
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {language === "EN" ? "Calendar month to-date" : "চলতি মাসের সংগৃহীত মোট ফি"}
                </p>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="p-4 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-3 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder={language === "EN" ? "Search by receipt, student, class, trx ID..." : "রসিদ নং, শিক্ষার্থী, শ্রেণি দিয়ে খুঁজুন..."}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
              {loading ? (
                <div className="p-12 text-center text-gray-500 flex justify-center items-center gap-2">
                  <Loader2 className="animate-spin text-emerald-600" size={20} /> Loading ledger...
                </div>
              ) : payments.length === 0 ? (
                <div className="p-12 text-center text-gray-400 text-xs">
                  No payment records found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/10 text-gray-500 uppercase font-bold text-[10px]">
                      <tr>
                        <th className="p-3.5">Receipt</th>
                        <th className="p-3.5">Student</th>
                        <th className="p-3.5">Rail</th>
                        <th className="p-3.5">TrxID</th>
                        <th className="p-3.5">Fee Category</th>
                        <th className="p-3.5">Amount Paid</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                      {payments.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                          <td className="p-3.5 font-mono font-bold text-gray-700 dark:text-gray-400">{p.receipt_no}</td>
                          <td className="p-3.5">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => fetchStudentHistory(p.student_id || p.admission_number || p.id)}
                                className="font-semibold text-gray-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 text-left transition-colors"
                              >
                                {p.student_name}
                              </button>
                              <button
                                type="button"
                                onClick={() => fetchStudentHistory(p.student_id || p.admission_number || p.id)}
                                className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                                title="View Student Fee Ledger"
                              >
                                (Ledger)
                              </button>
                            </div>
                            <div className="text-[10px] text-gray-400 font-mono">{p.class_name} • ID: {p.admission_number}</div>
                          </td>
                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              p.payment_method === "BKASH" ? "bg-pink-50 text-pink-700 dark:bg-pink-500/10" :
                              p.payment_method === "NAGAD" ? "bg-orange-50 text-orange-700 dark:bg-orange-500/10" :
                              p.payment_method === "BANK" || p.payment_method === "BANK_TRANSFER" ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10" :
                              "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-400"
                            }`}>
                              {p.payment_method}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-[11px] text-gray-600 dark:text-gray-400">
                            <div>{p.transaction_id}</div>
                            {p.sender_number_or_wallet && p.sender_number_or_wallet !== "N/A" && (
                              <div className="text-[10px] text-gray-400">Ref: {p.sender_number_or_wallet}</div>
                            )}
                          </td>
                          <td className="p-3.5 text-gray-600 dark:text-gray-400">
                            <div>{p.fee_type}</div>
                            <div className="text-[10px] text-gray-400">{p.billing_month}</div>
                          </td>
                          <td className="p-3.5 font-bold font-mono text-emerald-600 dark:text-emerald-400">
                            ৳{p.amount_paid.toLocaleString()}
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              onClick={() => {
                                setReceiptToPrint({
                                  receipt_no: p.receipt_no,
                                  transaction_id: p.transaction_id,
                                  school_name: name,
                                  school_address: address,
                                  school_phone: phone,
                                  student_name: p.student_name,
                                  admission_number: p.admission_number,
                                  class_name: p.class_name,
                                  roll_number: "—",
                                  fee_type: p.fee_type,
                                  billing_month: p.billing_month,
                                  amount_paid: p.amount_paid,
                                  currency: p.currency,
                                  payment_method: p.payment_method,
                                  sender_ref: p.sender_number_or_wallet,
                                  date: p.payment_date
                                });
                              }}
                              className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 text-[11px] font-medium inline-flex items-center gap-1"
                            >
                              <Printer size={12} /> Voucher
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
        )}

      </div>

      {/* TAB 2: MONTHLY COLLECTION ARCHIVE & REPORT */}
      {activeTab === "monthly_report" && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="p-4 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-4 print:hidden">
            <div className="flex items-center gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Select Year</label>
                <select
                  value={reportYear}
                  onChange={(e) => setReportYear(Number(e.target.value))}
                  className="bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-semibold outline-none"
                >
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Select Month</label>
                <select
                  value={reportMonth}
                  onChange={(e) => setReportMonth(Number(e.target.value))}
                  className="bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-semibold outline-none"
                >
                  {[
                    { m: 1, name: "January" }, { m: 2, name: "February" }, { m: 3, name: "March" },
                    { m: 4, name: "April" }, { m: 5, name: "May" }, { m: 6, name: "June" },
                    { m: 7, name: "July" }, { m: 8, name: "August" }, { m: 9, name: "September" },
                    { m: 10, name: "October" }, { m: 11, name: "November" }, { m: 12, name: "December" }
                  ].map(({ m, name }) => (
                    <option key={m} value={m}>{name}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => fetchMonthlyReport(reportYear, reportMonth)}
                disabled={loadingMonthlyReport}
                className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
              >
                {loadingMonthlyReport ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                <span>Generate Report</span>
              </button>
            </div>

            {monthlyReport && (
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm hover:opacity-90 transition-opacity"
              >
                <Printer size={14} /> Print Statement
              </button>
            )}
          </div>

          {loadingMonthlyReport ? (
            <div className="p-12 text-center text-gray-500 flex justify-center items-center gap-2 print:hidden">
              <Loader2 className="animate-spin text-emerald-600" size={20} /> Loading monthly archive statement...
            </div>
          ) : !monthlyReport ? (
            <div className="p-12 text-center text-gray-400 text-xs print:hidden">
              Click &quot;Generate Report&quot; to review the financial statement.
            </div>
          ) : (
            <>
              {/* Interactive Screen View */}
              <div className="space-y-6 print:hidden">
                {/* Monthly Collection Summary Card */}
                <div className="p-6 bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-transparent border border-emerald-200 dark:border-white/10 rounded-3xl">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        Official Monthly Collection Statement
                      </div>
                      <h2 className="text-2xl font-black text-gray-900 dark:text-white mt-1">
                        {monthlyReport.month_name}
                      </h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {monthlyReport.institution.name} • Total Completed Payments
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                        ৳{monthlyReport.total_collected.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {monthlyReport.total_transactions} Transactions Logged
                      </div>
                    </div>
                  </div>
                </div>

                {/* Breakdown by Category & Method */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-5 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Collection By Fee Category</h4>
                    {monthlyReport.breakdown_by_category.length === 0 ? (
                      <div className="text-xs text-gray-400">No category breakdown available.</div>
                    ) : (
                      <div className="space-y-2">
                        {monthlyReport.breakdown_by_category.map((cat, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs p-2 rounded-lg bg-gray-50 dark:bg-white/[0.02]">
                            <span className="font-semibold text-gray-800 dark:text-gray-200">{cat.category}</span>
                            <div className="text-right font-mono">
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">৳{cat.amount.toLocaleString()}</span>
                              <span className="text-[10px] text-gray-400 ml-1.5">({cat.count} tx)</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="p-5 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Collection By Payment Rails</h4>
                    {monthlyReport.breakdown_by_method.length === 0 ? (
                      <div className="text-xs text-gray-400">No payment method breakdown available.</div>
                    ) : (
                      <div className="space-y-2">
                        {monthlyReport.breakdown_by_method.map((m, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs p-2 rounded-lg bg-gray-50 dark:bg-white/[0.02]">
                            <span className="font-semibold text-gray-800 dark:text-gray-200">{m.method}</span>
                            <div className="text-right font-mono">
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">৳{m.amount.toLocaleString()}</span>
                              <span className="text-[10px] text-gray-400 ml-1.5">({m.count} tx)</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Itemized Month Ledger */}
                <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-5 py-4 border-b border-gray-100 dark:border-white/10 font-bold text-xs uppercase text-gray-500">
                    Itemized Transaction Ledger ({monthlyReport.itemized_transactions.length} Payments)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/10 text-gray-500 uppercase font-bold text-[10px]">
                        <tr>
                          <th className="p-3">Receipt</th>
                          <th className="p-3">Student</th>
                          <th className="p-3">Class</th>
                          <th className="p-3">Fee Type</th>
                          <th className="p-3">Method</th>
                          <th className="p-3">Date</th>
                          <th className="p-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                        {monthlyReport.itemized_transactions.map((tx, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                            <td className="p-3 font-mono font-bold text-gray-700 dark:text-gray-400">{tx.receipt_no}</td>
                            <td className="p-3">
                              <button
                                type="button"
                                onClick={() => fetchStudentHistory(tx.student_id || tx.admission_number)}
                                className="font-semibold text-gray-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 text-left transition-colors"
                              >
                                {tx.student_name}
                              </button>
                            </td>
                            <td className="p-3 text-gray-500">{tx.class_name}</td>
                            <td className="p-3 text-gray-600 dark:text-gray-400">{tx.fee_type}</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-400">
                                {tx.payment_method}
                              </span>
                            </td>
                            <td className="p-3 text-gray-500">{tx.date}</td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              ৳{tx.amount.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Dedicated Official Printable Document (Rendered only on window.print()) */}
              <div className={`hidden ${!receiptToPrint && !studentStatementToPrint ? "print:block" : ""} font-serif text-black p-8 bg-white max-w-[210mm] mx-auto text-xs leading-normal`}>
                
                {/* Institutional Letterhead */}
                <div className="text-center border-b-2 border-black pb-4 mb-4">
                  <h1 className="text-xl font-black uppercase tracking-wider">{monthlyReport.institution.name || name}</h1>
                  <p className="text-[11px] text-gray-700 italic mt-0.5">{monthlyReport.institution.address || address}</p>
                  <p className="text-[10px] text-gray-700 italic">Phone: {monthlyReport.institution.phone || phone}</p>
                  <div className="mt-2 font-sans font-bold uppercase text-[10px] bg-black text-white px-4 py-1 inline-block rounded">
                    Official Monthly Revenue & Collection Statement
                  </div>
                </div>

                {/* Reporting Meta & Summary Box */}
                <div className="flex justify-between items-center font-mono text-[11px] mb-4 bg-gray-50 p-3 border border-gray-300">
                  <div>
                    <div>Statement Period: <strong>{monthlyReport.month_name}</strong></div>
                    <div>Reporting Currency: <strong>{monthlyReport.currency} (BDT)</strong></div>
                  </div>
                  <div className="text-right">
                    <div>Generated: <strong>{new Date(monthlyReport.generated_at).toLocaleDateString("en-GB")}</strong></div>
                    <div>Total Logged Payments: <strong>{monthlyReport.total_transactions} Transactions</strong></div>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-gray-100 p-3 text-base font-black border border-black mb-5">
                  <span>Gross Monthly Collections:</span>
                  <span className="font-mono">৳{monthlyReport.total_collected.toLocaleString()}</span>
                </div>

                {/* Breakdowns Side by Side */}
                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div className="border border-black p-3">
                    <h3 className="font-sans font-bold text-[10px] uppercase border-b border-black pb-1 mb-2">Collection by Fee Category</h3>
                    <table className="w-full text-left text-[10px]">
                      <thead>
                        <tr className="border-b border-gray-300 font-bold">
                          <th className="py-1">Category</th>
                          <th className="py-1 text-center">Tx</th>
                          <th className="py-1 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 font-mono text-[9px]">
                        {monthlyReport.breakdown_by_category.map((cat, idx) => (
                          <tr key={idx}>
                            <td className="py-1 font-serif">{cat.category}</td>
                            <td className="py-1 text-center">{cat.count}</td>
                            <td className="py-1 text-right font-bold">৳{cat.amount.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="border border-black p-3">
                    <h3 className="font-sans font-bold text-[10px] uppercase border-b border-black pb-1 mb-2">Collection by Payment Rails</h3>
                    <table className="w-full text-left text-[10px]">
                      <thead>
                        <tr className="border-b border-gray-300 font-bold">
                          <th className="py-1">Payment Rail</th>
                          <th className="py-1 text-center">Tx</th>
                          <th className="py-1 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 font-mono text-[9px]">
                        {monthlyReport.breakdown_by_method.map((m, idx) => (
                          <tr key={idx}>
                            <td className="py-1 font-serif">{m.method}</td>
                            <td className="py-1 text-center">{m.count}</td>
                            <td className="py-1 text-right font-bold">৳{m.amount.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Itemized Transactions Table */}
                <div className="mb-6">
                  <h3 className="font-sans font-bold text-[10px] uppercase border-b border-black pb-1 mb-2">
                    Itemized Transaction Ledger ({monthlyReport.itemized_transactions.length} Payments)
                  </h3>
                  <table className="w-full text-left text-[9px] border border-gray-300">
                    <thead className="bg-gray-100 border-b border-gray-300 font-bold">
                      <tr>
                        <th className="p-1">Receipt #</th>
                        <th className="p-1">Student Name</th>
                        <th className="p-1">ID</th>
                        <th className="p-1">Class</th>
                        <th className="p-1">Fee Type</th>
                        <th className="p-1">Rail</th>
                        <th className="p-1">Date</th>
                        <th className="p-1 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 font-mono text-[9px]">
                      {monthlyReport.itemized_transactions.map((tx, idx) => (
                        <tr key={idx}>
                          <td className="p-1 font-bold">{tx.receipt_no}</td>
                          <td className="p-1 font-serif">{tx.student_name}</td>
                          <td className="p-1">{tx.admission_number}</td>
                          <td className="p-1">{tx.class_name}</td>
                          <td className="p-1 font-serif">{tx.fee_type}</td>
                          <td className="p-1">{tx.payment_method}</td>
                          <td className="p-1">{tx.date}</td>
                          <td className="p-1 text-right font-bold">৳{tx.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-black font-bold bg-gray-50">
                      <tr>
                        <td colSpan={7} className="p-1.5 text-right uppercase">Total Monthly Gross:</td>
                        <td className="p-1.5 text-right font-mono">৳{monthlyReport.total_collected.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Institutional Certification & Signatures */}
                <div className="flex justify-between pt-10 text-[10px] font-sans">
                  <div className="text-center">
                    <div className="w-32 border-t border-black mb-1"></div>
                    <span>Prepared by (Accounts)</span>
                  </div>
                  <div className="text-center">
                    <div className="w-32 border-t border-black mb-1"></div>
                    <span>Verified by (Bursar)</span>
                  </div>
                  <div className="text-center">
                    <div className="w-32 border-t border-black mb-1"></div>
                    <span>Approved by (Principal)</span>
                  </div>
                </div>

              </div>
            </>
          )}
        </div>
      )}

      {/* ================= STUDENT FEE HISTORY WORKSPACE MODAL ================= */}
      {studentHistoryModalId && (
        <ResponsiveDialog
          isOpen={!!studentHistoryModalId}
          onClose={() => {
            setStudentHistoryModalId(null);
            setStudentHistoryData(null);
          }}
          size="2xl"
          title={
            studentHistoryData ? (
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-2">
                  <span>{studentHistoryData.student.first_name} {studentHistoryData.student.last_name}</span>
                  <span className="text-xs font-normal text-gray-400">
                    (Class: {studentHistoryData.student.class_name || "N/A"})
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    ID: {studentHistoryData.student.admission_number}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setStudentStatementToPrint(studentHistoryData)}
                  className="bg-black dark:bg-white text-white dark:text-black hover:opacity-80 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm print:hidden ml-auto mr-4"
                >
                  <Printer size={13} />
                  <span>{language === "EN" ? "Print Statement" : "স্টেটমেন্ট প্রিন্ট"}</span>
                </button>
              </div>
            ) : "Student Fee Ledger"
          }
          subtitle={
            studentHistoryData ? `Roll: ${studentHistoryData.student.roll_number || "—"} • Section: ${studentHistoryData.student.section || "A"} • Shift: ${studentHistoryData.student.shift || "Morning"}` : "Loading student account ledger..."
          }
          icon={<Receipt size={20} />}
        >
          {loadingStudentHistory || !studentHistoryData ? (
            <div className="p-12 text-center text-gray-500 flex justify-center items-center gap-2">
              <Loader2 className="animate-spin text-emerald-600" size={24} /> Loading historical fee records...
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Balances Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/20">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Total Paid Fees
                  </div>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                    ৳{studentHistoryData.total_paid.toLocaleString()}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {studentHistoryData.payment_history.length} completed payment receipts
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/20">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Outstanding Due Balance
                  </div>
                  <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono mt-1">
                    ৳{studentHistoryData.total_due.toLocaleString()}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {studentHistoryData.total_due === 0 ? "All school fees cleared" : "Pending invoices pending settlement"}
                  </p>
                </div>
              </div>

              {/* Completed Payment Receipts Table */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <Receipt size={14} className="text-emerald-600" /> Completed Money Receipts
                </h4>

                {studentHistoryData.payment_history.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 bg-gray-50 dark:bg-white/[0.02] rounded-2xl border border-dashed border-gray-200 dark:border-white/10 text-xs">
                    No payment receipts logged for this student yet.
                  </div>
                ) : (
                  <div className="border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/10 text-gray-500 uppercase font-bold text-[10px]">
                        <tr>
                          <th className="p-3">Receipt No</th>
                          <th className="p-3">Fee Type</th>
                          <th className="p-3">Date</th>
                          <th className="p-3">Method</th>
                          <th className="p-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                        {studentHistoryData.payment_history.map((ph) => (
                          <tr key={ph.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                            <td className="p-3 font-mono font-bold text-gray-700 dark:text-gray-400">{ph.receipt_no}</td>
                            <td className="p-3 font-semibold text-gray-900 dark:text-white">{ph.fee_type}</td>
                            <td className="p-3 text-gray-500">{ph.date}</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-400">
                                {ph.payment_method}
                              </span>
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              ৳{ph.amount.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Invoices List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <FileText size={14} className="text-blue-600" /> Issued Student Invoices
                </h4>

                {studentHistoryData.invoices.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 bg-gray-50 dark:bg-white/[0.02] rounded-2xl border border-dashed border-gray-200 dark:border-white/10 text-xs">
                    No open invoices issued for this student.
                  </div>
                ) : (
                  <div className="border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/10 text-gray-500 uppercase font-bold text-[10px]">
                        <tr>
                          <th className="p-3">Invoice #</th>
                          <th className="p-3">Title</th>
                          <th className="p-3">Due Date</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                        {studentHistoryData.invoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                            <td className="p-3 font-mono font-bold text-gray-700 dark:text-gray-400">{inv.invoice_number}</td>
                            <td className="p-3 font-semibold text-gray-900 dark:text-white">{inv.title}</td>
                            <td className="p-3 text-gray-500">{inv.due_date || "—"}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                inv.status === "PAID" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10" :
                                inv.status === "PARTIAL" ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10" :
                                "bg-amber-50 text-amber-700 dark:bg-amber-500/10"
                              }`}>
                                {inv.status}
                              </span>
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                              ৳{(inv.total_amount ?? inv.due_amount ?? 0).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}
        </ResponsiveDialog>
      )}

      {/* Receive Payment Modal */}
      {isCollectModalOpen && (
        <ResponsiveDialog
          isOpen={isCollectModalOpen}
          onClose={() => setIsCollectModalOpen(false)}
          size="xl"
          title={language === "EN" ? "Receive Student Tuition & Fees" : "শিক্ষার্থী ফি জমা গ্রহণ"}
          subtitle={language === "EN" ? "Enter transaction details to generate an official money receipt." : "ফি জমার তথ্য প্রদান করুন ও রসিদ প্রস্তুত করুন।"}
          icon={<Wallet size={20} />}
        >
          {errorMsg && (
            <div className="p-3.5 mb-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-center justify-between">
              <span>{errorMsg}</span>
              <button onClick={() => setErrorMsg(null)}><X size={14} /></button>
            </div>
          )}

          <form onSubmit={handleCollectFeeSubmit} className="space-y-4">
            {/* Student Search with SearchableSelect */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1.5">
                {language === "EN" ? "Select Student *" : "শিক্ষার্থী নির্বাচন *"}
              </label>
              <SearchableSelect
                options={studentSearchResults.map(s => ({
                  value: s.id,
                  label: `${s.first_name} ${s.last_name}`,
                  sublabel: `Class: ${s.class_name || "—"} • Roll: ${s.roll_number || "—"} • ID: ${s.admission_number}`
                }))}
                value={selectedStudentId}
                onChange={handleStudentSelect}
                onSearchChange={handleStudentSearchChange}
                placeholder={language === "EN" ? "Search by name, roll, admission number..." : "নাম, রোল অথবা আইডি লিখে খুঁজুন..."}
                loading={studentSearchLoading}
              />
            </div>

            {/* Selected Student Balance Card */}
            {selectedStudentDetail && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-emerald-800 dark:text-emerald-300">
                    {selectedStudentDetail.first_name} {selectedStudentDetail.last_name}
                  </span>
                  <span className="text-gray-500 ml-2">
                    (Class: {selectedStudentDetail.class_name || "—"}, Roll: {selectedStudentDetail.roll_number || "—"})
                  </span>
                </div>
                <div className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                  Balance: ৳{(selectedStudentDetail.outstanding_balance ?? 0).toLocaleString()}
                </div>
              </div>
            )}

            {/* Fee Category & Month */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1.5">
                  {language === "EN" ? "Fee Category *" : "ফি এর ক্যাটাগরি *"}
                </label>
                <select
                  value={formData.fee_type}
                  onChange={(e) => setFormData({...formData, fee_type: e.target.value})}
                  className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs font-semibold outline-none focus:border-emerald-500"
                >
                  <option value="Monthly Tuition Fee">Monthly Tuition Fee</option>
                  <option value="Admission / Session Fee">Admission / Session Fee</option>
                  <option value="Exam Fee">Exam Fee</option>
                  <option value="Book & Stationery">Book & Stationery</option>
                  <option value="Transport Fee">Transport Fee</option>
                  <option value="Late Fine">Late Fine</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1.5">
                  {language === "EN" ? "Billing Month *" : "মাসের নাম *"}
                </label>
                <input
                  type="text"
                  value={formData.billing_month}
                  onChange={(e) => setFormData({...formData, billing_month: e.target.value})}
                  className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs font-semibold outline-none focus:border-emerald-500"
                  placeholder="e.g. October 2026"
                />
              </div>
            </div>

            {/* Amount & Discount */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1.5">
                  {language === "EN" ? "Amount Paid (৳) *" : "আদায়কৃত অর্থ (৳) *"}
                </label>
                <input
                  type="number"
                  value={formData.amount_paid}
                  onChange={(e) => setFormData({...formData, amount_paid: Number(e.target.value)})}
                  className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs font-bold font-mono outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1.5">
                  {language === "EN" ? "Special Discount (৳)" : "বিশেষ মওকুফ (৳)"}
                </label>
                <input
                  type="number"
                  value={formData.discount}
                  onChange={(e) => setFormData({...formData, discount: Number(e.target.value)})}
                  className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs font-mono outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Payment Rail */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1.5">
                {language === "EN" ? "Payment Method Rail *" : "পরিশোধের মাধ্যম *"}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "CASH", label: "Cash Desk", icon: Banknote },
                  { id: "BKASH", label: "bKash Wallet", icon: Smartphone },
                  { id: "NAGAD", label: "Nagad Wallet", icon: Smartphone },
                  { id: "BANK", label: "Bank Account", icon: Building2 }
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFormData({...formData, payment_method: id})}
                    className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                      formData.payment_method === id
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "bg-gray-50 dark:bg-white/[0.02] border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
                    }`}
                  >
                    <Icon size={14} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {formData.payment_method !== "CASH" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1.5">
                    {language === "EN" ? "Transaction ID / TrxID *" : "ট্রানজ্যাকশন আইডি *"}
                  </label>
                  <input
                    type="text"
                    value={formData.transaction_id}
                    onChange={(e) => setFormData({...formData, transaction_id: e.target.value})}
                    placeholder="e.g. 9J472LNP"
                    className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs font-mono outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1.5">
                    {language === "EN" ? "Sender Mobile / Acc No" : "প্রেরকের নম্বর / অ্যাকাউন্ট"}
                  </label>
                  <input
                    type="text"
                    value={formData.sender_number_or_wallet}
                    onChange={(e) => setFormData({...formData, sender_number_or_wallet: e.target.value})}
                    placeholder="e.g. 01712345678"
                    className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs font-mono outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-white/10">
              <button
                type="button"
                onClick={() => setIsCollectModalOpen(false)}
                className="px-4 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold hover:bg-gray-50 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                <span>Confirm Payment & Print Voucher</span>
              </button>
            </div>
          </form>
        </ResponsiveDialog>
      )}

      {/* Official Voucher Print Modal */}
      {receiptToPrint && (
        <div 
          onClick={() => setReceiptToPrint(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm print:p-0 print:static print:bg-transparent animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white text-black border border-gray-200 rounded-2xl sm:rounded-3xl w-full max-w-lg max-h-[92vh] max-w-[calc(100vw-1.5rem)] overflow-y-auto p-5 sm:p-6 shadow-2xl print:border-none print:shadow-none print:p-0 print:max-w-none custom-scrollbar"
          >
            <div className="flex justify-between items-center pb-3 mb-4 border-b border-gray-200 print:hidden">
              <span className="text-xs font-bold text-gray-500">Official Money Receipt Ready</span>
              <div className="flex items-center gap-2">
                <button onClick={() => window.print()} className="bg-black text-white hover:opacity-80 px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm">
                  <Printer size={13} /> Print Voucher
                </button>
                <button onClick={() => setReceiptToPrint(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
              </div>
            </div>

            {/* Official Printable Voucher Body */}
            <div className="font-serif text-black p-6 bg-white border-2 border-black rounded-xl print:border-black print:p-0 text-xs leading-normal">
              
              <div className="text-center border-b-2 border-black pb-3 mb-3">
                <h2 className="text-lg font-black uppercase tracking-wider">{receiptToPrint.school_name}</h2>
                <p className="text-[10px] text-gray-700 italic">{receiptToPrint.school_address}</p>
                <p className="text-[8px] text-gray-700 italic">Phone: {receiptToPrint.school_phone}</p>
                <div className="mt-1.5 font-sans font-bold uppercase text-[9px] bg-black text-white px-3 py-0.5 inline-block rounded">
                  Student Fee Money Receipt (Official)
                </div>
              </div>

              <div className="flex justify-between font-mono text-[10px] mb-3 bg-gray-50 p-2 border border-gray-300">
                <div>
                  <div>Receipt: <strong>{receiptToPrint.receipt_no}</strong></div>
                  <div>TrxID/Ref: <strong>{receiptToPrint.transaction_id}</strong></div>
                </div>
                <div className="text-right">
                  <div>Date: {receiptToPrint.date}</div>
                  <div>Rail: <strong>{receiptToPrint.payment_method}</strong></div>
                </div>
              </div>

              <div className="space-y-1.5 border-y border-dashed border-gray-400 py-3 mb-3">
                <div className="flex justify-between">
                  <span>Student Name: <strong>{receiptToPrint.student_name}</strong></span>
                  <span>Class: <strong>{receiptToPrint.class_name}</strong></span>
                </div>
                <div className="flex justify-between">
                  <span>Admission ID: <strong>{receiptToPrint.admission_number}</strong></span>
                  <span>Roll: <strong>{receiptToPrint.roll_number || "—"}</strong></span>
                </div>
                <div>Description: <strong>{receiptToPrint.fee_type} ({receiptToPrint.billing_month})</strong></div>
                {receiptToPrint.sender_ref && receiptToPrint.sender_ref !== "N/A" && (
                  <div>Sender Account/Ref: <strong>{receiptToPrint.sender_ref}</strong></div>
                )}
              </div>

              <div className="flex justify-between items-center bg-gray-100 p-2.5 text-sm font-black border border-black mb-8">
                <span>Total Amount Paid:</span>
                <span>৳{(receiptToPrint.amount_paid ?? 0).toLocaleString()}</span>
              </div>

              <div className="flex justify-between pt-8 text-[10px] font-sans">
                <div className="text-center">
                  <div className="w-28 border-t border-black mb-1"></div>
                  <span>Depositor / Guardian</span>
                </div>
                <div className="text-center">
                  <div className="w-28 border-t border-black mb-1"></div>
                  <span>Accountant Cashier</span>
                </div>
                <div className="text-center">
                  <div className="w-28 border-t border-black mb-1"></div>
                  <span>Authorized Seal</span>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Official Student Account Statement Print Modal */}
      {studentStatementToPrint && (
        <div 
          onClick={() => setStudentStatementToPrint(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm print:p-0 print:static print:bg-transparent animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white text-black border border-gray-200 rounded-2xl sm:rounded-3xl w-full max-w-2xl max-h-[92vh] max-w-[calc(100vw-1.5rem)] overflow-y-auto p-5 sm:p-6 shadow-2xl print:border-none print:shadow-none print:p-0 print:max-w-none custom-scrollbar"
          >
            <div className="flex justify-between items-center pb-3 mb-4 border-b border-gray-200 print:hidden">
              <span className="text-xs font-bold text-gray-500">Official Student Account Ledger Ready</span>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => window.print()} 
                  className="bg-black text-white hover:opacity-80 px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <Printer size={13} /> Print Statement
                </button>
                <button 
                  onClick={() => setStudentStatementToPrint(null)} 
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Official Printable Student Statement Body */}
            <div className="font-serif text-black p-6 bg-white border-2 border-black rounded-xl print:border-black print:p-0 text-xs leading-normal">
              
              <div className="text-center border-b-2 border-black pb-3 mb-3">
                <h2 className="text-lg font-black uppercase tracking-wider">{name}</h2>
                <p className="text-[10px] text-gray-700 italic">{address}</p>
                <p className="text-[8px] text-gray-700 italic">Phone: {phone}</p>
                <div className="mt-1.5 font-sans font-bold uppercase text-[9px] bg-black text-white px-3 py-0.5 inline-block rounded">
                  Student Fee Account Statement & Historical Ledger
                </div>
              </div>

              <div className="flex justify-between font-mono text-[10px] mb-3 bg-gray-50 p-2.5 border border-gray-300">
                <div>
                  <div>Student Name: <strong>{studentStatementToPrint.student.first_name} {studentStatementToPrint.student.last_name}</strong></div>
                  <div>Admission ID: <strong>{studentStatementToPrint.student.admission_number}</strong></div>
                  <div>Class: <strong>{studentStatementToPrint.student.class_name || "—"}</strong></div>
                </div>
                <div className="text-right">
                  <div>Roll No: <strong>{studentStatementToPrint.student.roll_number || "—"}</strong></div>
                  <div>Section / Shift: <strong>{studentStatementToPrint.student.section || "A"} / {studentStatementToPrint.student.shift || "Morning"}</strong></div>
                  <div>Statement Date: <strong>{new Date().toLocaleDateString("en-GB")}</strong></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-2.5 border border-black bg-gray-50">
                  <span className="text-[9px] font-sans uppercase font-bold text-gray-600 block">Total Lifetime Fees Paid</span>
                  <span className="text-sm font-bold font-mono">৳{studentStatementToPrint.total_paid.toLocaleString()}</span>
                </div>
                <div className="p-2.5 border border-black bg-gray-50">
                  <span className="text-[9px] font-sans uppercase font-bold text-gray-600 block">Outstanding Due Balance</span>
                  <span className="text-sm font-bold font-mono">৳{studentStatementToPrint.total_due.toLocaleString()}</span>
                </div>
              </div>

              {/* Payment History Table */}
              <div className="mb-4">
                <div className="font-sans font-bold text-[10px] uppercase border-b border-black pb-1 mb-1">
                  Payment Receipts Journal ({studentStatementToPrint.payment_history.length} Receipts)
                </div>
                <table className="w-full text-left text-[10px] border border-gray-300">
                  <thead className="bg-gray-100 border-b border-gray-300 font-bold">
                    <tr>
                      <th className="p-1.5">Receipt #</th>
                      <th className="p-1.5">Fee Type</th>
                      <th className="p-1.5">Date</th>
                      <th className="p-1.5">Rail</th>
                      <th className="p-1.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 font-mono text-[9px]">
                    {studentStatementToPrint.payment_history.map((ph, idx) => (
                      <tr key={idx}>
                        <td className="p-1.5">{ph.receipt_no}</td>
                        <td className="p-1.5 font-serif">{ph.fee_type}</td>
                        <td className="p-1.5">{ph.date}</td>
                        <td className="p-1.5">{ph.payment_method}</td>
                        <td className="p-1.5 text-right font-bold">৳{ph.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Invoices Table if any */}
              {studentStatementToPrint.invoices && studentStatementToPrint.invoices.length > 0 && (
                <div className="mb-4">
                  <div className="font-sans font-bold text-[10px] uppercase border-b border-black pb-1 mb-1">
                    Invoiced Fee Obligations ({studentStatementToPrint.invoices.length})
                  </div>
                  <table className="w-full text-left text-[10px] border border-gray-300">
                    <thead className="bg-gray-100 border-b border-gray-300 font-bold">
                      <tr>
                        <th className="p-1.5">Invoice #</th>
                        <th className="p-1.5">Title</th>
                        <th className="p-1.5">Status</th>
                        <th className="p-1.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 font-mono text-[9px]">
                      {studentStatementToPrint.invoices.map((inv, idx) => (
                        <tr key={idx}>
                          <td className="p-1.5">{inv.invoice_number}</td>
                          <td className="p-1.5 font-serif">{inv.title}</td>
                          <td className="p-1.5 uppercase font-bold">{inv.status}</td>
                          <td className="p-1.5 text-right font-bold">৳{(inv.total_amount ?? inv.due_amount ?? 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-between pt-8 text-[10px] font-sans">
                <div className="text-center">
                  <div className="w-28 border-t border-black mb-1"></div>
                  <span>Student / Guardian</span>
                </div>
                <div className="text-center">
                  <div className="w-28 border-t border-black mb-1"></div>
                  <span>Accountant</span>
                </div>
                <div className="text-center">
                  <div className="w-28 border-t border-black mb-1"></div>
                  <span>Authorized Principal</span>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
