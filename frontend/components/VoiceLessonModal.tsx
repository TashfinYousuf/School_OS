"use client";

import { useState } from "react";
import { Mic, MicOff, Loader2, Sparkles, CheckCircle2, X } from "lucide-react";
import { fetchWithTenant } from "@/lib/api-client";

export default function VoiceLessonModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [recording, setRecording] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [syncResult, setSyncResult] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleSimulatedVoiceInput = () => {
    setRecording(true);
    setTimeout(() => {
      setRecording(false);
      setTranscription("Class 5 Mathematics Chapter 3 Fractions. Taught addition and common denominators. Solved 4 exercises on board. Homework assigned: Exercise 3.2 Question 1 to 5.");
    }, 1500);
  };

  const handleSyncToRAG = async () => {
    if (!transcription) return;
    setSubmitting(true);
    try {
      const res = await fetchWithTenant("/api/v1/teacher-os/voice-diary-sync", {
        method: "POST",
        body: JSON.stringify({
          class_name: "Class 5",
          subject: "Mathematics",
          teacher_name: localStorage.getItem("user_name") || "Teacher",
          transcription_text: transcription
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSyncResult(data.extracted);
      }
    } catch (err) {
      alert("Voice-to-Diary Engine Error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
        
        <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-white/10">
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles size={18} className="text-purple-600" /> Voice-to-Diary & Curriculum RAG
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
        </div>

        <p className="text-xs text-gray-500">
          Speak your daily lesson log in English or Bangla. Gemini 2.5 Flash extracts topics and tracks NCTB syllabus pacing.
        </p>

        <div className="flex justify-center py-4">
          <button
            type="button"
            onClick={handleSimulatedVoiceInput}
            className={`p-5 rounded-full shadow-lg transition-all ${
              recording 
                ? "bg-red-600 text-white animate-pulse" 
                : "bg-purple-600 hover:bg-purple-700 text-white"
            }`}
          >
            {recording ? <MicOff size={24} /> : <Mic size={24} />}
          </button>
        </div>

        <textarea
          rows={3}
          value={transcription}
          onChange={(e) => setTranscription(e.target.value)}
          placeholder="Transcription appears here or type manually..."
          className="w-full p-3 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-xs outline-none"
        />

        {syncResult && (
          <div className="p-3.5 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-2xl text-xs space-y-1 text-green-800 dark:text-green-300 font-mono">
            <div className="font-bold flex items-center gap-1.5"><CheckCircle2 size={14} /> Synced to Anti-Drift Engine</div>
            <div>Topic: {syncResult.topic}</div>
            <div>Homework: {syncResult.homework}</div>
            <div>Status: <span className="underline">{syncResult.curriculum_drift_status}</span></div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-gray-500">
            Close
          </button>
          <button
            type="button"
            onClick={handleSyncToRAG}
            disabled={submitting || !transcription}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Sync to Curriculum
          </button>
        </div>

      </div>
    </div>
  );
}