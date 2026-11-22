"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useLanguage } from "@/components/providers";
import { fetchWithTenant } from "@/lib/api-client";
import { 
  Building2, Palette, Sparkles, Shield, Save, 
  Loader2, Sun, Moon, Monitor, CheckCircle2, Download, 
  UploadCloud, FileSpreadsheet, BookOpen, CreditCard, 
  Layers, Lock, AlertCircle, ArrowRight, Clock, Check, XCircle, RefreshCw,
  ShieldCheck, Filter, Fingerprint, KeyRound
} from "lucide-react";
import ResponsiveDialog from "@/components/ui/ResponsiveDialog";
import { APPROVED_PLANS } from "@/lib/plans";
import { useInstitution } from "@/lib/institution";

type SettingsTab = "general" | "academic" | "roster" | "appearance" | "security" | "billing";

export default function SettingsFullPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const { refresh } = useInstitution();
  const { theme, setTheme } = useTheme();
  const { language, toggleLanguage } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [profile, setProfile] = useState({
    school_name: "",
    tagline: "",
    eiin_or_code: "",
    address: "",
    contact_phone: "",
    contact_email: "",
    academic_year: ""
  });

  // Role state
  const [userRole, setUserRole] = useState<string>("admin");

  // Billing & Subscription state
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingStatus, setBillingStatus] = useState<any>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState("school_starter");
  const [selectedCycle, setSelectedCycle] = useState<"monthly" | "annual">("monthly");
  const [selectedGateway, setSelectedGateway] = useState<"BKASH" | "NAGAD" | "SSLCOMMERZ">("BKASH");
  const [transactionId, setTransactionId] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Platform Super Admin Payment Review state
  const [adminPayments, setAdminPayments] = useState<any[]>([]);
  const [adminPaymentsLoading, setAdminPaymentsLoading] = useState(false);
  const [adminStatusFilter, setAdminStatusFilter] = useState<string>("");
  const [selectedPaymentForReview, setSelectedPaymentForReview] = useState<any | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | null>(null);
  const [statementReference, setStatementReference] = useState("");
  const [verifiedAmount, setVerifiedAmount] = useState<number>(0);
  const [reviewNotes, setReviewNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Security Credentials & Passkeys State
  const [mfaStatus, setMfaStatus] = useState<{ mfa_enabled: boolean; recovery_codes_remaining: number; passkeys_registered: number } | null>(null);
  const [passkeys, setPasskeys] = useState<any[]>([]);
  const [passkeyRegistering, setPasskeyRegistering] = useState(false);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [isTotpModalOpen, setIsTotpModalOpen] = useState(false);
  const [totpSetupData, setTotpSetupData] = useState<{ secret: string; otpauth_url: string; recovery_codes: string[] } | null>(null);
  const [totpVerifyCode, setTotpVerifyCode] = useState("");
  const [totpSubmitting, setTotpSubmitting] = useState(false);
  const [securityFeedback, setSecurityFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchSecurityDetails = async () => {
    try {
      const [mfaRes, passRes, sessRes] = await Promise.all([
        fetchWithTenant("/api/v1/auth/mfa/status"),
        fetchWithTenant("/api/v1/auth/passkey/credentials"),
        fetchWithTenant("/api/v1/auth/sessions"),
      ]);
      if (mfaRes.ok) {
        setMfaStatus(await mfaRes.json());
      }
      if (passRes.ok) {
        const d = await passRes.json();
        setPasskeys(d.passkeys || []);
      }
      if (sessRes.ok) {
        const s = await sessRes.json();
        setActiveSessions(s.sessions || []);
      }
    } catch {
      // Degraded read
    }
  };

  const handleStartTotpSetup = async () => {
    setTotpSubmitting(true);
    setSecurityFeedback(null);
    try {
      const res = await fetchWithTenant("/api/v1/auth/mfa/setup", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setTotpSetupData(data);
        setTotpVerifyCode("");
        setIsTotpModalOpen(true);
      } else {
        setSecurityFeedback({ type: "error", message: "Failed to initialize TOTP setup." });
      }
    } catch (err: any) {
      setSecurityFeedback({ type: "error", message: err.message || "Network error." });
    } finally {
      setTotpSubmitting(false);
    }
  };

  const handleConfirmTotp = async () => {
    if (!totpVerifyCode.trim()) return;
    setTotpSubmitting(true);
    try {
      const res = await fetchWithTenant("/api/v1/auth/mfa/enable", {
        method: "POST",
        body: JSON.stringify({ code: totpVerifyCode.trim() }),
      });
      if (res.ok) {
        setSecurityFeedback({ type: "success", message: "Two-Factor Authentication is now active!" });
        setIsTotpModalOpen(false);
        fetchSecurityDetails();
      } else {
        const d = await res.json().catch(() => ({}));
        setSecurityFeedback({ type: "error", message: d.detail || "Invalid TOTP code. Please try again." });
      }
    } catch (err: any) {
      setSecurityFeedback({ type: "error", message: err.message || "Confirmation failed." });
    } finally {
      setTotpSubmitting(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    setRevokingSessionId(sessionId);
    try {
      const res = await fetchWithTenant(`/api/v1/auth/sessions/${sessionId}`, { method: "DELETE" });
      if (res.ok) {
        setSecurityFeedback({ type: "success", message: "Session terminated remotely." });
        fetchSecurityDetails();
      } else {
        setSecurityFeedback({ type: "error", message: "Failed to terminate session." });
      }
    } catch {
      setSecurityFeedback({ type: "error", message: "Network error terminating session." });
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleRegisterPasskey = async () => {
    if (passkeyRegistering) return;
    if (typeof window === "undefined" || !window.PublicKeyCredential) {
      setSecurityFeedback({ type: "error", message: "WebAuthn Passkeys are not supported in this browser." });
      return;
    }
    setPasskeyRegistering(true);
    setSecurityFeedback(null);
    try {
      const chRes = await fetchWithTenant("/api/v1/auth/passkey/register-challenge", { method: "POST" });
      if (!chRes.ok) throw new Error("Failed to get registration challenge.");
      const chData = await chRes.json();

      const challengeBytes = Uint8Array.from(atob(chData.challenge.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
      const userBytes = Uint8Array.from(atob(chData.user.id.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

      const cred = (await navigator.credentials.create({
        publicKey: {
          challenge: challengeBytes,
          rp: { name: chData.rp.name, id: window.location.hostname === "localhost" ? "localhost" : window.location.hostname },
          user: { id: userBytes, name: chData.user.name, displayName: chData.user.displayName },
          pubKeyCredParams: chData.pubKeyCredParams,
          timeout: 60000,
          attestation: "none",
        },
      })) as PublicKeyCredential;

      if (!cred) throw new Error("Registration was cancelled.");
      const rawId = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));

      const vRes = await fetchWithTenant("/api/v1/auth/passkey/register-verify", {
        method: "POST",
        body: JSON.stringify({ id: cred.id, rawId, type: cred.type }),
      });
      if (!vRes.ok) throw new Error("Passkey registration verification failed.");

      setSecurityFeedback({ type: "success", message: "Security Key / Passkey successfully registered!" });
      fetchSecurityDetails();
    } catch (e: any) {
      if (e.name === "NotAllowedError") {
        setSecurityFeedback({ type: "error", message: "Passkey registration prompt was cancelled." });
      } else {
        setSecurityFeedback({ type: "error", message: e?.message || "Failed to register passkey." });
      }
    } finally {
      setPasskeyRegistering(false);
    }
  };

  const fetchAdminPayments = async (status = adminStatusFilter) => {
    setAdminPaymentsLoading(true);
    try {
      const url = status
        ? `/api/v1/billing/admin/payments?status_filter=${status}`
        : `/api/v1/billing/admin/payments`;
      const res = await fetchWithTenant(url);
      if (res.ok) {
        const data = await res.json();
        setAdminPayments(data.payments || []);
      }
    } catch (err) {
      console.error("Admin payments fetch error:", err);
    } finally {
      setAdminPaymentsLoading(false);
    }
  };

  const fetchBilling = async () => {
    setBillingLoading(true);
    try {
      const [statusRes, paymentsRes] = await Promise.all([
        fetchWithTenant("/api/v1/billing/status"),
        fetchWithTenant("/api/v1/billing/payments"),
      ]);
      if (statusRes.ok) {
        const sData = await statusRes.json();
        setBillingStatus(sData);
        if (sData.plan_key && sData.plan_key !== "free_trial") {
          setSelectedPlan(sData.plan_key);
        }
      }
      if (paymentsRes.ok) {
        const pData = await paymentsRes.json();
        setPaymentHistory(pData.payments || []);
      }
    } catch (e) {
      console.error("Billing fetch error:", e);
    } finally {
      setBillingLoading(false);
    }
  };

  useEffect(() => {
    const role = (localStorage.getItem("user_role") || "admin").toLowerCase();
    setUserRole(role);
    if (role === "superadmin") {
      fetchAdminPayments();
    }
  }, []);

  const handleApprovePayment = async () => {
    if (!selectedPaymentForReview) return;
    setReviewSubmitting(true);
    setReviewFeedback(null);
    try {
      const res = await fetchWithTenant("/api/v1/billing/admin/reconcile-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_reference: selectedPaymentForReview.payment_reference,
          statement_reference: statementReference.trim() || selectedPaymentForReview.transaction_id || "STMT-DIRECT",
          verified_amount: Number(verifiedAmount) || selectedPaymentForReview.amount,
          notes: reviewNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setReviewFeedback({
          type: "success",
          message: `Payment ${selectedPaymentForReview.payment_reference} verified & subscription activated! Invoice: ${data.invoice_number || "Issued"}`,
        });
        setSelectedPaymentForReview(null);
        setReviewAction(null);
        fetchAdminPayments();
        fetchBilling();
      } else {
        setReviewFeedback({ type: "error", message: data.detail || "Approval failed." });
      }
    } catch (err: any) {
      setReviewFeedback({ type: "error", message: err.message || "Network error occurred." });
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleRejectPayment = async () => {
    if (!selectedPaymentForReview || !rejectionReason.trim()) return;
    setReviewSubmitting(true);
    setReviewFeedback(null);
    try {
      const res = await fetchWithTenant("/api/v1/billing/admin/reject-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_reference: selectedPaymentForReview.payment_reference,
          reason: rejectionReason.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setReviewFeedback({
          type: "success",
          message: `Payment claim ${selectedPaymentForReview.payment_reference} rejected. Reason logged.`,
        });
        setSelectedPaymentForReview(null);
        setReviewAction(null);
        fetchAdminPayments();
        fetchBilling();
      } else {
        setReviewFeedback({ type: "error", message: data.detail || "Rejection failed." });
      }
    } catch (err: any) {
      setReviewFeedback({ type: "error", message: err.message || "Network error occurred." });
    } finally {
      setReviewSubmitting(false);
    }
  };

  useEffect(() => {
    if (activeTab === "security") {
      fetchSecurityDetails();
    }
  }, [activeTab]);

  useEffect(() => {
    // Check if ?tab=billing is passed
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab") as SettingsTab;
      if (tabParam && ["general", "academic", "roster", "appearance", "security", "billing"].includes(tabParam)) {
        setActiveTab(tabParam);
      }
    }

    const fetchProfile = async () => {
      try {
        const res = await fetchWithTenant("/api/v1/institution/profile");
        if (res.ok) {
          const data = await res.json();
          setProfile((prev) => ({ ...prev, ...data }));
        }
      } catch {
        // Fallback to defaults
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
    fetchBilling();
  }, []);

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionId.trim()) return;
    setSubmittingPayment(true);
    setPaymentError(null);
    setPaymentSuccess(null);
    try {
      // 1. Initialize checkout intent
      const checkoutRes = await fetchWithTenant("/api/v1/billing/checkout", {
        method: "POST",
        body: JSON.stringify({
          plan_key: selectedPlan,
          gateway: selectedGateway,
          billing_cycle: selectedCycle,
        }),
      });
      const checkoutData = await checkoutRes.json();
      if (!checkoutRes.ok) {
        throw new Error(checkoutData.detail || "Failed to create payment checkout.");
      }

      // 2. Submit manual payment claim proof
      const claimRes = await fetchWithTenant("/api/v1/billing/manual-claim", {
        method: "POST",
        body: JSON.stringify({
          payment_reference: checkoutData.payment_reference,
          transaction_id: transactionId.trim(),
        }),
      });
      const claimData = await claimRes.json();
      if (!claimRes.ok) {
        throw new Error(claimData.detail || "Failed to submit transaction proof.");
      }

      setPaymentSuccess(
        `Payment proof received! Reference: ${claimData.payment_reference}. Status: SUBMITTED (Under Review). The platform billing administrator will verify your transaction within 2-4 business hours.`
      );
      setTransactionId("");
      fetchBilling();
    } catch (err: any) {
      setPaymentError(err.message || "An error occurred submitting payment claim.");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetchWithTenant("/api/v1/institution/profile", {
        method: "PATCH",
        body: JSON.stringify(profile)
      });
      if (res.ok) {
        setFeedback(language === "EN" ? "Institutional settings saved successfully." : "প্রাতিষ্ঠানিক সেটিংস সফলভাবে সংরক্ষিত হয়েছে।");
      } else {
        throw new Error("Failed to save settings.");
      }
    } catch (err: any) {
      setFeedback(`Error: ${err.message || "Failed to save settings."}`);
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setFeedback(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetchWithTenant("/api/v1/institution/import-students-csv", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Import failed");
      setFeedback(`Imported ${data.imported_records} students successfully.`);
    } catch (err: any) {
      setFeedback(`Error: ${err.message}`);
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const downloadSampleCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "first_name,last_name,admission_number,class_name,roll_number,guardian_name,guardian_phone\n" +
      "Aarav,Rahman,KS-001,Class 1,01,Rafiqul Islam,01711223344\n" +
      "Zara,Hossain,KS-002,Class 2,02,Kabir Hossain,01711223344";
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "educationos_student_roster_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: "general", label: language === "EN" ? "Institution Profile" : "প্রাতিষ্ঠানিক প্রোফাইল", icon: <Building2 size={16} /> },
    { id: "academic", label: language === "EN" ? "Academic & Grading" : "কারিকুলাম ও গ্রেডিং", icon: <BookOpen size={16} /> },
    { id: "roster", label: language === "EN" ? "Student Roster Import" : "শিক্ষার্থী তালিকা ইমপোর্ট", icon: <FileSpreadsheet size={16} /> },
    { id: "appearance", label: language === "EN" ? "Appearance & Theme" : "থিম ও ডিসপ্লে", icon: <Palette size={16} /> },
    { id: "security", label: language === "EN" ? "Security Policies" : "নিরাপত্তা পলিসি", icon: <Shield size={16} /> },
    { id: "billing", label: language === "EN" ? "Subscription & FinOps" : "সাবস্ক্রিপশন ও বিলিং", icon: <CreditCard size={16} /> },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-white/10 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2.5">
            <Building2 className="text-blue-600 dark:text-purple-400" />
            <span>{language === "EN" ? "Institution Administration" : "প্রাতিষ্ঠানিক প্রশাসন ও সেটিংস"}</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Configure institutional metadata, NCTB academic policies, bulk roster import, and subscription parameters.
          </p>
        </div>

        <Link
          href="/dashboard/profile"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors self-start sm:self-auto"
        >
          <span>Personal Account Profile</span>
          <ArrowRight size={13} />
        </Link>
      </div>

      {feedback && (
        <div className="p-3.5 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-2xl text-blue-700 dark:text-blue-400 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{feedback}</span>
        </div>
      )}

      {/* Tabs Selector */}
      <div className="flex flex-wrap gap-1.5 bg-gray-100 dark:bg-white/5 p-1.5 rounded-2xl">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setFeedback(null); }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === tab.id
                ? "bg-white dark:bg-[#18181b] text-blue-600 dark:text-white shadow-sm font-bold"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: GENERAL PROFILE */}
      {activeTab === "general" && (
        <form onSubmit={handleProfileSave} className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-gray-700 dark:text-gray-400 mb-1.5">
                Official Institution Name *
              </label>
              <input
                type="text"
                required
                value={profile.school_name}
                onChange={(e) => setProfile({ ...profile, school_name: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-blue-500 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-gray-700 dark:text-gray-400 mb-1.5">
                Institutional Motto / Tagline
              </label>
              <input
                type="text"
                value={profile.tagline}
                onChange={(e) => setProfile({ ...profile, tagline: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-blue-500 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-gray-700 dark:text-gray-400 mb-1.5">
                EIIN / Institutional Code
              </label>
              <input
                type="text"
                value={profile.eiin_or_code}
                onChange={(e) => setProfile({ ...profile, eiin_or_code: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-blue-500 text-gray-900 dark:text-white font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-gray-700 dark:text-gray-400 mb-1.5">
                Campus Physical Address
              </label>
              <input
                type="text"
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-blue-500 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-gray-700 dark:text-gray-400 mb-1.5">
                Official Phone / WhatsApp
              </label>
              <input
                type="tel"
                value={profile.contact_phone}
                onChange={(e) => setProfile({ ...profile, contact_phone: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-blue-500 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-gray-700 dark:text-gray-400 mb-1.5">
                Administrative Email
              </label>
              <input
                type="email"
                value={profile.contact_email}
                onChange={(e) => setProfile({ ...profile, contact_email: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-blue-500 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              <span>{language === "EN" ? "Save Institutional Profile" : "সেটিংস সংরক্ষণ করুন"}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: ACADEMIC & GRADING */}
      {activeTab === "academic" && (
        <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 text-xs">
          <div>
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">
              NCTB Standard 7-Tier Letter Grading Engine
            </h3>
            <p className="text-gray-500 mt-1">
              EducationOS enforces Bangladesh National Curriculum and Textbook Board grading standards with reproducible terminal GPA calculation.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse border border-gray-200 dark:border-white/10">
              <thead>
                <tr className="bg-gray-50 dark:bg-white/5 text-[11px] font-bold">
                  <th className="border border-gray-200 dark:border-white/10 p-2.5">Marks Range</th>
                  <th className="border border-gray-200 dark:border-white/10 p-2.5">Letter Grade</th>
                  <th className="border border-gray-200 dark:border-white/10 p-2.5">Grade Point (GPA)</th>
                  <th className="border border-gray-200 dark:border-white/10 p-2.5">Performance Assessment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5 font-mono">
                <tr><td className="border p-2">80% – 100%</td><td className="border p-2 font-bold text-emerald-600">A+</td><td className="border p-2 font-bold">5.00</td><td className="border p-2 font-sans">Outstanding</td></tr>
                <tr><td className="border p-2">70% – 79%</td><td className="border p-2 font-bold text-emerald-600">A</td><td className="border p-2 font-bold">4.00</td><td className="border p-2 font-sans">Excellent</td></tr>
                <tr><td className="border p-2">60% – 69%</td><td className="border p-2 font-bold text-blue-600">A-</td><td className="border p-2 font-bold">3.50</td><td className="border p-2 font-sans">Very Good</td></tr>
                <tr><td className="border p-2">50% – 59%</td><td className="border p-2 font-bold text-blue-600">B</td><td className="border p-2 font-bold">3.00</td><td className="border p-2 font-sans">Good</td></tr>
                <tr><td className="border p-2">40% – 49%</td><td className="border p-2 font-bold text-amber-600">C</td><td className="border p-2 font-bold">2.00</td><td className="border p-2 font-sans">Satisfactory</td></tr>
                <tr><td className="border p-2">33% – 39%</td><td className="border p-2 font-bold text-amber-600">D</td><td className="border p-2 font-bold">1.00</td><td className="border p-2 font-sans">Passing</td></tr>
                <tr><td className="border p-2">0% – 32%</td><td className="border p-2 font-bold text-red-600">F</td><td className="border p-2 font-bold text-red-600">0.00</td><td className="border p-2 font-sans">Fail</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ROSTER IMPORT */}
      {activeTab === "roster" && (
        <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 text-xs">
          <div>
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">
              Bulk Student Roster Onboarding
            </h3>
            <p className="text-gray-500 mt-1">
              Onboard your entire school directory from an Excel or CSV spreadsheet. The system automatically links students with guardian telephone accounts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 border border-dashed border-gray-300 dark:border-white/20 rounded-2xl bg-gray-50 dark:bg-black/20 flex flex-col items-center justify-center text-center space-y-3">
              <Download size={28} className="text-blue-600" />
              <div>
                <strong className="block text-gray-900 dark:text-white">1. Download Template</strong>
                <span className="text-[11px] text-gray-500">Standard spreadsheet schema with student & guardian columns</span>
              </div>
              <button
                type="button"
                onClick={downloadSampleCSV}
                className="px-4 py-2 bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 rounded-xl font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 transition-colors inline-flex items-center gap-1.5"
              >
                <Download size={14} /> Download CSV Template
              </button>
            </div>

            <div className="p-5 border border-dashed border-gray-300 dark:border-white/20 rounded-2xl bg-gray-50 dark:bg-black/20 flex flex-col items-center justify-center text-center space-y-3">
              <UploadCloud size={28} className="text-emerald-600" />
              <div>
                <strong className="block text-gray-900 dark:text-white">2. Upload Completed Roster</strong>
                <span className="text-[11px] text-gray-500">Instant validation & multi-tenant database insertion</span>
              </div>
              <label className="cursor-pointer px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-colors inline-flex items-center gap-1.5 shadow-sm">
                {importing ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                <span>{importing ? "Importing Roster..." : "Select File & Upload"}</span>
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" disabled={importing} />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: APPEARANCE */}
      {activeTab === "appearance" && (
        <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 text-xs">
          <div>
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">Display & Language Theme</h3>
            <p className="text-gray-500 mt-1">Select visual appearance and language localization.</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setTheme("light")}
              className={`p-4 rounded-2xl border text-center transition-all ${
                theme === "light"
                  ? "bg-blue-50 border-blue-500 text-blue-700 font-bold"
                  : "border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5"
              }`}
            >
              <Sun size={20} className="mx-auto mb-2 text-amber-500" />
              <span>Light Mode</span>
            </button>

            <button
              onClick={() => setTheme("dark")}
              className={`p-4 rounded-2xl border text-center transition-all ${
                theme === "dark"
                  ? "bg-purple-900/20 border-purple-500 text-purple-400 font-bold"
                  : "border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5"
              }`}
            >
              <Moon size={20} className="mx-auto mb-2 text-purple-400" />
              <span>Dark Mode</span>
            </button>

            <button
              onClick={() => setTheme("system")}
              className={`p-4 rounded-2xl border text-center transition-all ${
                theme === "system"
                  ? "bg-gray-100 dark:bg-white/10 border-gray-400 text-gray-900 dark:text-white font-bold"
                  : "border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5"
              }`}
            >
              <Monitor size={20} className="mx-auto mb-2 text-gray-500" />
              <span>System Sync</span>
            </button>
          </div>

          <div className="pt-4 border-t border-gray-100 dark:border-white/10 flex items-center justify-between">
            <div>
              <strong className="block text-gray-900 dark:text-white">Language Parity (বাংলা / English)</strong>
              <span className="text-gray-500">Current language: {language === "EN" ? "English" : "বাংলা"}</span>
            </div>
            <button
              onClick={toggleLanguage}
              className="px-4 py-2 border border-gray-200 dark:border-white/10 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              Switch to {language === "EN" ? "বাংলা" : "English"}
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: SECURITY */}
      {activeTab === "security" && (
        <div className="space-y-6 text-xs">
          {/* Header */}
          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-2.5 mb-1">
              <ShieldCheck className="text-indigo-600 dark:text-indigo-400" size={20} />
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">Account Security & Access Control</h3>
            </div>
            <p className="text-gray-500">Manage two-factor authentication, biometric passkeys, and review infrastructure boundaries.</p>
          </div>

          {securityFeedback && (
            <div className={`p-4 rounded-2xl border flex items-start gap-2.5 ${
              securityFeedback.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200"
                : "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-800 dark:text-red-200"
            }`}>
              {securityFeedback.type === "success" ? <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600" /> : <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-500" />}
              <span>{securityFeedback.message}</span>
            </div>
          )}

          {/* Grid of Security Panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. Two-Factor Authentication (TOTP) */}
            <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound size={18} className="text-blue-600 dark:text-blue-400" />
                  <h4 className="font-bold text-gray-900 dark:text-white">Two-Factor Authentication (TOTP)</h4>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  mfaStatus?.mfa_enabled
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                }`}>
                  {mfaStatus?.mfa_enabled ? "Configured & Active" : "Bootstrap Standard"}
                </span>
              </div>
              <p className="text-gray-500 leading-relaxed">
                Protects the account with time-based 6-digit one-time passwords (RFC 6238) verified upon login.
              </p>
              <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5 flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Emergency Recovery Codes</span>
                <span className="font-mono font-semibold text-gray-900 dark:text-white">
                  {mfaStatus?.recovery_codes_remaining ?? 10} Remaining
                </span>
              </div>
              <button
                type="button"
                onClick={handleStartTotpSetup}
                disabled={totpSubmitting}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
              >
                {totpSubmitting ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                {mfaStatus?.mfa_enabled ? "Reconfigure Authenticator App" : "Setup Authenticator App (TOTP)"}
              </button>
            </div>

            {/* 2. WebAuthn Passkeys & Security Keys */}
            <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Fingerprint size={18} className="text-purple-600 dark:text-purple-400" />
                  <h4 className="font-bold text-gray-900 dark:text-white">FIDO2 / WebAuthn Passkeys</h4>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400 text-[10px] font-bold">
                  {passkeys.length} Registered
                </span>
              </div>
              <p className="text-gray-500 leading-relaxed">
                Log in passwordlessly using Touch ID, Face ID, or hardware security keys (YubiKey).
              </p>
              <button
                type="button"
                onClick={handleRegisterPasskey}
                disabled={passkeyRegistering}
                className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
              >
                {passkeyRegistering ? <Loader2 size={14} className="animate-spin" /> : <Fingerprint size={14} />}
                Register This Device as a Passkey
              </button>
            </div>
          </div>

          {/* 3. Active Sessions & Devices */}
          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white">Active Login Sessions & Devices</h4>
                <p className="text-gray-500 text-xs">Manage active browser and mobile logins across your institution.</p>
              </div>
              <button
                type="button"
                onClick={fetchSecurityDetails}
                className="p-2 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                title="Refresh sessions"
              >
                <RefreshCw size={14} />
              </button>
            </div>

            <div className="space-y-2">
              {activeSessions.length === 0 ? (
                <p className="text-gray-500 py-3 text-center">No active background sessions recorded.</p>
              ) : (
                activeSessions.map((sess: any) => (
                  <div
                    key={sess.id}
                    className="p-3.5 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10 flex items-center justify-between"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 dark:text-white capitalize">{sess.role} Session</span>
                        {sess.is_current && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[9px] font-bold uppercase">
                            This Device
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 font-mono">
                        Started: {sess.created_at ? new Date(sess.created_at).toLocaleString() : "Unknown"} · JTI: {sess.jti?.slice(0, 8)}...
                      </p>
                    </div>

                    {!sess.is_current && (
                      <button
                        type="button"
                        onClick={() => handleRevokeSession(sess.id)}
                        disabled={revokingSessionId === sess.id}
                        className="py-1 px-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg font-semibold text-xs transition-colors disabled:opacity-50"
                      >
                        {revokingSessionId === sess.id ? <Loader2 size={12} className="animate-spin" /> : "Revoke"}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Infrastructure Boundaries */}
          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
            <h4 className="font-bold text-gray-900 dark:text-white">Active Infrastructure Safeguards</h4>
            <div className="space-y-3 font-mono">
              <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 flex items-center justify-between">
                <span>PostgreSQL Row-Level Security (RLS)</span>
                <span className="text-emerald-600 font-bold">KERNEL ENFORCED</span>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 flex items-center justify-between">
                <span>Token Encryption & Single-Use Rotation</span>
                <span className="text-blue-600 font-bold">HMAC-SHA256 (1-HR ACCESS / 7-DAY REFRESH)</span>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 flex items-center justify-between">
                <span>Password Hashing Algorithm</span>
                <span className="text-purple-600 font-bold">BCRYPT COST FACTOR 12</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: BILLING & SUBSCRIPTION */}
      {activeTab === "billing" && (
        <div className="space-y-6 text-xs">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <CreditCard className="text-blue-600 dark:text-purple-400" size={20} />
                <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                  Institutional Subscription & FinOps
                </h3>
              </div>
              <p className="text-gray-500 mt-1">
                Manage commercial licenses, 30-day trial status, and submit manual bKash/Nagad/Bank payment claims.
              </p>
            </div>
            <button
              onClick={() => {
                fetchBilling();
                if (userRole === "superadmin") fetchAdminPayments();
              }}
              disabled={billingLoading || adminPaymentsLoading}
              className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 flex items-center gap-1.5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors font-medium text-gray-600 dark:text-gray-400"
            >
              <RefreshCw size={13} className={billingLoading || adminPaymentsLoading ? "animate-spin" : ""} />
              <span>Refresh Status</span>
            </button>
          </div>

          {/* Superadmin Notification Banner */}
          {reviewFeedback && (
            <div className={`p-4 rounded-2xl border flex items-start gap-2.5 ${
              reviewFeedback.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200"
                : "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-800 dark:text-red-200"
            }`}>
              {reviewFeedback.type === "success" ? (
                <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
              )}
              <div className="flex-1">
                <div className="font-bold">{reviewFeedback.type === "success" ? "Operation Successful" : "Verification Error"}</div>
                <div className="text-[11px] mt-0.5">{reviewFeedback.message}</div>
              </div>
              <button onClick={() => setReviewFeedback(null)} className="text-gray-400 hover:text-gray-600">
                <XCircle size={14} />
              </button>
            </div>
          )}

          {/* PLATFORM SUPER ADMIN MANUAL PAYMENT VERIFICATION CONSOLE */}
          {userRole === "superadmin" && (
            <div className="bg-gradient-to-br from-purple-50/50 via-white to-indigo-50/30 dark:from-purple-950/20 dark:via-[#0f0f11] dark:to-indigo-950/20 border-2 border-purple-300 dark:border-purple-500/40 rounded-3xl p-6 shadow-md space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-600 text-white rounded-xl">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                        Platform Super Admin Payment Verification Console
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300">
                        Dual-Custody Mode A
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Cross-tenant payment review queue. Verify bKash/Nagad/Bank merchant statements and activate licenses.
                    </p>
                  </div>
                </div>

                {/* Status Filter Tabs */}
                <div className="flex items-center gap-1 bg-white dark:bg-black/40 p-1 rounded-xl border border-gray-200 dark:border-white/10 text-[11px]">
                  {[
                    { key: "", label: "All" },
                    { key: "SUBMITTED", label: "Under Review" },
                    { key: "PAID", label: "Reconciled" },
                    { key: "REJECTED", label: "Rejected" },
                  ].map((f) => (
                    <button
                      key={f.key}
                      onClick={() => {
                        setAdminStatusFilter(f.key);
                        fetchAdminPayments(f.key);
                      }}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                        adminStatusFilter === f.key
                          ? "bg-purple-600 text-white shadow-xs"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {adminPaymentsLoading ? (
                <div className="p-8 text-center text-gray-400">
                  <Loader2 className="animate-spin mx-auto mb-2 text-purple-600" size={20} />
                  <span>Loading platform payment claims...</span>
                </div>
              ) : adminPayments.length === 0 ? (
                <div className="p-8 text-center text-gray-400 bg-white/50 dark:bg-black/20 rounded-2xl border border-dashed border-gray-200 dark:border-white/10">
                  No payment claims found matching the filter.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0f0f11]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 dark:bg-white/5 text-gray-400 text-[10px] uppercase font-bold">
                      <tr>
                        <th className="p-3">Reference / Tenant</th>
                        <th className="p-3">Plan / Cycle</th>
                        <th className="p-3">Gateway</th>
                        <th className="p-3">TrxID</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Submitted</th>
                        <th className="p-3 text-right">Review Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5 font-mono text-[11px]">
                      {adminPayments.map((p) => (
                        <tr key={p.payment_id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                          <td className="p-3">
                            <div className="font-bold text-gray-900 dark:text-white">{p.payment_reference}</div>
                            <div className="text-[10px] text-gray-400 font-mono">Tenant: {p.tenant_id?.slice(0, 8)}...</div>
                          </td>
                          <td className="p-3 font-sans capitalize">
                            <span className="font-semibold text-gray-800 dark:text-gray-200">{p.plan_key?.replace("_", " ")}</span>
                            <span className="text-[10px] text-gray-400 block">{p.billing_cycle}</span>
                          </td>
                          <td className="p-3">
                            <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 text-[10px] font-bold">
                              {p.gateway}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold text-gray-700 dark:text-gray-300">
                            {p.transaction_id || "—"}
                          </td>
                          <td className="p-3 font-bold text-gray-900 dark:text-white">
                            ৳{Number(p.amount).toLocaleString()}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase font-sans ${
                              p.status === "PAID"
                                ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                                : p.status === "SUBMITTED"
                                ? "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-400 animate-pulse"
                                : p.status === "REJECTED"
                                ? "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400"
                                : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400"
                            }`}>
                              {p.status === "SUBMITTED" ? "Under Review" : p.status}
                            </span>
                          </td>
                          <td className="p-3 text-gray-400">
                            {p.submitted_at ? new Date(p.submitted_at).toLocaleDateString() : "—"}
                          </td>
                          <td className="p-3 text-right">
                            {p.status === "SUBMITTED" ? (
                              <div className="flex items-center justify-end gap-1.5 font-sans">
                                <button
                                  onClick={() => {
                                    setSelectedPaymentForReview(p);
                                    setStatementReference(p.transaction_id || "");
                                    setVerifiedAmount(p.amount);
                                    setReviewNotes("");
                                    setReviewAction("approve");
                                  }}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[10px] transition-colors"
                                >
                                  Reconcile
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedPaymentForReview(p);
                                    setRejectionReason("");
                                    setReviewAction("reject");
                                  }}
                                  className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-950/40 dark:hover:bg-red-900/50 dark:text-red-300 rounded-lg font-bold text-[10px] transition-colors"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : p.status === "PAID" ? (
                              <span className="text-[10px] text-emerald-600 font-sans font-semibold">
                                ✓ Activated
                              </span>
                            ) : (
                              <span className="text-[10px] text-gray-400 font-sans">
                                Archived
                              </span>
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

          {/* Current License Status Banner */}
          {billingStatus ? (
            <div className={`p-6 rounded-3xl border shadow-sm ${
              billingStatus.subscription_status === "EXPIRED" || billingStatus.days_remaining <= 0
                ? "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-500/30"
                : billingStatus.is_trial || billingStatus.plan_key === "free_trial"
                ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-500/30"
                : "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-500/30"
            }`}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                      billingStatus.subscription_status === "EXPIRED" || billingStatus.days_remaining <= 0
                        ? "bg-red-600 text-white"
                        : billingStatus.is_trial || billingStatus.plan_key === "free_trial"
                        ? "bg-amber-500 text-white"
                        : "bg-emerald-600 text-white"
                    }`}>
                      {billingStatus.subscription_status === "EXPIRED" || billingStatus.days_remaining <= 0
                        ? "License Expired"
                        : billingStatus.is_trial || billingStatus.plan_key === "free_trial"
                        ? "30-Day Free Trial"
                        : "Active Commercial License"}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      Ref: {billingStatus.subscription_id?.slice(0, 8)}
                    </span>
                  </div>

                  <h4 className="text-xl font-black text-gray-900 dark:text-white mt-1.5">
                    {billingStatus.plan_name || "SchoolOS Starter"}
                  </h4>
                  <p className="text-gray-400 text-xs mt-0.5">
                    {billingStatus.days_remaining > 0
                      ? `${billingStatus.days_remaining} days remaining • Valid until ${new Date(billingStatus.valid_until).toLocaleDateString()}`
                      : "Expired • Please submit a renewal payment proof below to restore full student capacity."}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 shrink-0">
                  <div className="p-3 bg-white/80 dark:bg-black/40 rounded-2xl border border-gray-200 dark:border-white/10 text-center">
                    <div className="text-[10px] font-bold text-gray-400 uppercase">Student Quota</div>
                    <div className="text-base font-black text-gray-900 dark:text-white mt-0.5">
                      {billingStatus.quota?.current_students ?? 0} / {billingStatus.quota?.max_students ?? 50}
                    </div>
                  </div>
                  <div className="p-3 bg-white/80 dark:bg-black/40 rounded-2xl border border-gray-200 dark:border-white/10 text-center">
                    <div className="text-[10px] font-bold text-gray-400 uppercase">AI Token Budget</div>
                    <div className="text-base font-black text-gray-900 dark:text-white mt-0.5">
                      {billingStatus.quota?.ai_questions_used ?? 0} / {billingStatus.quota?.ai_questions_quota ?? 100}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400 bg-white dark:bg-[#0f0f11] rounded-3xl border border-gray-200 dark:border-white/10">
              <Loader2 className="animate-spin mx-auto mb-2 text-blue-500" size={20} />
              <span>Loading commercial subscription metrics...</span>
            </div>
          )}

          {/* Payment Proof Submission Form */}
          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <Sparkles size={16} className="text-purple-600" />
                <span>Upgrade License or Submit Renewal Payment Claim</span>
              </h4>
              <p className="text-gray-500 mt-1">
                Select your desired plan tier, transfer fees via bKash/Nagad/Bank, and enter the Transaction ID (TrxID) for instant reviewer verification.
              </p>
            </div>

            {paymentSuccess && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl text-emerald-800 dark:text-emerald-200 flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <div className="font-bold">Claim Received</div>
                  <div className="text-[11px] mt-0.5">{paymentSuccess}</div>
                </div>
              </div>
            )}

            {paymentError && (
              <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-2xl text-red-800 dark:text-red-200 flex items-start gap-2.5">
                <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
                <div>
                  <div className="font-bold">Payment Submission Error</div>
                  <div className="text-[11px] mt-0.5">{paymentError}</div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmitPayment} className="space-y-6">
              {/* 1. Plan Selector */}
              <div>
                <label className="font-bold text-gray-700 dark:text-gray-400 block mb-2">
                  1. Select Plan Tier
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    { key: "school_starter", name: "SchoolOS Starter", price: 990, max_students: 100, ai: 100, desc: "Attendance, Cash & bKash Receipts, A4 Cards" },
                    { key: "school_growth", name: "SchoolOS Growth", price: 2490, max_students: 500, ai: 500, desc: "Voice-to-Diary Copilot, WhatsApp, NCTB Grading" },
                    { key: "school_pro", name: "SchoolOS Pro", price: 5990, max_students: 1500, ai: 2000, desc: "Camera OMR Scanner, Multi-Branch, Audit Ledger" },
                    { key: "academy_starter", name: "AcademyOS Starter", price: 1490, max_students: 150, ai: 200, desc: "Batch & Shift Management, Live MCQ" },
                    { key: "academy_growth", name: "AcademyOS Growth", price: 3990, max_students: 600, ai: 1000, desc: "High-Concurrency Live Exams, Socratic Solver" },
                    { key: "unified_growth", name: "EducationOS Unified", price: 4990, max_students: 800, ai: 1500, desc: "Combined School + Academy, Shared Identity" },
                  ].map((p) => {
                    const isSelected = selectedPlan === p.key;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setSelectedPlan(p.key)}
                        className={`p-4 rounded-2xl border text-left transition-all ${
                          isSelected
                            ? "border-blue-600 bg-blue-50/50 dark:bg-blue-500/10 shadow-sm"
                            : "border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-gray-900 dark:text-white">{p.name}</span>
                          <span className="font-black text-blue-600 dark:text-purple-400">৳{p.price.toLocaleString()}</span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">{p.desc}</p>
                        <div className="mt-2 text-[10px] text-gray-400 font-semibold">
                          Max {p.max_students} Students • {p.ai} AI Quota
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Billing Cycle & Gateway */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-gray-700 dark:text-gray-400 block mb-2">
                    2. Billing Cycle
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCycle("monthly")}
                      className={`p-3 rounded-xl border text-center font-semibold transition-all ${
                        selectedCycle === "monthly"
                          ? "border-blue-600 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      Monthly Cycle
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCycle("annual")}
                      className={`p-3 rounded-xl border text-center font-semibold transition-all relative ${
                        selectedCycle === "annual"
                          ? "border-blue-600 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      <span>Annual (10 Mo)</span>
                      <span className="block text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">2 Months Free</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-gray-700 dark:text-gray-400 block mb-2">
                    3. Payment Method
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: "BKASH" as const, label: "bKash Merchant" },
                      { key: "NAGAD" as const, label: "Nagad Merchant" },
                      { key: "SSLCOMMERZ" as const, label: "Bank / Card" },
                    ].map((g) => (
                      <button
                        key={g.key}
                        type="button"
                        onClick={() => setSelectedGateway(g.key)}
                        className={`p-3 rounded-xl border text-center font-semibold transition-all ${
                          selectedGateway === g.key
                            ? "border-blue-600 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Instructions Box */}
              <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10">
                <div className="font-bold text-gray-800 dark:text-gray-200 mb-1 flex items-center gap-1.5">
                  <Building2 size={14} className="text-blue-500" />
                  <span> Merchant Deposit Instructions </span>
                </div>
                <div className="text-[11px] text-gray-500 space-y-1">
                  {selectedGateway === "BKASH" && (
                    <p>• bKash Merchant Number: <strong className="font-mono text-gray-800 dark:text-gray-200">01705-587837</strong> (Send Money/Payment)</p>
                  )}
                  {selectedGateway === "NAGAD" && (
                    <p>• Nagad Merchant Number: <strong className="font-mono text-gray-800 dark:text-gray-200">01705-587837</strong> (Send Money/Payment)</p>
                  )}
                  {/* 
                  {selectedGateway === "SSLCOMMERZ" && (
                    <p>• Bank Transfer: City Bank Ltd, A/C: EducationOS Limited, Account Number: <strong className="font-mono text-gray-800 dark:text-gray-200"></strong></p>
                  )}
                    <p>• After completing the transfer, paste the transaction ID below and submit.</p>
                  */}
                </div>
              </div>

              {/* TrxID Input & Submit */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div className="sm:col-span-2">
                  <label className="font-bold text-gray-700 dark:text-gray-400 block mb-1">
                    4. Transaction ID (TrxID) / Deposit Slip No.
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 9J28DA10XP or BANK-DEP-9921"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    className="w-full p-3 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none font-mono text-xs uppercase focus:border-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingPayment || !transactionId.trim()}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 transition-all"
                >
                  {submittingPayment ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  <span>Submit Payment Proof</span>
                </button>
              </div>
            </form>
          </div>

          {/* Payment History & Claims Table */}
          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 shadow-sm space-y-4">
            <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
              <Clock size={16} className="text-gray-500" />
              <span>Recent Payment Claims & Receipts</span>
            </h4>

            {paymentHistory.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs">
                No recent payment transactions recorded.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 dark:bg-white/5 text-gray-400 text-[10px] uppercase font-bold">
                    <tr>
                      <th className="p-3">Reference</th>
                      <th className="p-3">Plan</th>
                      <th className="p-3">Gateway</th>
                      <th className="p-3">TrxID</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5 font-mono text-[11px]">
                    {paymentHistory.map((p, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                        <td className="p-3 font-bold text-gray-900 dark:text-white">{p.payment_reference}</td>
                        <td className="p-3 font-sans capitalize">{p.plan_key?.replace("_", " ")}</td>
                        <td className="p-3">{p.gateway}</td>
                        <td className="p-3 text-gray-500">{p.transaction_id || "—"}</td>
                        <td className="p-3 font-bold">৳{Number(p.amount).toLocaleString()}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase font-sans ${
                            p.status === "PAID"
                              ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                              : p.status === "SUBMITTED"
                              ? "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-400"
                              : p.status === "REJECTED"
                              ? "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400"
                              : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400"
                          }`}>
                            {p.status === "SUBMITTED" ? "Under Review" : p.status}
                          </span>
                        </td>
                        <td className="p-3 text-gray-400">
                          {p.submitted_at ? new Date(p.submitted_at).toLocaleDateString() : p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}
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

      {/* SUPER ADMIN PAYMENT REVIEW MODAL */}
      <ResponsiveDialog
        isOpen={Boolean(selectedPaymentForReview && reviewAction)}
        onClose={() => {
          setSelectedPaymentForReview(null);
          setReviewAction(null);
        }}
        title={
          reviewAction === "approve"
            ? "Reconcile Payment & Activate License"
            : "Reject Manual Payment Claim"
        }
        subtitle={
          reviewAction === "approve"
            ? "Verify transaction against merchant statement and execute atomic subscription provisioning."
            : "Record mandatory audit explanation for disputed or invalid payment transaction."
        }
        icon={
          reviewAction === "approve" ? (
            <ShieldCheck size={20} className="text-emerald-600" />
          ) : (
            <AlertCircle size={20} className="text-red-600" />
          )
        }
        size="md"
        footer={
          <div className="flex justify-end gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                setSelectedPaymentForReview(null);
                setReviewAction(null);
              }}
              disabled={reviewSubmitting}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors font-semibold text-gray-700 dark:text-gray-300"
            >
              Cancel
            </button>
            {reviewAction === "approve" ? (
              <button
                type="button"
                onClick={handleApprovePayment}
                disabled={reviewSubmitting || !statementReference.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
              >
                {reviewSubmitting && <Loader2 size={13} className="animate-spin" />}
                <span>Confirm & Activate Subscription</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRejectPayment}
                disabled={reviewSubmitting || rejectionReason.trim().length < 5}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
              >
                {reviewSubmitting && <Loader2 size={13} className="animate-spin" />}
                <span>Confirm Rejection</span>
              </button>
            )}
          </div>
        }
      >
        {selectedPaymentForReview && (
          <div className="space-y-4 text-xs">
            {/* Payment Summary Pill Card */}
            <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">Reference</span>
                  <span className="font-mono font-bold text-gray-900 dark:text-white">{selectedPaymentForReview.payment_reference}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">Tenant ID</span>
                  <span className="font-mono text-gray-700 dark:text-gray-300">{selectedPaymentForReview.tenant_id?.slice(0, 13)}...</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">Plan & Cycle</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200 capitalize">
                    {selectedPaymentForReview.plan_key?.replace("_", " ")} ({selectedPaymentForReview.billing_cycle})
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">Claimed Amount</span>
                  <span className="font-bold text-blue-600 dark:text-purple-400">৳{Number(selectedPaymentForReview.amount).toLocaleString()}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-gray-200/50 dark:border-white/5 flex items-center justify-between text-[11px]">
                <span className="text-gray-400 font-medium">Gateway: <strong>{selectedPaymentForReview.gateway}</strong></span>
                <span className="font-mono font-bold text-gray-800 dark:text-gray-200">TrxID: {selectedPaymentForReview.transaction_id || "N/A"}</span>
              </div>
            </div>

            {reviewAction === "approve" ? (
              <div className="space-y-3">
                <div>
                  <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">
                    Statement Reference / Confirmed TrxID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={statementReference}
                    onChange={(e) => setStatementReference(e.target.value)}
                    placeholder="e.g. 9J28DA10XP or BANK-STMT-4881"
                    className="w-full p-2.5 bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl font-mono text-xs outline-none focus:border-purple-500"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Cross-referenced against bKash/Nagad merchant panel or bank statement.</p>
                </div>

                <div>
                  <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">
                    Verified Amount (BDT) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={verifiedAmount}
                    onChange={(e) => setVerifiedAmount(Number(e.target.value))}
                    className="w-full p-2.5 bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl font-mono text-xs outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">
                    Operational Verification Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="e.g. Verified on bKash merchant app by SuperAdmin"
                    className="w-full p-2.5 bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-purple-500"
                  />
                </div>

                <div className="p-2.5 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-500/30 rounded-xl text-[10px] text-purple-900 dark:text-purple-300 flex items-start gap-2">
                  <ShieldCheck size={14} className="shrink-0 mt-0.5" />
                  <span>
                    <strong>Dual-Custody Enforcement:</strong> Your operator identity is permanently recorded in the billing audit log. Approval triggers atomic license activation and generates tax invoice.
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">
                    Mandatory Rejection Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g. Transaction ID was not found in bKash merchant account statement. Please verify and re-submit."
                    className="w-full p-2.5 bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-red-500"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">Minimum 5 characters. This explanation will be displayed to the tenant admin.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </ResponsiveDialog>

      {/* TOTP Setup Modal */}
      <ResponsiveDialog
        isOpen={isTotpModalOpen}
        onClose={() => setIsTotpModalOpen(false)}
        title="Setup Authenticator App (TOTP)"
        subtitle="Protect your EducationOS account with RFC 6238 time-based two-factor authentication."
        icon={<KeyRound className="text-blue-600 dark:text-blue-400" size={20} />}
        size="md"
        footer={
          <div className="flex justify-end gap-2 text-xs">
            <button
              type="button"
              onClick={() => setIsTotpModalOpen(false)}
              disabled={totpSubmitting}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors font-semibold text-gray-700 dark:text-gray-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmTotp}
              disabled={totpSubmitting || totpVerifyCode.trim().length !== 6}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
            >
              {totpSubmitting && <Loader2 size={13} className="animate-spin" />}
              <span>Verify & Activate</span>
            </button>
          </div>
        }
      >
        {totpSetupData && (
          <div className="space-y-4 text-xs">
            <div>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                1. Enter this Secret Key manually in Google Authenticator, Microsoft Authenticator, or 1Password:
              </p>
              <div className="p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl font-mono text-center text-sm font-bold tracking-widest text-blue-600 dark:text-blue-400 select-all">
                {totpSetupData.secret}
              </div>
            </div>

            <div>
              <p className="text-gray-600 dark:text-gray-400 mb-1">
                2. Emergency Recovery Codes (Save these offline; each code can only be used once):
              </p>
              <div className="grid grid-cols-2 gap-1.5 p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl font-mono text-[11px] text-gray-700 dark:text-gray-300">
                {totpSetupData.recovery_codes.map((code, idx) => (
                  <div key={idx} className="px-2 py-0.5 bg-white dark:bg-black/20 rounded border border-gray-100 dark:border-white/5">
                    {code}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">
                3. Enter the 6-digit verification code from your app:
              </label>
              <input
                type="text"
                maxLength={6}
                value={totpVerifyCode}
                onChange={(e) => setTotpVerifyCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="w-full p-2.5 bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl font-mono text-center text-base tracking-widest font-bold outline-none focus:border-blue-500"
              />
            </div>
          </div>
        )}
      </ResponsiveDialog>
    </div>
  );
}
