// frontend/src/components/ai/AIBudgetWarningModal.tsx
'use client';

import React from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const AIBudgetWarningModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-6 w-6" />
          <h3 className="text-base font-semibold">Monthly AI Quota Ceiling Reached</h3>
        </div>

        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          Your institution has reached its allocated generative AI token limit for this billing cycle.
        </p>

        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
          <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Core Functions Unaffected
          </div>
          <p className="mt-1">
            Attendance, Fee Ledger, Exam Marks, and Class Routines continue to work normally.
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
          >
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
};