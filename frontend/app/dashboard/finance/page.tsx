"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/providers";
import { 
  Wallet, Receipt, Plus, Search, Printer, 
  Save, Loader2, CheckCircle2, X, CreditCard, 
  Smartphone, Building2, Coins, ArrowUpRight 
} from "lucide-react";

interface PaymentItem {
  id: string;
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
  admission_number: string;
  class_name: string;
}

export default function FeeLedgerPage() {
  const { language } = useLanguage();
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [summary, setSummary] = useState({ collected_today: 0, transactions_today: 0, total_revenue: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  
  // Multi-Gateway Form State
  const [formData, setFormData] = useState({
    fee_type: "Monthly Tuition Fee",
    billing_month: "September 2026",
    amount_paid: 1500,
    currency: "BDT",
    discount: 0,
    payment_method: "bKash",
    transaction_id: "",
    sender_number_or_wallet: "",
    remarks: ""
  });

  const [receiptToPrint, setReceiptToPrint] = useState<any | null>(null);

  const fetchFinanceData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const [sumRes, payRes] = await Promise.all([
        fetch("http://127.0.0.1:8000/api/v1/finance/summary", { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`http://127.0.0.1:8000/api/v1/finance/payments?search=${encodeURIComponent(search)}`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (sumRes.ok) setSummary(await sumRes.json());
      if (payRes.ok) setPayments(await payRes.json());
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/students/", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStudents(data);
        if (data.length > 0) setSelectedStudentId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchFinanceData();
  }, [search]);

  useEffect(() => {
    if (isCollectModalOpen) fetchStudents();
  }, [isCollectModalOpen]);

  const handleCollectFeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) return;
    setSubmitting(true);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/finance/collect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          student_id: selectedStudentId,
          ...formData
        })
      });

      if (res.ok) {
        const data = await res.json();
        setIsCollectModalOpen(false);
        fetchFinanceData();
        setReceiptToPrint(data.receipt);
        // Reset TrxID
        setFormData(prev => ({ ...prev, transaction_id: "", sender_number_or_wallet: "" }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Screen View */}
      <div className="print:hidden space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-white/10 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <Wallet className="text-green-600 dark:text-green-400" />
              <span>{language === "EN" ? "Fee Collection & Multi-Gateway Ledger" : "ফি আদায় ও মাল্টি-গেটওয়ে ক্যাশ লেজার"}</span>
            </h1>
            <p className="text-xs text-gray-500 mt-1">Real-time tuition fee tracking with bKash, Nagad, Bank, and Crypto receipt generation.</p>
          </div>

          <button
            onClick={() => setIsCollectModalOpen(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
          >
            <Plus size={16} />
            <span>{language === "EN" ? "Receive Payment" : "ফি জমা নিন"}</span>
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-5 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Today's Collection</span>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
              ৳{summary.collected_today.toLocaleString()}
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">{summary.transactions_today} payments today</p>
          </div>

          <div className="p-5 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Revenue Base</span>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              ৳{summary.total_revenue.toLocaleString()}
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">Recorded cash flow</p>
          </div>

          <div className="sm:col-span-2 p-5 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Supported Direct Gateways</span>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300">Cash Counter</span>
              <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-pink-50 text-pink-700 dark:bg-pink-500/10 dark:text-pink-400">bKash (017... TrxID)</span>
              <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400">Nagad</span>
              <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">Bank Transfer</span>
              <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">USDT / Crypto</span>
            </div>
          </div>
        </div>

        {/* Search Input */}
        <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl flex items-center px-4 py-2.5 shadow-sm max-w-md">
          <Search className="text-gray-400 mr-2" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student, ID, receipt, or TrxID..."
            className="w-full bg-transparent text-xs text-gray-900 dark:text-white outline-none"
          />
        </div>

        {/* Payments Table */}
        <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-gray-500 flex justify-center items-center gap-2">
              <Loader2 className="animate-spin text-green-600" size={20} /> Loading records...
            </div>
          ) : payments.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-xs">No transactions recorded yet.</div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/10 text-gray-500 uppercase font-bold text-[10px]">
                <tr>
                  <th className="p-3.5">Receipt No</th>
                  <th className="p-3.5">Student</th>
                  <th className="p-3.5">Method</th>
                  <th className="p-3.5">TrxID / Reference</th>
                  <th className="p-3.5">Fee & Month</th>
                  <th className="p-3.5">Amount</th>
                  <th className="p-3.5 text-right">Receipt Slip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                    <td className="p-3.5 font-mono font-bold text-gray-700 dark:text-gray-300">{p.receipt_no}</td>
                    <td className="p-3.5">
                      <div className="font-semibold text-gray-900 dark:text-white">{p.student_name}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{p.class_name} • ID: {p.admission_number}</div>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        p.payment_method === "bKash" ? "bg-pink-50 text-pink-700 dark:bg-pink-500/10" :
                        p.payment_method === "Nagad" ? "bg-orange-50 text-orange-700 dark:bg-orange-500/10" :
                        p.payment_method === "Crypto" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10" :
                        p.payment_method === "Bank" ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10" :
                        "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300"
                      }`}>
                        {p.payment_method}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-[11px] text-gray-600 dark:text-gray-400">
                      <div>{p.transaction_id}</div>
                      {p.sender_number_or_wallet && p.sender_number_or_wallet !== "N/A" && (
                        <div className="text-[10px] text-gray-400">From: {p.sender_number_or_wallet}</div>
                      )}
                    </td>
                    <td className="p-3.5 text-gray-600 dark:text-gray-300">
                      <div>{p.fee_type}</div>
                      <div className="text-[10px] text-gray-400">{p.billing_month}</div>
                    </td>
                    <td className="p-3.5 font-bold font-mono text-green-600 dark:text-green-400">
                      {p.currency === "USDT" ? `$${p.amount_paid}` : `৳${p.amount_paid}`}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => {
                          setReceiptToPrint({
                            receipt_no: p.receipt_no,
                            transaction_id: p.transaction_id,
                            school_name: "Kids Shine International School",
                            school_address: "Kandirpar, Cumilla, Bangladesh",
                            student_name: p.student_name,
                            admission_number: p.admission_number,
                            class_name: p.class_name,
                            fee_type: p.fee_type,
                            billing_month: p.billing_month,
                            amount_paid: p.amount_paid,
                            currency: p.currency,
                            payment_method: p.payment_method,
                            sender_ref: p.sender_number_or_wallet,
                            date: new Date(p.payment_date).toLocaleDateString()
                          });
                        }}
                        className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 text-[11px] font-medium inline-flex items-center gap-1"
                      >
                        <Printer size={12} /> Print
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Receive Payment Modal */}
      {isCollectModalOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
            
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-white/10">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Receipt className="text-green-600" size={18} /> Record Student Fee Payment
              </h3>
              <button onClick={() => setIsCollectModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <form onSubmit={handleCollectFeeSubmit} className="space-y-4 text-xs">
              
              {/* Select Student */}
              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-300">Select Enrolled Student *</label>
                <select
                  required
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs text-gray-900 dark:text-white outline-none"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.first_name} {s.last_name} ({s.class_name} • ID: {s.admission_number})
                    </option>
                  ))}
                </select>
              </div>

              {/* Gateway Selector Tabs */}
              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">Payment Gateway / Channel *</label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {[
                    { id: "Cash", label: "Cash Desk", icon: Wallet },
                    { id: "bKash", label: "bKash", icon: Smartphone },
                    { id: "Nagad", label: "Nagad", icon: Smartphone },
                    { id: "Bank", label: "Bank Wire", icon: Building2 },
                    { id: "Crypto", label: "USDT/Web3", icon: Coins }
                  ].map((gw) => {
                    const Icon = gw.icon;
                    return (
                      <button
                        key={gw.id}
                        type="button"
                        onClick={() => setFormData({ 
                          ...formData, 
                          payment_method: gw.id, 
                          currency: gw.id === "Crypto" ? "USDT" : "BDT" 
                        })}
                        className={`py-2 px-1.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                          formData.payment_method === gw.id
                            ? "bg-green-50 dark:bg-green-500/10 border-green-600 text-green-700 dark:text-green-400 font-bold"
                            : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        <Icon size={14} />
                        <span className="text-[10px]">{gw.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Gateway Inputs */}
              {formData.payment_method !== "Cash" && (
                <div className="p-3 bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-2xl space-y-3">
                  <div className="text-[11px] font-bold text-green-700 dark:text-green-400 flex items-center justify-between">
                    <span>{formData.payment_method} Transaction Proof</span>
                    <span className="text-[10px] font-mono bg-green-100 dark:bg-green-500/20 px-2 py-0.5 rounded">Required for Audit</span>
                  </div>

                  <div>
                    <label className="text-gray-600 dark:text-gray-400">
                      {formData.payment_method === "Crypto" ? "Crypto TxHash *" : `${formData.payment_method} TrxID / Ref Number *`}
                    </label>
                    <input
                      required
                      value={formData.transaction_id}
                      onChange={(e) => setFormData({...formData, transaction_id: e.target.value})}
                      placeholder={
                        formData.payment_method === "Crypto" ? "e.g. 0x8a92... or TRC20 TxHash" : 
                        formData.payment_method === "bKash" ? "e.g. 9J4K2L8P" : "e.g. 7X8Y9Z10"
                      }
                      className="w-full mt-1 bg-white dark:bg-black/50 border border-gray-200 dark:border-white/10 rounded-xl p-2 font-mono text-xs text-gray-900 dark:text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-gray-600 dark:text-gray-400">
                      {formData.payment_method === "Crypto" ? "Sender Wallet / Network" : "Sender Mobile Number / Bank A/C"}
                    </label>
                    <input
                      value={formData.sender_number_or_wallet}
                      onChange={(e) => setFormData({...formData, sender_number_or_wallet: e.target.value})}
                      placeholder={formData.payment_method === "Crypto" ? "e.g. Polygon / TRC20" : "e.g. 017XXXXXXXX"}
                      className="w-full mt-1 bg-white dark:bg-black/50 border border-gray-200 dark:border-white/10 rounded-xl p-2 text-xs text-gray-900 dark:text-white outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Fee Categories */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-700 dark:text-gray-300">Fee Category *</label>
                  <select
                    value={formData.fee_type}
                    onChange={(e) => setFormData({...formData, fee_type: e.target.value})}
                    className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs text-gray-900 dark:text-white outline-none"
                  >
                    <option value="Monthly Tuition Fee">Monthly Tuition Fee</option>
                    <option value="Admission / Session Fee">Admission / Session Fee</option>
                    <option value="Exam Fee">Exam Fee</option>
                    <option value="Book & Stationery">Book & Stationery</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-gray-700 dark:text-gray-300">Billing Month *</label>
                  <input
                    required
                    value={formData.billing_month}
                    onChange={(e) => setFormData({...formData, billing_month: e.target.value})}
                    className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs text-gray-900 dark:text-white outline-none"
                    placeholder="e.g. September 2026"
                  />
                </div>
              </div>

              {/* Amount & Currency */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-700 dark:text-gray-300">Amount Received *</label>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      required
                      value={formData.amount_paid}
                      onChange={(e) => setFormData({...formData, amount_paid: parseFloat(e.target.value) || 0})}
                      className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs font-bold text-green-600 outline-none"
                    />
                    <span className="absolute right-3 top-2.5 font-bold text-gray-400">{formData.currency}</span>
                  </div>
                </div>
                <div>
                  <label className="font-semibold text-gray-700 dark:text-gray-300">Fee Waiver / Discount</label>
                  <input
                    type="number"
                    value={formData.discount}
                    onChange={(e) => setFormData({...formData, discount: parseFloat(e.target.value) || 0})}
                    className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs text-gray-900 dark:text-white outline-none"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-white/10">
                <button type="button" onClick={() => setIsCollectModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-gray-500">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Confirm Payment & Print Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= OFFICIAL MONEY RECEIPT (A4 / SLIP) ================= */}
      {receiptToPrint && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm print:p-0 print:static print:bg-transparent">
          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl w-full max-w-lg p-6 shadow-2xl print:border-none print:shadow-none print:p-0 print:max-w-none">
            
            <div className="flex justify-between items-center pb-3 mb-4 border-b border-gray-100 dark:border-white/10 print:hidden">
              <span className="text-xs font-bold text-gray-400">Institutional Money Receipt Ready</span>
              <div className="flex items-center gap-2">
                <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm">
                  <Printer size={13} /> Print/Save Receipt
                </button>
                <button onClick={() => setReceiptToPrint(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
              </div>
            </div>

            {/* Official Printable Voucher Body */}
            <div className="font-serif text-black p-6 bg-white border-2 border-black rounded-xl print:border-black print:p-0 text-xs leading-normal">
              
              {/* Header */}
              <div className="text-center border-b-2 border-black pb-3 mb-3">
                <h2 className="text-lg font-black uppercase tracking-wider">{receiptToPrint.school_name}</h2>
                <p className="text-[10px] text-gray-700 italic">{receiptToPrint.school_address}</p>
                <div className="mt-1.5 font-sans font-bold uppercase text-[9px] bg-black text-white px-3 py-0.5 inline-block rounded">
                  Student Fee Money Receipt (Official)
                </div>
              </div>

              {/* Receipt & Verification Bar */}
              <div className="flex justify-between font-mono text-[10px] mb-3 bg-gray-50 p-2 border border-gray-300">
                <div>
                  <div>Receipt: <strong>{receiptToPrint.receipt_no}</strong></div>
                  <div>TrxID: <strong>{receiptToPrint.transaction_id}</strong></div>
                </div>
                <div className="text-right">
                  <div>Date: {receiptToPrint.date}</div>
                  <div>Channel: <strong>{receiptToPrint.payment_method}</strong></div>
                </div>
              </div>

              {/* Student & Fee Meta */}
              <div className="space-y-1.5 border-y border-dashed border-gray-400 py-3 mb-3">
                <div className="flex justify-between">
                  <span>Student Name: <strong>{receiptToPrint.student_name}</strong></span>
                  <span>Class: <strong>{receiptToPrint.class_name}</strong></span>
                </div>
                <div className="flex justify-between">
                  <span>Admission ID: <strong>{receiptToPrint.admission_number}</strong></span>
                  <span>Roll: <strong>{receiptToPrint.roll_number}</strong></span>
                </div>
                <div>Description: <strong>{receiptToPrint.fee_type} ({receiptToPrint.billing_month})</strong></div>
                {receiptToPrint.sender_ref && receiptToPrint.sender_ref !== "N/A" && (
                  <div>Sender Account/Ref: <strong>{receiptToPrint.sender_ref}</strong></div>
                )}
              </div>

              {/* Total Box */}
              <div className="flex justify-between items-center bg-gray-100 p-2.5 text-sm font-black border border-black mb-8">
                <span>Total Amount Paid:</span>
                <span>{receiptToPrint.currency === "USDT" ? `$${receiptToPrint.amount_paid}` : `৳${receiptToPrint.amount_paid}`}</span>
              </div>

              {/* Signatures */}
              <div className="flex justify-between pt-8 text-[10px]">
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

    </div>
  );
}