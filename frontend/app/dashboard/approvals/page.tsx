"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Edit3, Loader2, Send } from "lucide-react";
import { useLanguage } from "@/components/providers";

export default function ApprovalsPage() {
  const { language } = useLanguage();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selected task state for editing
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/approvals/", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setTasks(await res.json());
    } finally {
      setLoading(false);
    }
  };

  // Helper function to create a demo task for testing
  const createDemoTask = async () => {
    const token = localStorage.getItem("token");
    await fetch("http://127.0.0.1:8000/api/v1/approvals/demo", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
    fetchTasks();
  };

  useEffect(() => { fetchTasks(); }, []);

  const handleAction = async (status: "Approved" | "Rejected") => {
    if (!selectedTask) return;
    setActionLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://127.0.0.1:8000/api/v1/approvals/${selectedTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ payload_content: editedContent, status })
      });
      if (res.ok) {
        setSelectedTask(null);
        fetchTasks();
      }
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            {language === "EN" ? "Action Center" : "অ্যাকশন সেন্টার"}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {language === "EN" ? "Review, edit, and approve AI-generated operations." : "এআই জেনারেটেড কাজগুলো রিভিউ, এডিট এবং অ্যাপ্রুভ করুন।"}
          </p>
        </div>
        
        {/* DEV BUTTON: Creates a fake task to test UI */}
        <button onClick={createDemoTask} className="bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-white/20 transition-colors border border-gray-200 dark:border-white/10">
          + Generate Demo Task
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left List: Pending Queue */}
        <div className="lg:col-span-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
            {language === "EN" ? "Pending Approvals" : "অপেক্ষমাণ কাজ"}
          </h3>
          
          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-purple-500" /></div>
            ) : tasks.length === 0 ? (
              <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl p-8 text-center text-gray-500 dark:text-gray-400 shadow-sm">
                {language === "EN" ? "Queue is empty. You're all caught up!" : "কোনো কাজ অপেক্ষমাণ নেই!"}
              </div>
            ) : (
              tasks.map(task => (
                <div 
                  key={task.id} 
                  onClick={() => { setSelectedTask(task); setEditedContent(task.payload_content); }}
                  className={`p-5 rounded-2xl cursor-pointer transition-all border shadow-sm ${
                    selectedTask?.id === task.id 
                      ? "bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/30" 
                      : "bg-white dark:bg-[#0f0f11] border-gray-200 dark:border-white/10 hover:border-purple-300 dark:hover:border-purple-500/30"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${
                      task.risk_level === "High" ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20" : "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/20"
                    }`}>
                      {task.risk_level} Risk
                    </span>
                    <span className="text-xs text-gray-400">Just now</span>
                  </div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">{task.title}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1">
                    <AlertTriangle size={12} /> AI generated draft
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel: Review & Edit Editor */}
        <div className="lg:col-span-7">
          {selectedTask ? (
            <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 shadow-sm sticky top-6 animate-in slide-in-from-right-4 duration-300">
              
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100 dark:border-white/10">
                <div className="p-3 bg-purple-50 dark:bg-purple-500/10 rounded-xl border border-purple-100 dark:border-purple-500/20">
                  <Edit3 className="text-purple-600 dark:text-purple-400" size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedTask.title}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Review and modify the AI draft before execution.</p>
                </div>
              </div>

              <div className="space-y-3 mb-8">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Payload Content (Editable)</label>
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  rows={8}
                  className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-2xl p-4 text-sm text-gray-900 dark:text-white outline-none focus:border-purple-500 transition-colors resize-none leading-relaxed"
                />
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => handleAction("Approved")}
                  disabled={actionLoading}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl text-sm font-semibold transition-colors flex justify-center items-center gap-2 shadow-sm"
                >
                  {actionLoading ? <Loader2 className="animate-spin" size={18} /> : <><CheckCircle2 size={18} /> Approve & Execute</>}
                </button>
                <button 
                  onClick={() => handleAction("Rejected")}
                  disabled={actionLoading}
                  className="flex-1 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 py-3 rounded-xl text-sm font-semibold transition-colors border border-red-200 dark:border-red-500/20 flex justify-center items-center gap-2"
                >
                  <XCircle size={18} /> Reject
                </button>
              </div>

            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl shadow-sm text-gray-400">
              <Send size={48} className="mb-4 opacity-20" />
              <p>{language === "EN" ? "Select a task from the queue to review." : "রিভিউ করার জন্য একটি কাজ নির্বাচন করুন।"}</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}