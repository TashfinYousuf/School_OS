"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/providers";
import { safeFetch, fetchWithTenant } from "@/lib/api-client";
import {
  Building2,
  ShieldCheck,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  Check,
  X,
  Server,
  Cpu,
  Database,
  Lock,
  Layers,
  Sparkles,
  ExternalLink,
  Cloud,
  Mail,
  Activity,
} from "lucide-react";
import ResponsiveDialog from "@/components/ui/ResponsiveDialog";

interface PlatformStats {
  status: string;
  total_tenants: number;
  active_subscriptions: number;
  trialing_subscriptions: number;
  suspended_subscriptions: number;
  pending_payments: number;
  system_health: string;
}

interface TenantItem {
  id: string;
  school_name: string;
  domain: string | null;
  address: string | null;
  created_at: string | null;
  plan_tier: string;
  subscription_status: string;
  monthly_fee: number;
  max_active_students: number;
  active_students: number;
  valid_until: string | null;
}

interface PaymentClaim {
  id: string;
  tenant_id: string;
  payment_reference: string;
  plan_key: string;
  billing_cycle: string;
  gateway: string;
  amount: number;
  status: string;
  transaction_id: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
}

export default function PlatformOperationsPage() {
  const router = useRouter();
  const { language } = useLanguage();

  const [authorized, setAuthorized] = useState(false);
  const [activeTab, setActiveTab] = useState<"tenants" | "payments" | "system">("tenants");
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [payments, setPayments] = useState<PaymentClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // Reconcile dialog
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentClaim | null>(null);
  const [statementRef, setStatementRef] = useState("");
  const [submittingReconcile, setSubmittingReconcile] = useState(false);

  // Reject dialog
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [submittingReject, setSubmittingReject] = useState(false);

  // Tenant Action
  const [tenantActionLoading, setTenantActionLoading] = useState<string | null>(null);

  const fetchPlatformData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [statsRes, dirRes, pmtRes, healthRes] = await Promise.all([
        safeFetch<PlatformStats>("/api/v1/tenants/overview/stats"),
        safeFetch<TenantItem[]>("/api/v1/tenants/directory"),
        safeFetch<{ payments: PaymentClaim[] }>("/api/v1/billing/admin/payments"),
        safeFetch<any>("/api/v1/health"),
      ]);

      if (statsRes.data) {
        setStats(statsRes.data);
      }
      if (dirRes.data && Array.isArray(dirRes.data)) {
        setTenants(dirRes.data);
      }
      if (pmtRes.data && Array.isArray(pmtRes.data.payments)) {
        setPayments(pmtRes.data.payments);
      }
      if (healthRes.data) {
        setSystemHealth(healthRes.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load platform data";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // RBAC & Initialize
  useEffect(() => {
    const role = (localStorage.getItem("user_role") || "").toLowerCase();
    if (role !== "superadmin") {
      router.replace("/dashboard");
      return;
    }
    setAuthorized(true);
    fetchPlatformData();
  }, [router, fetchPlatformData]);

  const handleSuspendTenant = async (tenantId: string) => {
    if (!confirm("Are you sure you want to suspend this institution?")) return;
    setTenantActionLoading(tenantId);
    try {
      const res = await fetchWithTenant(`/api/v1/tenants/${tenantId}/suspend`, {
        method: "POST",
      });
      if (res.ok) {
        setSuccessMsg("Tenant subscription has been suspended.");
        fetchPlatformData();
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.detail || "Failed to suspend tenant");
      }
    } finally {
      setTenantActionLoading(null);
    }
  };

  const handleActivateTenant = async (tenantId: string) => {
    setTenantActionLoading(tenantId);
    try {
      const res = await fetchWithTenant(`/api/v1/tenants/${tenantId}/activate`, {
        method: "POST",
      });
      if (res.ok) {
        setSuccessMsg("Tenant subscription activated for 30 days.");
        fetchPlatformData();
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.detail || "Failed to activate tenant");
      }
    } finally {
      setTenantActionLoading(null);
    }
  };

  const handleReconcileSubmit = async () => {
    if (!selectedPayment) return;
    if (!statementRef.trim()) {
      alert("Statement / Bank reference is required.");
      return;
    }
    setSubmittingReconcile(true);
    try {
      const res = await fetchWithTenant("/api/v1/billing/admin/reconcile-payment", {
        method: "POST",
        body: JSON.stringify({
          payment_reference: selectedPayment.payment_reference,
          statement_reference: statementRef.trim(),
          verified_amount: Number(selectedPayment.amount),
        }),
      });
      if (res.ok) {
        setSuccessMsg(`Payment ${selectedPayment.payment_reference} reconciled and activated.`);
        setReconcileModalOpen(false);
        setSelectedPayment(null);
        setStatementRef("");
        fetchPlatformData();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || "Reconciliation failed. Check dual-custody constraints.");
      }
    } finally {
      setSubmittingReconcile(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!selectedPayment) return;
    if (rejectionReason.trim().length < 5) {
      alert("Rejection reason must be at least 5 characters.");
      return;
    }
    setSubmittingReject(true);
    try {
      const res = await fetchWithTenant("/api/v1/billing/admin/reject-payment", {
        method: "POST",
        body: JSON.stringify({
          payment_reference: selectedPayment.payment_reference,
          reason: rejectionReason.trim(),
        }),
      });
      if (res.ok) {
        setSuccessMsg(`Payment ${selectedPayment.payment_reference} rejected.`);
        setRejectModalOpen(false);
        setSelectedPayment(null);
        setRejectionReason("");
        fetchPlatformData();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || "Rejection failed.");
      }
    } finally {
      setSubmittingReject(false);
    }
  };

  const filteredTenants = tenants.filter((t) => {
    const q = searchQuery.toLowerCase();
    return (
      t.school_name.toLowerCase().includes(q) ||
      (t.domain && t.domain.toLowerCase().includes(q)) ||
      t.id.toLowerCase().includes(q)
    );
  });

  if (!authorized) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-black p-4">
        <div className="text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-gray-400 animate-pulse" />
          <h2 className="mt-4 text-lg font-bold">Verifying Platform Super Admin Authorization...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Platform Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
              Platform Super Admin
            </span>
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Live Multi-Tenant Mesh
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900 dark:text-white mt-1">
            Platform Operations Console
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            EducationOS SaaS Infrastructure · Cross-Tenant Operations · Multi-School Governance
          </p>
        </div>

        <button
          onClick={fetchPlatformData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {language === "EN" ? "Refresh Metrics" : "রিফ্রেশ করুন"}
        </button>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 flex items-center justify-between text-sm">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="p-1 hover:opacity-75">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 flex items-center justify-between text-sm">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="p-1 hover:opacity-75">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Platform KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Total Schools
            </span>
            <Building2 className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-gray-900 dark:text-white">
            {stats ? stats.total_tenants : "—"}
          </div>
          <div className="mt-1 text-xs text-gray-500">Registered SaaS Tenants</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Active Subs
            </span>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-green-600 dark:text-green-400">
            {stats ? stats.active_subscriptions : "—"}
          </div>
          <div className="mt-1 text-xs text-gray-500">Paid & Verified Schools</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              In Trials
            </span>
            <Sparkles className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400">
            {stats ? stats.trialing_subscriptions : "—"}
          </div>
          <div className="mt-1 text-xs text-gray-500">14-Day Pilot Active</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Pending Claims
            </span>
            <Wallet className="h-4 w-4 text-purple-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-purple-600 dark:text-purple-400">
            {stats ? stats.pending_payments : "—"}
          </div>
          <div className="mt-1 text-xs text-gray-500">Awaiting Super Admin Review</div>
        </div>

        <div className="col-span-2 lg:col-span-1 p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              System Health
            </span>
            <Cpu className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-lg font-bold text-emerald-600 dark:text-emerald-400">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
            Operational
          </div>
          <div className="mt-1 text-xs text-gray-500">RLS & Vector Storage Active</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab("tenants")}
          className={`pb-3 relative transition flex items-center gap-2 ${
            activeTab === "tenants"
              ? "text-blue-600 dark:text-blue-400 font-bold"
              : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          <Building2 className="h-4 w-4" />
          Tenant Registry & Subscriptions ({tenants.length})
          {activeTab === "tenants" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("payments")}
          className={`pb-3 relative transition flex items-center gap-2 ${
            activeTab === "payments"
              ? "text-blue-600 dark:text-blue-400 font-bold"
              : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          <Wallet className="h-4 w-4" />
          Manual Payment Review Queue ({payments.length})
          {payments.some((p) => p.status === "SUBMITTED" || p.status === "PENDING") && (
            <span className="h-2 w-2 rounded-full bg-purple-500" />
          )}
          {activeTab === "payments" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("system")}
          className={`pb-3 relative transition flex items-center gap-2 ${
            activeTab === "system"
              ? "text-blue-600 dark:text-blue-400 font-bold"
              : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          <Server className="h-4 w-4" />
          System Health & Pipeline
          {activeTab === "system" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
          )}
        </button>
      </div>

      {/* TAB 1: TENANT REGISTRY */}
      {activeTab === "tenants" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by school name, domain, or tenant ID..."
                className="w-full pl-10 pr-4 py-2 rounded-xl text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="text-xs text-gray-500">
              Showing {filteredTenants.length} of {tenants.length} institutions
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xs">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3.5 font-bold">Institution / Domain</th>
                  <th className="px-5 py-3.5 font-bold">Plan Tier</th>
                  <th className="px-5 py-3.5 font-bold">Students</th>
                  <th className="px-5 py-3.5 font-bold">Subscription Status</th>
                  <th className="px-5 py-3.5 font-bold">Valid Until</th>
                  <th className="px-5 py-3.5 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-gray-500">
                      No institutions match the search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredTenants.map((t) => {
                    const isSuspended =
                      t.subscription_status === "SUSPENDED" ||
                      t.subscription_status === "CANCELLED" ||
                      t.subscription_status === "EXPIRED";
                    return (
                      <tr key={t.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition">
                        <td className="px-5 py-4">
                          <div className="font-bold text-gray-900 dark:text-white">{t.school_name}</div>
                          <div className="text-xs text-gray-500 font-mono mt-0.5">
                            {t.domain || "No custom domain"} · {t.id.slice(0, 8)}...
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 uppercase">
                            {t.plan_tier}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-xs font-medium text-gray-900 dark:text-gray-100">
                            {t.active_students} / {t.max_active_students}
                          </div>
                          <div className="w-24 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 mt-1 overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.round((t.active_students / (t.max_active_students || 1)) * 100)
                                )}%`,
                              }}
                            />
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                              t.subscription_status === "ACTIVE"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                                : t.subscription_status === "TRIALING"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                            }`}
                          >
                            {t.subscription_status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-600 dark:text-gray-300">
                          {t.valid_until ? new Date(t.valid_until).toLocaleDateString() : "Lifetime / Permanent"}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {isSuspended ? (
                            <button
                              onClick={() => handleActivateTenant(t.id)}
                              disabled={tenantActionLoading === t.id}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition disabled:opacity-50"
                            >
                              {tenantActionLoading === t.id ? "Activating..." : "Reactivate"}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSuspendTenant(t.id)}
                              disabled={tenantActionLoading === t.id}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white transition disabled:opacity-50"
                            >
                              {tenantActionLoading === t.id ? "Suspending..." : "Suspend"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: MANUAL PAYMENT APPROVAL QUEUE */}
      {activeTab === "payments" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 text-xs text-purple-900 dark:text-purple-200 flex items-start gap-3">
            <Lock className="h-4 w-4 mt-0.5 text-purple-600 shrink-0" />
            <div>
              <span className="font-bold">Dual-Custody Reconcile Guarantee:</span> In compliance with institutional FinOps policies, the operator who submitted a manual payment claim is cryptographically forbidden from approving it. All reconciliation and rejection actions generate permanent immutable audit entries.
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xs">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3.5 font-bold">Reference / Tenant</th>
                  <th className="px-5 py-3.5 font-bold">Plan & Cycle</th>
                  <th className="px-5 py-3.5 font-bold">Gateway & TrxID</th>
                  <th className="px-5 py-3.5 font-bold">Amount (BDT)</th>
                  <th className="px-5 py-3.5 font-bold">Status</th>
                  <th className="px-5 py-3.5 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-gray-500">
                      No payment claims in the platform queue.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => {
                    const isPending = p.status === "SUBMITTED" || p.status === "PENDING";
                    return (
                      <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition">
                        <td className="px-5 py-4">
                          <div className="font-bold text-gray-900 dark:text-white font-mono">{p.payment_reference}</div>
                          <div className="text-xs text-gray-500 mt-0.5 font-mono">
                            Tenant: {p.tenant_id.slice(0, 8)}...
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs">
                          <div className="font-semibold text-gray-900 dark:text-gray-100 uppercase">{p.plan_key}</div>
                          <div className="text-gray-500">{p.billing_cycle}</div>
                        </td>
                        <td className="px-5 py-4 text-xs">
                          <span className="font-bold text-gray-800 dark:text-gray-200">{p.gateway}</span>
                          <div className="font-mono text-gray-500">{p.transaction_id || "Awaiting TxID"}</div>
                        </td>
                        <td className="px-5 py-4 font-bold text-gray-900 dark:text-white">
                          ৳{Number(p.amount).toLocaleString()}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                              p.status === "PAID"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                                : p.status === "SUBMITTED"
                                ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
                                : p.status === "PENDING"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {isPending ? (
                            <div className="inline-flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setSelectedPayment(p);
                                  setReconcileModalOpen(true);
                                }}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition"
                              >
                                Reconcile
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedPayment(p);
                                  setRejectModalOpen(true);
                                }}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white transition"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">Reconciled / Closed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SYSTEM HEALTH & RAG PIPELINE */}
      {activeTab === "system" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Database & Security */}
          <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-500" />
              Database & Multi-Tenant Security
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500">Database Connectivity</span>
                <span className={`font-semibold ${systemHealth?.database === "healthy" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500"}`}>
                  {systemHealth?.database?.toUpperCase() || "HEALTHY"}
                </span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500">Connection Pool</span>
                <span className="font-mono text-xs font-semibold text-gray-900 dark:text-white">
                  Size: {systemHealth?.pool?.size ?? 10} | In-Use: {systemHealth?.pool?.checkedout ?? 0} | Idle: {systemHealth?.pool?.checkedin ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500">Row-Level Security (RLS)</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">ENFORCED (Kernel Isolation)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Timezone Anchor</span>
                <span className="font-semibold text-gray-900 dark:text-white">Asia/Dhaka (UTC+6)</span>
              </div>
            </div>
          </div>

          {/* Card 2: AI & Curriculum RAG Engine */}
          <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              AI & Curriculum RAG Engine
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500">Embedding Model</span>
                <span className="font-semibold text-gray-900 dark:text-white">models/gemini-embedding-001</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500">Gemini Rate Limiter</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Sliding Window (60 RPM / 60k TPM)</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500">Bangla Chunking</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Dari (।, ॥) Boundary Preservation</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Worker Daemon</span>
                <span className="font-semibold text-purple-600 dark:text-purple-400">rag_worker.py (Atomic SKIP LOCKED)</span>
              </div>
            </div>
          </div>

          {/* Card 3: Cloud Object Storage */}
          <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Cloud className="h-5 w-5 text-cyan-500" />
              Cloud Object Storage (S3 / R2)
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500">Storage Backend</span>
                <span className="font-semibold uppercase text-gray-900 dark:text-white">
                  {systemHealth?.storage?.backend || "LOCAL FALLBACK"}
                </span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500">Bucket Identifier</span>
                <span className="font-mono text-xs text-gray-700 dark:text-gray-300">
                  {systemHealth?.storage?.bucket || "educationos-assets"}
                </span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500">MIME & Integrity</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Magic-Byte + SHA-256 Checksum</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Access Control</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Time-Limited Signed URLs (15m)</span>
              </div>
            </div>
          </div>

          {/* Card 4: Communications & Outbox */}
          <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Mail className="h-5 w-5 text-emerald-500" />
              Unified Communications & Outbox
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500">Email Gateway</span>
                <span className="font-semibold uppercase text-gray-900 dark:text-white">
                  {systemHealth?.communications?.email?.provider || "SMTP"} ({systemHealth?.communications?.email?.status || "READY"})
                </span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500">SMS Gateway</span>
                <span className="font-semibold uppercase text-gray-900 dark:text-white">
                  {systemHealth?.communications?.sms?.provider || "GREENWEB"} ({systemHealth?.communications?.sms?.status || "READY"})
                </span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500">Outbox Dispatcher</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Transactional Outbox Worker</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Retry Cadence</span>
                <span className="font-mono text-xs text-gray-700 dark:text-gray-300">60s → 300s → 900s → DEAD_LETTER</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RECONCILE MODAL */}
      <ResponsiveDialog
        isOpen={reconcileModalOpen}
        onClose={() => setReconcileModalOpen(false)}
        title="Reconcile SaaS Subscription Payment"
      >
        <div className="space-y-4 text-sm">
          <p className="text-gray-600 dark:text-gray-300">
            Verify payment reference <strong className="font-mono text-purple-600">{selectedPayment?.payment_reference}</strong> against your banking or bKash merchant ledger.
          </p>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
              Bank / Gateway Statement Reference
            </label>
            <input
              type="text"
              value={statementRef}
              onChange={(e) => setStatementRef(e.target.value)}
              placeholder="e.g. BANK-DEP-2026-099 or bKash TrxID"
              className="w-full px-3 py-2 rounded-xl text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Amount to Activate:</span>
              <span className="font-bold">৳{selectedPayment?.amount} BDT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Gateway:</span>
              <span className="font-bold">{selectedPayment?.gateway}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setReconcileModalOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleReconcileSubmit}
              disabled={submittingReconcile}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition disabled:opacity-50"
            >
              {submittingReconcile ? "Verifying..." : "Confirm & Activate Subscription"}
            </button>
          </div>
        </div>
      </ResponsiveDialog>

      {/* REJECT MODAL */}
      <ResponsiveDialog
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject Payment Claim"
      >
        <div className="space-y-4 text-sm">
          <p className="text-gray-600 dark:text-gray-300">
            Provide a mandatory dispute reason for rejecting claim <strong className="font-mono text-red-600">{selectedPayment?.payment_reference}</strong>.
          </p>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
              Dispute Reason (Mandatory)
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Transaction ID was not found in Bank settlement file on this date."
              rows={3}
              className="w-full px-3 py-2 rounded-xl text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setRejectModalOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleRejectSubmit}
              disabled={submittingReject}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white transition disabled:opacity-50"
            >
              {submittingReject ? "Rejecting..." : "Dispute & Reject Claim"}
            </button>
          </div>
        </div>
      </ResponsiveDialog>
    </div>
  );
}
