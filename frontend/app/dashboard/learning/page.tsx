"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/components/providers";
import { fetchWithTenant } from "@/lib/api-client";
import {
  BrainCircuit,
  Timer,
  BookOpen,
  Layers,
  BarChart3,
  Sparkles,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Flame,
  Award,
  HelpCircle,
  Lightbulb,
  Paperclip,
  Image as ImageIcon,
  Trash2,
  MessageSquare,
  History,
  FileText,
} from "lucide-react";

type ActiveTab = "tutor" | "study-room" | "practice" | "flashcards" | "analytics";

interface Flashcard {
  id: string;
  subject: string;
  front_prompt: string;
  back_explanation: string;
  box_level: number;
}

interface QuizQuestion {
  question_id: string;
  question_text: string;
  options: string[];
}

interface AnalyticsData {
  total_study_minutes: number;
  study_sessions_count: number;
  practice_attempts_count: number;
  average_accuracy_percentage: number;
  daily_streak_days: number;
  subject_breakdown: Record<string, number>;
}

interface StudySessionItem {
  id: string;
  subject?: string;
  topic?: string;
  duration_minutes?: number;
}

interface QuizReviewItem {
  question_id: string;
  is_correct: boolean;
  explanation?: string;
}

interface QuizResultData {
  score: number;
  total_questions: number;
  accuracy_percentage: number;
  review?: QuizReviewItem[];
}

interface FlashcardApiItem {
  id: string;
  subject: string;
  front_prompt?: string;
  front?: string;
  back_explanation?: string;
  back?: string;
  box_level?: number;
  mastery_level?: number;
}

interface ConversationItem {
  id: string;
  subject: string;
  topic?: string;
  title: string;
  mode: string;
  created_at: string;
  updated_at: string;
}

interface MessageItem {
  id?: string;
  role: "user" | "tutor";
  text: string;
  step?: string;
  attachment_url?: string;
  attachment_type?: string;
  created_at?: string;
}

export default function StudentLearningStudioPage() {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<ActiveTab>("tutor");

  // 1. Socratic Tutor State
  const [subject, setSubject] = useState("Mathematics");
  const [problemText, setProblemText] = useState("");
  const [studentStep, setStudentStep] = useState("");
  const [tutorLoading, setTutorLoading] = useState(false);
  const [tutorMessages, setTutorMessages] = useState<MessageItem[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [convLoading, setConvLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedPreview, setAttachedPreview] = useState<string | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  // 2. Study Room State
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerMode, setTimerMode] = useState<"focus" | "break" | "deep">("focus");
  const [studyTopic, setStudyTopic] = useState("");
  const [studyNotes, setStudyNotes] = useState("");
  const [sessionSaving, setSessionSaving] = useState(false);
  const [completedSessions, setCompletedSessions] = useState<StudySessionItem[]>([]);

  // 3. Practice Quiz State
  const [quizSubject, setQuizSubject] = useState("Mathematics");
  const [quizTopic, setQuizTopic] = useState("Algebra");
  const [quizClass, setQuizClass] = useState("Class 8");
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizResult, setQuizResult] = useState<QuizResultData | null>(null);

  // 4. Flashcards State
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [newFront, setNewFront] = useState("");
  const [newBack, setNewBack] = useState("");
  const [cardSubject, setCardSubject] = useState("Mathematics");
  const [showAddCard, setShowAddCard] = useState(false);

  // 5. Analytics State
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const res = await fetchWithTenant("/api/v1/learning-os/analytics");
      if (res.ok) {
        const data = await res.json();
        const a = data.analytics || data;
        setAnalytics({
          total_study_minutes:
            a.total_study_minutes ?? Math.round((a.total_study_hours || 0) * 60),
          study_sessions_count:
            a.study_sessions_count ?? a.completed_sessions_count ?? 0,
          practice_attempts_count:
            a.practice_attempts_count ?? a.total_practice_questions ?? 0,
          average_accuracy_percentage:
            a.average_accuracy_percentage ?? a.accuracy_percentage ?? 0,
          daily_streak_days:
            a.daily_streak_days ?? a.study_streak_days ?? 0,
          subject_breakdown: a.subject_breakdown || {},
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const fetchStudySessions = async () => {
    try {
      const res = await fetchWithTenant("/api/v1/learning-os/study-room/sessions");
      if (res.ok) {
        const data = await res.json();
        setCompletedSessions(data.sessions || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFlashcards = async () => {
    setCardsLoading(true);
    try {
      const res = await fetchWithTenant("/api/v1/learning-os/flashcards");
      if (res.ok) {
        const data = await res.json();
        setFlashcards(
          (Array.isArray(data) ? data : []).map((c: FlashcardApiItem) => ({
            id: c.id,
            subject: c.subject,
            front_prompt: c.front_prompt || c.front || "",
            back_explanation: c.back_explanation || c.back || "",
            box_level: c.box_level ?? c.mastery_level ?? 0,
          }))
        );
      }
    } finally {
      setCardsLoading(false);
    }
  };

  const handleFinishSession = async () => {
    setSessionSaving(true);
    const durationMin =
      timerMode === "focus" ? 25 : timerMode === "deep" ? 50 : 5;
    try {
      const res = await fetchWithTenant("/api/v1/learning-os/study-room/session", {
        method: "POST",
        body: JSON.stringify({
          subject: subject || "General Study",
          topic: studyTopic || "Independent Learning",
          mode: timerMode,
          duration_seconds: durationMin * 60,
          notes: studyNotes || undefined,
        }),
      });
      if (res.ok) {
        await res.json();
        setStudyNotes("");
        void fetchStudySessions();
        void fetchAnalytics();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSessionSaving(false);
    }
  };

  const fetchConversations = async (targetSubject?: string) => {
    setConvLoading(true);
    try {
      const q = targetSubject ? `?subject=${encodeURIComponent(targetSubject)}` : "";
      const res = await fetchWithTenant(`/api/v1/learning-os/conversations${q}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Failed to fetch conversations:", e);
    } finally {
      setConvLoading(false);
    }
  };

  const loadConversation = async (convId: string) => {
    setActiveConvId(convId);
    setTutorLoading(true);
    try {
      const res = await fetchWithTenant(`/api/v1/learning-os/conversations/${convId}/messages`);
      if (res.ok) {
        const msgs = await res.json();
        setTutorMessages(
          msgs.map((m: any) => ({
            id: m.id,
            role: m.sender_role === "student" ? "user" : "tutor",
            text: m.content,
            attachment_url: m.attachment_url,
            attachment_type: m.attachment_type,
            created_at: m.created_at,
          }))
        );
      }
    } catch (e) {
      console.error("Failed to load messages:", e);
    } finally {
      setTutorLoading(false);
    }
  };

  const startNewConversation = () => {
    setActiveConvId(null);
    setTutorMessages([]);
    setProblemText("");
    setStudentStep("");
    setAttachedFile(null);
    setAttachedPreview(null);
  };

  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetchWithTenant(`/api/v1/learning-os/conversations/${convId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== convId));
        if (activeConvId === convId) {
          startNewConversation();
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachedFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setAttachedPreview(file.name);
    }
  };

  // Initial load
  useEffect(() => {
    queueMicrotask(() => {
      void fetchFlashcards();
      void fetchStudySessions();
      void fetchAnalytics();
      void fetchConversations(subject);
    });
  }, []);

  useEffect(() => {
    void fetchConversations(subject);
  }, [subject]);

  // Timer Tick
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (timerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0 && timerRunning) {
      const t = setTimeout(() => {
        setTimerRunning(false);
        void handleFinishSession();
      }, 0);
      return () => clearTimeout(t);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerRunning, timerSeconds]);

  // Handle Socratic Tutor Message
  const handleAskTutor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!problemText.trim() && !attachedFile) return;

    let uploadedUrl: string | undefined = undefined;
    let uploadedType: string | undefined = undefined;

    setTutorLoading(true);

    try {
      // 1. Upload attachment if selected
      if (attachedFile) {
        setUploadingAttachment(true);
        const formData = new FormData();
        formData.append("file", attachedFile);
        const upRes = await fetchWithTenant("/api/v1/learning-os/upload-attachment", {
          method: "POST",
          body: formData,
        });
        if (upRes.ok) {
          const upData = await upRes.json();
          uploadedUrl = upData.attachment_url;
          uploadedType = upData.attachment_type;
        }
        setUploadingAttachment(false);
      }

      // 2. Ensure active conversation exists
      let currentConvId = activeConvId;
      if (!currentConvId) {
        const convRes = await fetchWithTenant("/api/v1/learning-os/conversations", {
          method: "POST",
          body: JSON.stringify({
            subject,
            topic: problemText.slice(0, 30) || "Study Session",
            title: `${subject}: ${(problemText || attachedFile?.name || "Problem").slice(0, 40)}`,
            mode: "socratic_tutor",
          }),
        });
        if (convRes.ok) {
          const newConv = await convRes.json();
          currentConvId = newConv.id;
          setActiveConvId(newConv.id);
          setConversations((prev) => [newConv, ...prev]);
        }
      }

      const textToSend = studentStep
        ? `${problemText}\n\n[Student attempted: ${studentStep}]`
        : problemText;

      const userEntry: MessageItem = {
        role: "user",
        text: textToSend,
        step: studentStep,
        attachment_url: attachedPreview || uploadedUrl,
        attachment_type: uploadedType,
      };
      setTutorMessages((prev) => [...prev, userEntry]);
      setProblemText("");
      setStudentStep("");
      setAttachedFile(null);
      setAttachedPreview(null);

      // 3. Send message to conversation chat endpoint
      if (currentConvId) {
        const chatRes = await fetchWithTenant(`/api/v1/learning-os/conversations/${currentConvId}/chat`, {
          method: "POST",
          body: JSON.stringify({
            content: textToSend,
            attachment_url: uploadedUrl,
            attachment_type: uploadedType,
          }),
        });

        if (chatRes.ok) {
          const chatData = await chatRes.json();
          setTutorMessages((prev) => [
            ...prev,
            {
              id: chatData.id,
              role: "tutor",
              text: chatData.content,
              created_at: chatData.created_at,
            },
          ]);
          void fetchConversations(subject);
        } else {
          const err = await chatRes.json().catch(() => ({}));
          setTutorMessages((prev) => [
            ...prev,
            {
              role: "tutor",
              text: err.detail || "Could not connect to Socratic Tutor. Please verify your network or quota.",
            },
          ]);
        }
      }
    } catch {
      setTutorMessages((prev) => [
        ...prev,
        {
          role: "tutor",
          text: "An error occurred while contacting the tutor service.",
        },
      ]);
    } finally {
      setTutorLoading(false);
      setUploadingAttachment(false);
    }
  };

  // Study Timer Controls
  const setPreset = (mode: "focus" | "break" | "deep") => {
    setTimerRunning(false);
    setTimerMode(mode);
    if (mode === "focus") setTimerSeconds(25 * 60);
    else if (mode === "break") setTimerSeconds(5 * 60);
    else if (mode === "deep") setTimerSeconds(50 * 60);
  };

  // Practice Quiz
  const handleGenerateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuizLoading(true);
    setQuizResult(null);
    setQuizAnswers({});

    try {
      const res = await fetchWithTenant("/api/v1/learning-os/practice/generate-quiz", {
        method: "POST",
        body: JSON.stringify({
          subject: quizSubject,
          topic: quizTopic,
          difficulty: quizClass.toLowerCase().includes("9") || quizClass.toLowerCase().includes("10") ? "hard" : "medium",
          count: 5,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setQuizQuestions(data.questions || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setQuizLoading(false);
    }
  };

  const handleSubmitQuiz = async () => {
    if (Object.keys(quizAnswers).length < quizQuestions.length) {
      alert("Please select an answer for all questions before submitting.");
      return;
    }

    try {
      const res = await fetchWithTenant("/api/v1/learning-os/practice/submit-quiz", {
        method: "POST",
        body: JSON.stringify({
          subject: quizSubject,
          topic: quizTopic,
          questions: quizQuestions,
          answers: quizAnswers,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setQuizResult(data);
        fetchAnalytics();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFront.trim() || !newBack.trim()) return;

    try {
      const res = await fetchWithTenant("/api/v1/learning-os/flashcards", {
        method: "POST",
        body: JSON.stringify({
          subject: cardSubject,
          front_prompt: newFront,
          back_explanation: newBack,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setFlashcards((prev) => [
          {
            id: created.id,
            subject: created.subject,
            front_prompt: created.front_prompt || created.front,
            back_explanation: created.back_explanation || created.back,
            box_level: created.box_level ?? created.mastery_level ?? 0,
          },
          ...prev,
        ]);
        setNewFront("");
        setNewBack("");
        setShowAddCard(false);
        void fetchAnalytics();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReviewCard = async (recalled: boolean) => {
    const card = flashcards[activeCardIndex];
    if (!card) return;
    try {
      const res = await fetchWithTenant(`/api/v1/learning-os/flashcards/${card.id}/review`, {
        method: "PATCH",
        body: JSON.stringify({ recalled }),
      });
      if (res.ok) {
        const upd = await res.json();
        setFlashcards((prev) =>
          prev.map((c) => (c.id === card.id ? { ...c, box_level: upd.box_level ?? upd.mastery_level ?? c.box_level } : c))
        );
        setIsFlipped(false);
        if (activeCardIndex < flashcards.length - 1) {
          setActiveCardIndex((prev) => prev + 1);
        }
        fetchAnalytics();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Timer Controls
  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-white/10 pb-5">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 bg-purple-50 dark:bg-purple-500/10 px-2.5 py-1 rounded-full">
            Autonomous Student Learning Studio
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-1 flex items-center gap-2">
            <BrainCircuit className="text-purple-600" size={26} />
            <span>
              {language === "EN" ? "Student Learning Studio" : "শিক্ষার্থী লার্নিং স্টুডিও"}
            </span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {language === "EN"
              ? "Socratic AI Tutoring • Pomodoro Focus Room • NCTB Practice Quizzes • Spaced Repetition Flashcards"
              : "সক্রেটিক এআই টিউটর • ফোকাস স্টাডি রুম • এনসিটিবি কুইজ • স্পেসড রিপিটিশন ফ্ল্যাশকার্ড"}
          </p>
        </div>

        {/* Daily Streak Indicator */}
        {analytics && (
          <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl">
            <Flame className="text-amber-500 fill-amber-500 animate-pulse" size={20} />
            <div className="text-left">
              <div className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400">
                Daily Streak
              </div>
              <div className="text-sm font-black text-amber-900 dark:text-amber-200">
                {analytics.daily_streak_days} Days
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Module Navigation Tabs */}
      <div className="flex overflow-x-auto gap-2 p-1.5 bg-gray-100 dark:bg-white/5 rounded-2xl text-xs font-semibold">
        <button
          onClick={() => setActiveTab("tutor")}
          className={`px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shrink-0 ${
            activeTab === "tutor"
              ? "bg-white dark:bg-black/80 text-purple-600 dark:text-purple-400 shadow-sm"
              : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          <Sparkles size={14} />
          <span>Socratic AI Tutor</span>
        </button>

        <button
          onClick={() => setActiveTab("study-room")}
          className={`px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shrink-0 ${
            activeTab === "study-room"
              ? "bg-white dark:bg-black/80 text-blue-600 dark:text-blue-400 shadow-sm"
              : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          <Timer size={14} />
          <span>Focus Study Room</span>
        </button>

        <button
          onClick={() => setActiveTab("practice")}
          className={`px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shrink-0 ${
            activeTab === "practice"
              ? "bg-white dark:bg-black/80 text-emerald-600 dark:text-emerald-400 shadow-sm"
              : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          <BookOpen size={14} />
          <span>Practice Center</span>
        </button>

        <button
          onClick={() => setActiveTab("flashcards")}
          className={`px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shrink-0 ${
            activeTab === "flashcards"
              ? "bg-white dark:bg-black/80 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          <Layers size={14} />
          <span>Flashcard Decks</span>
        </button>

        <button
          onClick={() => setActiveTab("analytics")}
          className={`px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shrink-0 ${
            activeTab === "analytics"
              ? "bg-white dark:bg-black/80 text-amber-600 dark:text-amber-400 shadow-sm"
              : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          <BarChart3 size={14} />
          <span>My Analytics</span>
        </button>
      </div>

      {/* ================================================================= */}
      {/* 1. SOCRATIC AI TUTOR MODULE                                       */}
      {/* ================================================================= */}
      {activeTab === "tutor" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Saved Study Threads & Subject Picker */}
          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-5 shadow-sm space-y-4 flex flex-col justify-between max-h-[680px]">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-white/5">
                <div className="flex items-center gap-1.5 font-bold text-xs text-gray-900 dark:text-white">
                  <History size={16} className="text-purple-600" />
                  <span>Study Threads</span>
                </div>
                <button
                  onClick={startNewConversation}
                  className="px-2.5 py-1 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl text-[10px] font-bold hover:bg-purple-100 flex items-center gap-1 transition-colors"
                >
                  <Plus size={12} />
                  <span>New Thread</span>
                </button>
              </div>

              <div>
                <label className="font-semibold text-gray-600 dark:text-gray-400 block mb-1 text-[11px]">
                  Subject Filter
                </label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full p-2 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none text-xs"
                >
                  <option value="Mathematics">Mathematics (গণিত)</option>
                  <option value="Physics">Physics (পদার্থবিজ্ঞান)</option>
                  <option value="Chemistry">Chemistry (রসায়ন)</option>
                  <option value="English">English Language & Grammar</option>
                  <option value="Bangla">বাংলা ব্যাকরণ ও সাহিত্য</option>
                  <option value="Biology">Biology (জীববিজ্ঞান)</option>
                  <option value="General Science">General Science</option>
                </select>
              </div>

              {/* Thread List */}
              <div className="space-y-1.5 overflow-y-auto max-h-[460px] custom-scrollbar pr-1 pt-1">
                {convLoading ? (
                  <div className="p-4 text-center text-gray-400 text-xs">
                    <Loader2 size={16} className="animate-spin mx-auto mb-1 text-purple-600" />
                    <span>Loading threads...</span>
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-xs">
                    <MessageSquare size={20} className="mx-auto mb-1 opacity-40" />
                    <span>No saved conversations yet for {subject}. Ask a question to begin!</span>
                  </div>
                ) : (
                  conversations.map((c) => {
                    const isSelected = activeConvId === c.id;
                    return (
                      <div
                        key={c.id}
                        onClick={() => loadConversation(c.id)}
                        className={`p-3 rounded-2xl cursor-pointer transition-all border flex items-center justify-between group ${
                          isSelected
                            ? "bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/30 text-purple-900 dark:text-purple-200 font-semibold"
                            : "border-transparent hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-400"
                        }`}
                      >
                        <div className="truncate mr-2 min-w-0">
                          <div className="text-xs truncate">{c.title || c.subject}</div>
                          <div className="text-[10px] text-gray-400 font-normal">
                            {c.created_at ? new Date(c.created_at).toLocaleDateString() : ""}
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDeleteConversation(c.id, e)}
                          title="Delete thread"
                          className="p-1 rounded-lg opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all shrink-0"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 dark:border-white/5 text-[10px] text-gray-400 flex items-center gap-1">
              <Award size={12} className="text-purple-500 shrink-0" />
              <span>NCTB Curriculum Grounded</span>
            </div>
          </div>

          {/* Right Column: Chat Stream & Interactive Inquiry Form */}
          <div className="lg:col-span-2 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[580px]">
            {/* Thread Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-white/5">
              <div className="flex items-center gap-2">
                <Lightbulb size={18} className="text-purple-600" />
                <div>
                  <h3 className="font-bold text-xs text-gray-900 dark:text-white">
                    {activeConvId
                      ? conversations.find((c) => c.id === activeConvId)?.title || "Active Socratic Session"
                      : "New Socratic Guided Session"}
                  </h3>
                  <div className="text-[10px] text-gray-400 font-medium">
                    {subject} • Pedagogical Scaffolding
                  </div>
                </div>
              </div>
              {activeConvId && (
                <button
                  onClick={startNewConversation}
                  className="px-2.5 py-1 text-[10px] text-gray-500 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-white/10 rounded-xl"
                >
                  Start Fresh
                </button>
              )}
            </div>

            {/* Conversation Stream */}
            <div className="space-y-4 overflow-y-auto max-h-[380px] my-4 pr-2 custom-scrollbar">
              {tutorMessages.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-xs space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center mx-auto">
                    <Sparkles size={24} />
                  </div>
                  <div className="font-bold text-gray-700 dark:text-gray-400">
                    Socratic AI Tutor Ready
                  </div>
                  <p className="max-w-md mx-auto text-gray-400 text-[11px]">
                    Ask any problem or question below. Attach textbook photos or diagrams if needed. Your tutor provides scaffolded hints and checks understanding instead of giving away direct answers.
                  </p>
                </div>
              ) : (
                tutorMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex flex-col ${
                      msg.role === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`p-4 rounded-2xl text-xs max-w-[85%] leading-relaxed ${
                        msg.role === "user"
                          ? "bg-purple-600 text-white rounded-br-none"
                          : "bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-gray-100 rounded-bl-none"
                      }`}
                    >
                      <div className="font-semibold text-[10px] opacity-75 mb-1 flex items-center justify-between gap-4">
                        <span>{msg.role === "user" ? "You" : "Socratic AI Tutor"}</span>
                        {msg.created_at && (
                          <span className="text-[9px] opacity-60">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>

                      {/* Attached media preview */}
                      {msg.attachment_url && (
                        <div className="mb-2 rounded-xl overflow-hidden border border-black/10 dark:border-white/10 max-w-[240px]">
                          {msg.attachment_url.startsWith("data:image/") || msg.attachment_url.match(/\.(jpeg|jpg|png|webp|gif)/i) ? (
                            <img
                              src={msg.attachment_url}
                              alt="Problem snapshot"
                              className="w-full h-auto object-cover max-h-48"
                            />
                          ) : (
                            <div className="p-2 bg-black/10 flex items-center gap-1.5 text-[10px]">
                              <FileText size={14} />
                              <span className="truncate">Attached Document</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="whitespace-pre-wrap">{msg.text}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input Form with Attachment Support */}
            <form onSubmit={handleAskTutor} className="space-y-3 pt-3 border-t border-gray-100 dark:border-white/5 text-xs">
              {attachedPreview && (
                <div className="p-2 bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 rounded-xl flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <ImageIcon size={14} className="text-purple-600" />
                    <span className="truncate max-w-[200px]">{attachedFile?.name || "Image snapshot attached"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setAttachedFile(null); setAttachedPreview(null); }}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <XCircle size={14} />
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <textarea
                  required
                  rows={2}
                  value={problemText}
                  onChange={(e) => setProblemText(e.target.value)}
                  placeholder="Describe the problem, equation, or concept..."
                  className="w-full p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-purple-500"
                />
                <textarea
                  rows={2}
                  value={studentStep}
                  onChange={(e) => setStudentStep(e.target.value)}
                  placeholder="What have you tried so far? (Optional)"
                  className="w-full p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <label className="cursor-pointer px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 flex items-center gap-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors font-medium">
                  <Paperclip size={14} className="text-purple-600" />
                  <span>Attach Photo / PDF</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>

                <button
                  type="submit"
                  disabled={tutorLoading || (!problemText.trim() && !attachedFile)}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold flex items-center gap-2 shadow-sm disabled:opacity-50 transition-all shrink-0"
                >
                  {tutorLoading || uploadingAttachment ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Send size={15} />
                  )}
                  <span>{uploadingAttachment ? "Uploading..." : "Send to Tutor"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 2. FOCUS STUDY ROOM MODULE                                        */}
      {/* ================================================================= */}
      {activeTab === "study-room" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Pomodoro Timer Card */}
          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-8 shadow-sm text-center space-y-6 flex flex-col justify-center items-center">
            {/* Presets */}
            <div className="flex gap-2 p-1 bg-gray-100 dark:bg-white/5 rounded-2xl text-xs font-semibold">
              <button
                onClick={() => setPreset("focus")}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  timerMode === "focus"
                    ? "bg-white dark:bg-black/80 text-blue-600 shadow-sm"
                    : "text-gray-500"
                }`}
              >
                25m Focus
              </button>
              <button
                onClick={() => setPreset("deep")}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  timerMode === "deep"
                    ? "bg-white dark:bg-black/80 text-blue-600 shadow-sm"
                    : "text-gray-500"
                }`}
              >
                50m Deep
              </button>
              <button
                onClick={() => setPreset("break")}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  timerMode === "break"
                    ? "bg-white dark:bg-black/80 text-blue-600 shadow-sm"
                    : "text-gray-500"
                }`}
              >
                5m Break
              </button>
            </div>

            {/* Huge Clock */}
            <div className="text-6xl font-black font-mono tracking-tight text-gray-900 dark:text-white">
              {formatTimer(timerSeconds)}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setTimerRunning(!timerRunning)}
                className="w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 transition-all hover:scale-105"
              >
                {timerRunning ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
              </button>
              <button
                onClick={() => setPreset(timerMode)}
                className="w-12 h-12 bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 rounded-2xl flex items-center justify-center hover:bg-gray-200 dark:hover:bg-white/20 transition-all"
              >
                <RotateCcw size={18} />
              </button>
            </div>
          </div>

          {/* Session Intent & Log */}
          <div className="md:col-span-2 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Timer size={16} className="text-blue-600" />
              <span>Current Study Session Goal</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-400 block mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Physics"
                  className="w-full p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-400 block mb-1">
                  Topic / Chapter
                </label>
                <input
                  type="text"
                  value={studyTopic}
                  onChange={(e) => setStudyTopic(e.target.value)}
                  placeholder="e.g. Newton's Laws of Motion"
                  className="w-full p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="font-semibold text-gray-700 dark:text-gray-400 block mb-1">
                Session Reflection & Notes
              </label>
              <textarea
                rows={3}
                value={studyNotes}
                onChange={(e) => setStudyNotes(e.target.value)}
                placeholder="Key formulas memorized, problems solved, or concepts requiring review..."
                className="w-full p-3 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-blue-500"
              />
            </div>

            <button
              onClick={handleFinishSession}
              disabled={sessionSaving}
              className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-all"
            >
              {sessionSaving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <CheckCircle2 size={14} />
              )}
              <span>Complete & Log Focus Session</span>
            </button>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 3. PRACTICE QUIZ CENTER MODULE                                    */}
      {/* ================================================================= */}
      {activeTab === "practice" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 shadow-sm">
            <form onSubmit={handleGenerateQuiz} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs items-end">
              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-400 block mb-1">Class Level</label>
                <select
                  value={quizClass}
                  onChange={(e) => setQuizClass(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none"
                >
                  <option value="Class 5">Class 5</option>
                  <option value="Class 6">Class 6</option>
                  <option value="Class 7">Class 7</option>
                  <option value="Class 8">Class 8</option>
                  <option value="Class 9">Class 9</option>
                  <option value="Class 10">Class 10</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-400 block mb-1">Subject</label>
                <input
                  type="text"
                  value={quizSubject}
                  onChange={(e) => setQuizSubject(e.target.value)}
                  placeholder="e.g. Mathematics"
                  className="w-full p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-400 block mb-1">Topic</label>
                <input
                  type="text"
                  value={quizTopic}
                  onChange={(e) => setQuizTopic(e.target.value)}
                  placeholder="e.g. Geometry & Angles"
                  className="w-full p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={quizLoading}
                className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 transition-all"
              >
                {quizLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                <span>Generate NCTB Practice Quiz</span>
              </button>
            </form>
          </div>

          {/* Quiz Questionnaire */}
          {quizQuestions.length > 0 && !quizResult && (
            <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 shadow-sm space-y-6">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                {quizSubject} • {quizTopic} ({quizQuestions.length} Questions)
              </h2>

              <div className="space-y-6">
                {quizQuestions.map((q, qIndex) => (
                  <div key={q.question_id} className="p-4 bg-gray-50 dark:bg-white/[0.02] rounded-2xl border border-gray-100 dark:border-white/5 space-y-3">
                    <div className="font-semibold text-xs text-gray-900 dark:text-white">
                      {qIndex + 1}. {q.question_text}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {q.options.map((opt, optIndex) => (
                        <button
                          key={optIndex}
                          type="button"
                          onClick={() => setQuizAnswers((prev) => ({ ...prev, [q.question_id]: optIndex }))}
                          className={`p-3 rounded-xl border text-left font-medium transition-all ${
                            quizAnswers[q.question_id] === optIndex
                              ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-bold"
                              : "border-gray-200 dark:border-white/10 hover:bg-white dark:hover:bg-white/5"
                          }`}
                        >
                          <span className="font-mono mr-2">{String.fromCharCode(65 + optIndex)})</span>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleSubmitQuiz}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <CheckCircle2 size={16} />
                <span>Submit Quiz for Instant Evaluation</span>
              </button>
            </div>
          )}

          {/* Quiz Results Summary */}
          {quizResult && (
            <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl p-6 shadow-sm space-y-6 animate-in fade-in duration-300">
              <div className="p-6 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl shadow-sm flex justify-between items-center">
                <div>
                  <div className="text-xs uppercase font-bold text-emerald-100">Practice Score</div>
                  <h3 className="text-3xl font-black">{quizResult.score} / {quizResult.total_questions}</h3>
                  <div className="text-xs text-emerald-100 mt-1">Accuracy: {quizResult.accuracy_percentage}%</div>
                </div>
                <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 flex items-center justify-center text-3xl font-black">
                  {quizResult.accuracy_percentage >= 80 ? "A+" : quizResult.accuracy_percentage >= 60 ? "A" : "B"}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">Question Review & Explanations</h4>
                {quizResult.review?.map((rev: QuizReviewItem, idx: number) => (
                  <div key={idx} className="p-4 bg-gray-50 dark:bg-white/[0.02] rounded-2xl border border-gray-100 dark:border-white/5 space-y-2 text-xs">
                    <div className="flex items-center gap-2 font-bold">
                      {rev.is_correct ? (
                        <CheckCircle2 size={16} className="text-emerald-500" />
                      ) : (
                        <XCircle size={16} className="text-red-500" />
                      )}
                      <span>Question {idx + 1}</span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">{rev.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* 4. FLASHCARDS MODULE                                              */}
      {/* ================================================================= */}
      {activeTab === "flashcards" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Layers size={16} className="text-indigo-600" />
              <span>Spaced Repetition Deck ({flashcards.length} cards)</span>
            </h2>
            <button
              onClick={() => setShowAddCard(!showAddCard)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 shadow-sm transition-all"
            >
              <Plus size={14} />
              <span>Add Flashcard</span>
            </button>
          </div>

          {/* Add Card Form Modal / Collapsible */}
          {showAddCard && (
            <form onSubmit={handleCreateCard} className="p-6 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl shadow-sm space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-700 dark:text-gray-400 block mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    value={cardSubject}
                    onChange={(e) => setCardSubject(e.target.value)}
                    placeholder="e.g. Mathematics"
                    className="w-full p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-400 block mb-1">Front (Prompt / Question)</label>
                <input
                  type="text"
                  required
                  value={newFront}
                  onChange={(e) => setNewFront(e.target.value)}
                  placeholder="e.g. What is the Pythagorean Theorem formula?"
                  className="w-full p-2.5 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-400 block mb-1">Back (Answer / Explanation)</label>
                <textarea
                  required
                  rows={2}
                  value={newBack}
                  onChange={(e) => setNewBack(e.target.value)}
                  placeholder="e.g. a^2 + b^2 = c^2 (where c is the hypotenuse of a right triangle)."
                  className="w-full p-3 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl outline-none"
                />
              </div>

              <button
                type="submit"
                className="py-2 px-4 bg-indigo-600 text-white rounded-xl font-semibold shadow-sm"
              >
                Save Flashcard
              </button>
            </form>
          )}

          {/* Flashcard Viewer */}
          {flashcards.length > 0 ? (
            <div className="flex flex-col items-center justify-center space-y-4">
              <div
                onClick={() => setIsFlipped(!isFlipped)}
                className="w-full max-w-lg min-h-[220px] p-8 bg-white dark:bg-[#0f0f11] border-2 border-indigo-500/20 dark:border-indigo-500/30 rounded-3xl shadow-lg flex flex-col justify-between items-center text-center cursor-pointer transition-all hover:scale-[1.01]"
              >
                <div className="text-[10px] uppercase font-bold text-indigo-500 tracking-wider">
                  {isFlipped ? "Answer" : "Question"} • {flashcards[activeCardIndex].subject}
                </div>

                <div className="text-base font-bold text-gray-900 dark:text-white max-w-md">
                  {isFlipped
                    ? flashcards[activeCardIndex].back_explanation
                    : flashcards[activeCardIndex].front_prompt}
                </div>

                <div className="text-[11px] text-gray-400">Click to flip card</div>
              </div>

              {/* Navigation & Leitner Spaced Repetition Review Controls */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  disabled={activeCardIndex === 0}
                  onClick={() => {
                    setIsFlipped(false);
                    setActiveCardIndex((prev) => Math.max(0, prev - 1));
                  }}
                  className="px-4 py-2 bg-gray-100 dark:bg-white/10 text-xs font-semibold rounded-xl disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-xs font-mono text-gray-500">
                  {activeCardIndex + 1} / {flashcards.length} (Box {flashcards[activeCardIndex].box_level})
                </span>
                <button
                  disabled={activeCardIndex >= flashcards.length - 1}
                  onClick={() => {
                    setIsFlipped(false);
                    setActiveCardIndex((prev) => Math.min(flashcards.length - 1, prev + 1));
                  }}
                  className="px-4 py-2 bg-gray-100 dark:bg-white/10 text-xs font-semibold rounded-xl disabled:opacity-40"
                >
                  Next
                </button>
              </div>
              {isFlipped && (
                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={() => handleReviewCard(false)}
                    className="px-4 py-2 bg-amber-500/10 text-amber-600 border border-amber-500/30 text-xs font-semibold rounded-xl hover:bg-amber-500/20"
                  >
                    Needs Review
                  </button>
                  <button
                    onClick={() => handleReviewCard(true)}
                    className="px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700"
                  >
                    Got It (Level Up)
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center bg-white dark:bg-[#0f0f11] rounded-3xl border border-gray-200 dark:border-white/10 text-xs text-gray-400">
              No flashcards in your deck yet. Click Add Flashcard to create your first card!
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* 5. LEARNING ANALYTICS MODULE                                      */}
      {/* ================================================================= */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {analyticsLoading ? (
            <div className="p-12 text-center text-gray-400 flex items-center justify-center gap-2">
              <Loader2 className="animate-spin text-purple-600" size={20} />
              <span>Loading learning analytics...</span>
            </div>
          ) : analytics ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-5 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl shadow-sm space-y-1">
                <div className="text-xs text-gray-500">Total Study Time</div>
                <div className="text-2xl font-black text-gray-900 dark:text-white">
                  {Math.round(analytics.total_study_minutes / 60)} hrs {analytics.total_study_minutes % 60} min
                </div>
              </div>

              <div className="p-5 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl shadow-sm space-y-1">
                <div className="text-xs text-gray-500">Completed Sessions</div>
                <div className="text-2xl font-black text-blue-600">
                  {analytics.study_sessions_count}
                </div>
              </div>

              <div className="p-5 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl shadow-sm space-y-1">
                <div className="text-xs text-gray-500">Quiz Accuracy</div>
                <div className="text-2xl font-black text-emerald-600">
                  {analytics.average_accuracy_percentage}%
                </div>
              </div>

              <div className="p-5 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-3xl shadow-sm space-y-1">
                <div className="text-xs text-gray-500">Daily Learning Streak</div>
                <div className="text-2xl font-black text-amber-500 flex items-center gap-1">
                  <Flame size={22} className="fill-amber-500" />
                  <span>{analytics.daily_streak_days} Days</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-white dark:bg-[#0f0f11] rounded-3xl border border-gray-200 dark:border-white/10 text-xs text-gray-400">
              No analytics recorded yet. Complete study sessions and practice quizzes to track your learning journey!
            </div>
          )}
        </div>
      )}
    </div>
  );
}

