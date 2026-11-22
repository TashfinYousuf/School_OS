// frontend/components/AcademySetupWizard.tsx
"use client";

import { useState } from "react";
import { useWorkspace } from "@/lib/workspaceContext";
import { GraduationCap, Sparkles, Check, X, Loader2 } from "lucide-react";

export default function AcademySetupWizard({ onClose }: { onClose: () => void }) {
  const { currentWorkspace, enableAcademyModule } = useWorkspace();
  const [academyName, setAcademyName] = useState(`${currentWorkspace.name} Academic Care`);
  const [code, setCode] = useState("FAC-ACAD");
  const [loading, setLoading] = useState(false);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const success = await enableAcademyModule(academyName, code);
    setLoading(false);
    if (success) {
      alert("Academy & Coaching Workspace provisioned successfully!");
      onClose();
      window.location.reload();
    } else {
      alert("Failed to provision Academy. Check administrator permissions.");
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0f0f11] border border-white/10 text-white rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-2xl">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-purple-600/20 text-purple-400 rounded-2xl border border-purple-500/30">
              <GraduationCap size={22} />
            </div>
            <div>
              <h3 className="font-bold text-base">Setup AcademyOS Workspace</h3>
              <p className="text-xs text-gray-400">Coaching, Model Tests & Admission Care Engine</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleActivate} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-gray-400">Academy / Coaching Center Name</label>
            <input
              required
              value={academyName}
              onChange={(e) => setAcademyName(e.target.value)}
              className="w-full mt-1.5 p-3 bg-white/5 border border-white/10 rounded-xl outline-none font-bold text-white focus:border-purple-500"
            />
          </div>

          <div>
            <label className="font-semibold text-gray-400">Branch Identifier Code</label>
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full mt-1.5 p-3 bg-white/5 border border-white/10 rounded-xl outline-none font-mono text-white focus:border-purple-500"
            />
          </div>

          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-300 text-[11px] space-y-1">
            <div className="font-bold flex items-center gap-1.5"><Sparkles size={13} /> Features Activated:</div>
            <div>• Live MCQ Exams with -0.25 Negative Marking</div>
            <div>• Merit Leaderboards & Percentile Scoring</div>
            <div>• Separate Batch Enrollments & Coaching Fees</div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 font-bold rounded-xl"
            >
              Skip (School Only)
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              <span>Activate Academy</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}