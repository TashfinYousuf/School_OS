"use client";

import { useEffect, useState } from "react";
import { 
  BookOpen, Sparkles, Plus, CheckCircle2, AlertCircle, 
  Loader2, Calendar, Clock, Trash2, Printer, X,
  UploadCloud, FileText, AlertTriangle, Database, Search, RefreshCw,
  Filter, Check, ArrowRight, Eye, Send, Download, Award, Layers,
  GraduationCap
} from "lucide-react";
import { useLanguage } from "@/components/providers";
import { useInstitution } from "@/lib/institution";
import { fetchWithTenant } from "@/lib/api-client";
import { useAcademicClasses } from "@/lib/useAcademicClasses";
import { useRagJob } from "@/lib/ragJobContext";

interface RoutineSlot {
  id: string;
  class_name: string;
  day_of_week: string;
  period_number: string;
  start_time: string;
  end_time: string;
  subject: string;
  teacher_name: string;
  room_number: string;
}

interface CurriculumDoc {
  id: string;
  title: string;
  file_name?: string;
  filename?: string;
  file_type?: string;
  file_size_bytes?: number;
  class_name: string;
  subject: string;
  chapter?: string;
  academic_year?: string;
  status: "PENDING" | "PARSING" | "INDEXED" | "FAILED" | string;
  chunks_count: number;
  error_message?: string;
  created_at?: string;
}

interface CurriculumSubject {
  name: string;
  code: string;
  weeklyPeriods: number;
  competencies: { name: string; tag: string; description: string }[];
  learningOutcomes: string[];
}

const NCTB_CURRICULUM_DATA: Record<string, {
  tier: string;
  description: string;
  subjects: CurriculumSubject[];
}> = {
  primary: {
    tier: "Primary Stage (Class 1–5)",
    description: "Foundational literacy, numeracy, observation, moral reasoning, and civic awareness grounded in Bangladesh Primary Curriculum Framework.",
    subjects: [
      {
        name: "Bangla",
        code: "BAN-101",
        weeklyPeriods: 6,
        competencies: [
          { name: "Language Fluency", tag: "Communication", description: "Express thoughts clearly in spoken and written standard Bangla." },
          { name: "Reading Comprehension", tag: "Literacy", description: "Interpret contextual narratives, poetry, and factual passages." },
          { name: "Cultural Appreciation", tag: "Civic", description: "Value national literature, liberation history, and moral heritage." }
        ],
        learningOutcomes: [
          "Demonstrate accurate pronunciation and phonemic awareness.",
          "Write structured sentences and descriptive paragraphs.",
          "Comprehend unseen texts and answer inferential questions."
        ]
      },
      {
        name: "English",
        code: "ENG-102",
        weeklyPeriods: 6,
        competencies: [
          { name: "Everyday Communication", tag: "Communication", description: "Engage in routine spoken interactions, questions, and polite exchanges." },
          { name: "Lexical & Grammar Mastery", tag: "Language", description: "Apply foundational vocabulary, tenses, and sentence forms." }
        ],
        learningOutcomes: [
          "Exchange everyday greetings, instructions, and questions in English.",
          "Compose short notes, descriptions, and functional dialogues."
        ]
      },
      {
        name: "Mathematics",
        code: "MTH-103",
        weeklyPeriods: 6,
        competencies: [
          { name: "Numerical Reasoning", tag: "Logic", description: "Perform arithmetic operations, fractions, and percentage logic." },
          { name: "Problem Solving", tag: "Critical Thinking", description: "Formulate real-world word problems into mathematical models." }
        ],
        learningOutcomes: [
          "Master multi-digit computation, factors, multiples, and decimals.",
          "Solve multi-step word problems involving measurement, time, and currency."
        ]
      },
      {
        name: "General Science",
        code: "SCI-104",
        weeklyPeriods: 5,
        competencies: [
          { name: "Scientific Inquiry", tag: "Inquiry", description: "Observe living organisms, energy states, and natural cycles." },
          { name: "Environmental Stewardship", tag: "Eco-Awareness", description: "Analyze ecosystem balance, climate patterns, and conservation." }
        ],
        learningOutcomes: [
          "Classify living things, food chains, and plant life cycles.",
          "Explain states of matter, basic energy transformations, and sanitation."
        ]
      },
      {
        name: "Bangladesh & Global Studies",
        code: "BGS-105",
        weeklyPeriods: 4,
        competencies: [
          { name: "Civic Responsibility", tag: "Civics", description: "Understand community values, democratic rights, and social harmony." },
          { name: "Historical Heritage", tag: "History", description: "Chronicle 1971 Liberation War history and national icons." }
        ],
        learningOutcomes: [
          "Describe historical milestones of the Bangladesh Liberation War.",
          "Demonstrate awareness of democratic citizenship and neighborly care."
        ]
      },
      {
        name: "Religious & Moral Education",
        code: "REL-106",
        weeklyPeriods: 3,
        competencies: [
          { name: "Moral Integrity", tag: "Ethics", description: "Practice honesty, tolerance, compassion, and respect for diversity." }
        ],
        learningOutcomes: [
          "Articulate foundational spiritual teachings and ethical obligations.",
          "Exhibit peaceful coexistence and integrity in personal conduct."
        ]
      }
    ]
  },
  junior_secondary: {
    tier: "Junior Secondary Stage (Class 6–8)",
    description: "Critical thinking, algebraic logic, empirical scientific investigation, digital literacy, and applied life skills.",
    subjects: [
      {
        name: "Bangla",
        code: "BAN-201",
        weeklyPeriods: 5,
        competencies: [
          { name: "Literary Analysis", tag: "Critical Thinking", description: "Critique figurative language, prose themes, and poetic form." },
          { name: "Formal Composition", tag: "Communication", description: "Draft formal essays, petitions, and research summaries." }
        ],
        learningOutcomes: [
          "Analyze socio-cultural themes across modern and classical literature.",
          "Construct persuasive arguments and formal written communications."
        ]
      },
      {
        name: "English",
        code: "ENG-202",
        weeklyPeriods: 5,
        competencies: [
          { name: "Interactive Discourse", tag: "Communication", description: "Debate, summarize audio texts, and present ideas fluently." },
          { name: "Textual Synthesis", tag: "Analytical", description: "Synthesize information from diverse informational genres." }
        ],
        learningOutcomes: [
          "Deliver structured presentations with appropriate register.",
          "Write argumentative and narrative compositions using complex syntax."
        ]
      },
      {
        name: "Mathematics",
        code: "MTH-203",
        weeklyPeriods: 6,
        competencies: [
          { name: "Algebraic Abstraction", tag: "Logic", description: "Solve algebraic equations, simultaneous systems, and formulas." },
          { name: "Geometric Proofs", tag: "Spatial", description: "Apply theorems on triangles, quadrilaterals, and coordinate geometry." }
        ],
        learningOutcomes: [
          "Solve linear equations and graph coordinate systems.",
          "Calculate surface areas, volume, and statistical distributions."
        ]
      },
      {
        name: "General Science",
        code: "SCI-204",
        weeklyPeriods: 5,
        competencies: [
          { name: "Empirical Investigation", tag: "Scientific Inquiry", description: "Conduct controlled lab observations and record empirical data." },
          { name: "System Dynamics", tag: "Systems Thinking", description: "Model cells, organ systems, atomic structure, and electromagnetism." }
        ],
        learningOutcomes: [
          "Explain cellular division, genetics, and organ system functioning.",
          "Understand motion, forces, electricity, and chemical bonding basics."
        ]
      },
      {
        name: "Digital Technology",
        code: "ICT-205",
        weeklyPeriods: 3,
        competencies: [
          { name: "Computational Thinking", tag: "Logic", description: "Design algorithms, flowcharts, and basic programmatic loops." },
          { name: "Digital Citizenship & Security", tag: "Cyber Ethics", description: "Navigate digital networks safely with privacy awareness." }
        ],
        learningOutcomes: [
          "Create procedural algorithms to solve computational problems.",
          "Identify online disinformation, phishing, and digital footprint hazards."
        ]
      },
      {
        name: "Life & Livelihoods",
        code: "LIV-206",
        weeklyPeriods: 3,
        competencies: [
          { name: "Vocational Readiness", tag: "Applied Life Skills", description: "Budgeting, occupational exploration, and teamwork." }
        ],
        learningOutcomes: [
          "Develop personal budgets and understand entrepreneurial initiatives.",
          "Demonstrate practical vocational dexterity and collaborative teamwork."
        ]
      }
    ]
  },
  secondary: {
    tier: "Secondary Stage (Class 9–10)",
    description: "Advanced subject specialization (Science, Humanities, Business Studies), laboratory rigor, and SSC board preparation.",
    subjects: [
      {
        name: "Physics / General Science",
        code: "PHY-301",
        weeklyPeriods: 5,
        competencies: [
          { name: "Mechanics & Wave Theory", tag: "Scientific Inquiry", description: "Analyze Newtonian kinematics, optics, and thermodynamics." },
          { name: "Mathematical Modeling", tag: "Analytical", description: "Derive formulas and compute physical constants." }
        ],
        learningOutcomes: [
          "Formulate equations for motion, energy conservation, and waves.",
          "Verify experimental laws using laboratory apparatus."
        ]
      },
      {
        name: "Chemistry",
        code: "CHM-302",
        weeklyPeriods: 5,
        competencies: [
          { name: "Chemical Logic & Stoichiometry", tag: "Scientific Inquiry", description: "Balance redox reactions and calculate molar quantities." },
          { name: "Molecular Bonding", tag: "Analytical", description: "Examine periodic trends, electrochemistry, and organic groups." }
        ],
        learningOutcomes: [
          "Predict reaction outcomes using periodic table characteristics.",
          "Perform titration and volumetric analytical computations."
        ]
      },
      {
        name: "Biology",
        code: "BIO-303",
        weeklyPeriods: 4,
        competencies: [
          { name: "Evolutionary & Molecular Genetics", tag: "Inquiry", description: "Examine DNA transcription, ecological niches, and physiology." }
        ],
        learningOutcomes: [
          "Explain Mendelian inheritance and physiological equilibrium.",
          "Examine ecological food webs and biodiversity preservation."
        ]
      },
      {
        name: "Higher Mathematics",
        code: "HMTH-304",
        weeklyPeriods: 5,
        competencies: [
          { name: "Calculus & Vector Analysis", tag: "Advanced Logic", description: "Solve set theory, trigonometry, vectors, and polynomials." }
        ],
        learningOutcomes: [
          "Solve complex trigonometric identities and vector computations.",
          "Model quadratic inequalities and exponential functions."
        ]
      },
      {
        name: "Information & Communication Technology",
        code: "ICT-305",
        weeklyPeriods: 3,
        competencies: [
          { name: "Data Systems & Web Foundations", tag: "Digital Technology", description: "Understand relational databases, HTML/CSS, and cybersecurity." }
        ],
        learningOutcomes: [
          "Author structured markup and understand DBMS relations.",
          "Analyze network topologies and protocol encryption."
        ]
      }
    ]
  }
};

const getCurriculumTierForClass = (className: string) => {
  const norm = className.toLowerCase();
  if (norm.includes("class 9") || norm.includes("class 10") || norm.includes("ssc") || norm.includes("class 11") || norm.includes("class 12") || norm.includes("hsc")) {
    return NCTB_CURRICULUM_DATA.secondary;
  }
  if (norm.includes("class 6") || norm.includes("class 7") || norm.includes("class 8") || norm.includes("jsc")) {
    return NCTB_CURRICULUM_DATA.junior_secondary;
  }
  return NCTB_CURRICULUM_DATA.primary;
};

export default function AcademicPage() {
  const { language } = useLanguage();
  const { name } = useInstitution();
  const [activeTab, setActiveTab] = useState<"routine" | "curriculum" | "knowledge-base" | "lessons">("routine");

  // --- Curriculum / Grades State ---
  const [grades, setGrades] = useState<any[]>([]);
  const [loadingGrades, setLoadingGrades] = useState(true);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [submittingClass, setSubmittingClass] = useState(false);
  const [classForm, setClassForm] = useState({ name: "", description: "" });

  // --- Curriculum Knowledge Base (RAG) State ---
  const { activeJob, startTrackingJob, cancelActiveJob } = useRagJob();
  const [curriculumDocs, setCurriculumDocs] = useState<CurriculumDoc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [kbFilterClass, setKbFilterClass] = useState("all");
  const [kbFilterSubject, setKbFilterSubject] = useState("");
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCancellingJob, setIsCancellingJob] = useState(false);
  const [isRetryingJob, setIsRetryingJob] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: "",
    class_name: "",
    subject: "",
    chapter: "",
    academic_year: "2027",
  });

  // --- Class Routine State ---
  const [selectedClass, setSelectedClass] = useState("Class 1");
  const [selectedDay, setSelectedDay] = useState("Sunday");
  const [routines, setRoutines] = useState<RoutineSlot[]>([]);
  const [loadingRoutine, setLoadingRoutine] = useState(true);
  const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);
  const [submittingRoutine, setSubmittingRoutine] = useState(false);
  
  const [routineForm, setRoutineForm] = useState({
    period_number: "Period 1",
    start_time: "09:00 AM",
    end_time: "09:45 AM",
    subject: "English",
    teacher_name: "",
    room_number: "Room 101"
  });

  // --- Curriculum & Competencies Tab State ---
  const [curriculumClassFilter, setCurriculumClassFilter] = useState("all");
  const [selectedSubjectModal, setSelectedSubjectModal] = useState<{
    className: string;
    subjectName: string;
    code: string;
    competencies: { name: string; tag: string; description: string }[];
    learningOutcomes: string[];
    weeklyPeriods: number;
    ragChunks: number;
  } | null>(null);

  // --- Daily Teaching Hub State ---
  const [lessonForm, setLessonForm] = useState({
    class_name: "",
    subject: "",
    teacher_name: "",
    topic_title: "",
    lecture_summary: "",
    homework_assigned: "",
    submission_deadline: "Next Class",
  });
  const [loggingLesson, setLoggingLesson] = useState(false);
  const [lessonLogStatus, setLessonLogStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // AI Handout Generator State
  const [aiGeneratorForm, setAiGeneratorForm] = useState({
    class_name: "",
    subject: "",
    topic_title: "",
  });
  const [generatingHandout, setGeneratingHandout] = useState(false);
  const [generatedHandout, setGeneratedHandout] = useState<{ topic_title: string; handout_content: string } | null>(null);
  const [handoutError, setHandoutError] = useState<string | null>(null);

  // Daily Lesson History State
  const [lessonHistory, setLessonHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyClassFilter, setHistoryClassFilter] = useState("all");
  const [selectedLessonLog, setSelectedLessonLog] = useState<any | null>(null);

  // Printable Handout State
  const [handoutToPrint, setHandoutToPrint] = useState<{
    topic: string;
    subject: string;
    class_name: string;
    content: string;
    teacher?: string;
    date?: string;
  } | null>(null);

  const { classNames: classes } = useAcademicClasses();
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

  // 1. Fetch Curriculum Grades
  const fetchGrades = async () => {
    setLoadingGrades(true);
    try {
      const res = await fetchWithTenant("/api/v1/academic/grades");
      if (res.ok) setGrades(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingGrades(false);
    }
  };

  // 2. Fetch Routine Timetable
  const fetchRoutine = async () => {
    setLoadingRoutine(true);
    try {
      const res = await fetchWithTenant(`/api/v1/academic/class/${encodeURIComponent(selectedClass)}?day_of_week=${selectedDay}`);
      if (res.ok) {
        setRoutines(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRoutine(false);
    }
  };

  // 3. Fetch Daily Lesson History
  const fetchLessonHistory = async () => {
    setLoadingHistory(true);
    try {
      const url = historyClassFilter && historyClassFilter !== "all"
        ? `/api/v1/academic/lessons/history?class_name=${encodeURIComponent(historyClassFilter)}`
        : `/api/v1/academic/lessons/history`;
      const res = await fetchWithTenant(url);
      if (res.ok) {
        const data = await res.json();
        setLessonHistory(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch lesson history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const [userRole, setUserRole] = useState<string>("admin");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const role = (localStorage.getItem("user_role") || "admin").toLowerCase();
      setUserRole(role);
      if (role === "student" || role === "guardian") {
        setActiveTab("routine");
      }
    }
  }, []);

  useEffect(() => {
    fetchGrades();
    fetchCurriculumDocs();
  }, []);

  useEffect(() => {
    fetchRoutine();
  }, [selectedClass, selectedDay]);

  useEffect(() => {
    if (activeTab === "lessons") {
      fetchLessonHistory();
    }
  }, [activeTab, historyClassFilter]);

  // Global Escape key listener for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isUploadModalOpen) {
          setIsUploadModalOpen(false);
        } else if (isClassModalOpen) {
          setIsClassModalOpen(false);
        } else if (isRoutineModalOpen) {
          setIsRoutineModalOpen(false);
        } else if (selectedSubjectModal) {
          setSelectedSubjectModal(null);
        } else if (selectedLessonLog) {
          setSelectedLessonLog(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isUploadModalOpen, isClassModalOpen, isRoutineModalOpen, selectedSubjectModal, selectedLessonLog]);

  // Handle Class Creation
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingClass(true);
    try {
      const res = await fetchWithTenant("/api/v1/academic/grades", {
        method: "POST",
        body: JSON.stringify(classForm),
      });
      if (res.ok) {
        setIsClassModalOpen(false);
        setClassForm({ name: "", description: "" });
        fetchGrades();
      }
    } finally {
      setSubmittingClass(false);
    }
  };

  // Handle Routine Slot Creation
  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingRoutine(true);
    try {
      const res = await fetchWithTenant("/api/v1/academic/", {
        method: "POST",
        body: JSON.stringify({
          class_name: selectedClass,
          day_of_week: selectedDay,
          ...routineForm
        })
      });
      if (res.ok) {
        setIsRoutineModalOpen(false);
        setRoutineForm({
          period_number: "Period 1",
          start_time: "09:00 AM",
          end_time: "09:45 AM",
          subject: "English",
          teacher_name: "",
          room_number: "Room 101"
        });
        fetchRoutine();
      }
    } finally {
      setSubmittingRoutine(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm("Are you sure you want to remove this period slot?")) return;
    try {
      const res = await fetchWithTenant(`/api/v1/academic/${slotId}`, {
        method: "DELETE"
      });
      if (res.ok) fetchRoutine();
    } catch (err) {
      alert("Failed to delete slot");
    }
  };

  // --- Curriculum Knowledge Base (RAG) Handlers ---
  const fetchCurriculumDocs = async () => {
    setLoadingDocs(true);
    try {
      const params = new URLSearchParams();
      if (kbFilterClass && kbFilterClass !== "all") params.append("class_name", kbFilterClass);
      if (kbFilterSubject.trim()) params.append("subject", kbFilterSubject.trim());
      const query = params.toString() ? `?${params.toString()}` : "";
      const res = await fetchWithTenant(`/api/v1/ai/curriculum/documents${query}`);
      if (res.ok) {
        const data = await res.json();
        setCurriculumDocs(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch curriculum documents:", err);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    if (activeTab === "knowledge-base" || activeTab === "curriculum") {
      fetchCurriculumDocs();
    }
  }, [activeTab, kbFilterClass, kbFilterSubject]);

  // Auto-refresh curriculum docs when background job reaches completed state
  useEffect(() => {
    if (activeJob?.status === "INDEXED" || activeJob?.status === "COMPLETED") {
      fetchCurriculumDocs();
    }
  }, [activeJob?.status]);

  const handleCancelJob = async () => {
    if (!activeJob?.id) return;
    setIsCancellingJob(true);
    try {
      await cancelActiveJob();
    } finally {
      setIsCancellingJob(false);
    }
  };

  const handleRetryJob = async () => {
    if (!activeJob?.id) return;
    setIsRetryingJob(true);
    setUploadError(null);
    try {
      const res = await fetchWithTenant(`/api/v1/ai/curriculum/jobs/${activeJob.id}/retry`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `Retry failed (${res.status})`);
      startTrackingJob(data);
    } catch (err: any) {
      setUploadError(err.message || "Retry failed.");
    } finally {
      setIsRetryingJob(false);
    }
  };

  const handleUploadCurriculum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError(language === "EN" ? "Please select a document file (.pdf, .docx, .txt)." : "অনুগ্রহ করে একটি ডকুমেন্ট ফাইল নির্বাচন করুন (.pdf, .docx, .txt)।");
      return;
    }
    setUploadingDoc(true);
    setUploadError(null);
    setUploadSuccess(null);

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 120_000);

    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      fd.append("title", uploadForm.title);
      fd.append("class_name", uploadForm.class_name);
      fd.append("subject", uploadForm.subject);
      if (uploadForm.chapter) fd.append("chapter", uploadForm.chapter);
      if (uploadForm.academic_year) fd.append("academic_year", uploadForm.academic_year);
      fd.append("async_mode", "true");

      const res = await fetchWithTenant("/api/v1/ai/curriculum/upload", { method: "POST", body: fd, signal: ctrl.signal });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `Upload failed (${res.status}).`);


      const jobId = data.job_id || data.id;
      startTrackingJob({
        id: jobId,
        job_id: jobId,
        title: data.title || uploadForm.title,
        file_name: data.file_name || selectedFile.name,
        status: data.status || "QUEUED",
        stage: data.stage || "queued",
        progress_pct: data.progress_pct || 10,
        chunks_indexed: 0,
        chunks_total: 0,
      });

      setSelectedFile(null);
      setUploadForm({ title: "", class_name: "", subject: "", chapter: "", academic_year: "2027" });
      setIsUploadModalOpen(false);
      setUploadSuccess(language === "EN"
        ? "Document queued for background indexing. You can navigate freely."
        : "ডকুমেন্টটি ব্যাকগ্রাউন্ড ইনডেক্সিংয়ের জন্য যুক্ত হয়েছে। আপনি নির্দ্বিধায় ব্রাউজ করতে পারেন।");
      void fetchCurriculumDocs();
    } catch (err: any) {
      setUploadError(err?.name === "AbortError" ? "Upload timed out. Network check kore abar chesta koro." : (err.message || "Failed to upload document."));
    } finally {
      clearTimeout(timeout);
      setUploadingDoc(false);          // success/fail/timeout, sob case e spinner bondho
}
  };

  useEffect(() => {
    if (activeTab !== "knowledge-base" && activeTab !== "curriculum") return;
    const t = setTimeout(() => { void fetchCurriculumDocs(); }, 350);
    return () => clearTimeout(t);
  }, [activeTab, kbFilterClass, kbFilterSubject]);

  const handleDeleteDoc = async (docId: string, title: string) => {
    if (!confirm(language === "EN" ? `Are you sure you want to delete "${title}" and its RAG knowledge chunks?` : `আপনি কি নিশ্চিত যে "${title}" এবং এর নলেজ চাঙ্ক মুছে ফেলতে চান?`)) return;
    try {
      const res = await fetchWithTenant(`/api/v1/ai/curriculum/documents/${docId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchCurriculumDocs();
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to delete document.");
      }
    } catch (err) {
      alert("Network error deleting document.");
    }
  };

  // --- Daily Teaching Hub Handlers ---
  const handleLogLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonForm.topic_title.trim() || !lessonForm.lecture_summary.trim()) {
      setLessonLogStatus({ type: "error", text: "Please enter both Topic Title and Lecture Summary." });
      return;
    }
    setLoggingLesson(true);
    setLessonLogStatus(null);
    try {
      const res = await fetchWithTenant("/api/v1/academic/lessons/log", {
        method: "POST",
        body: JSON.stringify(lessonForm),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to log daily lesson.");
      }
      setLessonLogStatus({ type: "success", text: "Daily lesson successfully logged to curriculum audit trail!" });
      fetchLessonHistory();
    } catch (err: any) {
      setLessonLogStatus({ type: "error", text: err.message || "Failed to save lesson log." });
    } finally {
      setLoggingLesson(false);
    }
  };

  const handleGenerateMaterials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiGeneratorForm.topic_title.trim()) {
      setHandoutError("Please enter a topic or chapter title.");
      return;
    }
    setGeneratingHandout(true);
    setHandoutError(null);
    setGeneratedHandout(null);
    try {
      const res = await fetchWithTenant("/api/v1/academic/lessons/generate-materials", {
        method: "POST",
        body: JSON.stringify(aiGeneratorForm),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to generate teaching materials.");
      }
      setGeneratedHandout(data);
    } catch (err: any) {
      setHandoutError(err.message || "AI Handout generation failed.");
    } finally {
      setGeneratingHandout(false);
    }
  };

  const handleTransferToLessonForm = () => {
    if (!generatedHandout) return;
    setLessonForm({
      ...lessonForm,
      class_name: aiGeneratorForm.class_name,
      subject: aiGeneratorForm.subject,
      topic_title: generatedHandout.topic_title,
      lecture_summary: generatedHandout.handout_content,
      homework_assigned: `Review class worksheet: ${generatedHandout.topic_title}. Complete in-class exercises and homework tasks.`,
      submission_deadline: "Next Class",
    });
    setLessonLogStatus({
      type: "success",
      text: "AI generated lesson content populated into Lesson Planner form!",
    });
  };

  const handlePrintHandout = (handout: { topic_title: string; handout_content: string }) => {
    setHandoutToPrint({
      topic: handout.topic_title,
      subject: aiGeneratorForm.subject,
      class_name: aiGeneratorForm.class_name,
      content: handout.handout_content,
      teacher: lessonForm.teacher_name || "Faculty Educator",
      date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    });
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Screen Controls (Hidden on Print) */}
      <div className="print:hidden space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-white/10 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
              <BookOpen className="text-blue-600 dark:text-purple-400" />
              <span>
                {userRole === "student"
                  ? (language === "EN" ? "My Class Timetable & Routine" : "আমার ক্লাস রুটিন ও সময়সূচি")
                  : userRole === "guardian"
                  ? (language === "EN" ? "Child's Class Routine" : "সন্তানের ক্লাস রুটিন")
                  : (language === "EN" ? "Academic Management & Schedules" : "একাডেমিক ব্যবস্থাপনা ও সময়সূচি")}
              </span>
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              {userRole === "student"
                ? (language === "EN" ? "View your daily period routines, subjects, and teachers." : "আপনার দৈনিক ক্লাসের সময়সূচি, বিষয় এবং শিক্ষকদের তালিকা।")
                : userRole === "guardian"
                ? (language === "EN" ? "View weekly class routine and periods for your child." : "আপনার সন্তানের সাপ্তাহিক ক্লাস রুটিন ও সময়সূচি।")
                : (language === "EN" ? "Manage daily period routines, classes, and NCTB curriculum competencies." : "দৈনিক ক্লাস রুটিন, সময়সূচি ও এনসিটিবি কারিকুলাম পরিচালনা করুন।")}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-1.5 text-gray-700 dark:text-gray-400 transition-colors"
            >
              <Printer size={14} /> {language === "EN" ? "Print Timetable" : "রুটিন প্রিন্ট করুন"}
            </button>
            {userRole !== "student" && userRole !== "guardian" && (
              <>
                {activeTab === "routine" ? (
                  <button
                    onClick={() => setIsRoutineModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <Plus size={15} /> {language === "EN" ? "Add Period Slot" : "নতুন পিরিয়ড যোগ করুন"}
                  </button>
                ) : activeTab === "knowledge-base" ? (
                  <button
                    onClick={() => {
                      setIsUploadModalOpen(true);
                      setUploadError(null);
                      setUploadSuccess(null);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <UploadCloud size={15} /> {language === "EN" ? "Upload Knowledge Doc" : "নলেজ ফাইল আপলোড"}
                  </button>
                ) : (
                  <button
                    onClick={() => setIsClassModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
                  >
                    <Plus size={16} /> {language === "EN" ? "Create Class" : "ক্লাস তৈরি করুন"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Active Ingestion Banner (Visible on all tabs and persists across refreshes) */}
        {activeJob && (
          <div className="p-4 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-500/30 rounded-2xl space-y-2 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div className="flex items-center gap-2.5">
                <div className={`w-3 h-3 rounded-full ${activeJob.status === "FAILED" ? "bg-red-500" : activeJob.status === "INDEXED" ? "bg-green-500" : "bg-blue-600 animate-pulse"}`} />
                <span className="font-bold text-xs text-gray-900 dark:text-white">
                  {language === "EN" ? "RAG Ingestion: " : "আরএজি ইনডেক্সিং: "}
                  <strong className="text-blue-600 dark:text-blue-400">{activeJob.file_name || activeJob.title}</strong>
                  {" — "}
                  <span className="capitalize font-mono">
                    {activeJob.stage === "queued" && (language === "EN" ? "Queued for processing" : "প্রক্রিয়াকরণের জন্য অপেক্ষারত")}
                    {activeJob.stage === "validating" && (language === "EN" ? "Validating Document" : "ডকুমেন্ট যাচাইকরণ")}
                    {activeJob.stage === "extracting" && (language === "EN" ? "Extracting Text Streams" : "টেক্সট এক্সট্র্যাক্ট করা হচ্ছে")}
                    {activeJob.stage === "chunking" && (language === "EN" ? "Segmenting Knowledge Chunks" : "নলেজ চাঙ্ক সেগমেন্টেশন")}
                    {activeJob.stage === "indexing" && (language === "EN" ? "Generating Embeddings & Indexing" : "এমবেডিং তৈরি ও ইনডেক্সিং")}
                    {activeJob.stage === "completed" && (language === "EN" ? "Indexing Complete" : "ইনডেক্সিং সম্পন্ন")}
                    {activeJob.stage === "cancelled" && (language === "EN" ? "Ingestion Cancelled" : "ইনডেক্সিং বাতিল")}
                    {activeJob.stage === "failed" && (language === "EN" ? "Ingestion Failed" : "ইনডেক্সিং ব্যর্থ")}
                  </span>
                  {" "}({activeJob.progress_pct}%)
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="font-mono text-gray-500">
                  {language === "EN" ? "Chunks: " : "চাঙ্ক: "}
                  <strong>{activeJob.chunks_indexed || 0}</strong>
                  {activeJob.chunks_total ? ` / ${activeJob.chunks_total}` : ""}
                </span>
                {activeJob.status !== "INDEXED" && activeJob.status !== "FAILED" && activeJob.status !== "CANCELLED" && (
                  <button
                    type="button"
                    onClick={handleCancelJob}
                    disabled={isCancellingJob}
                    className="px-2.5 py-1 text-red-600 border border-red-200 dark:border-red-900/40 rounded-lg text-[11px] font-semibold hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                  >
                    {isCancellingJob ? (language === "EN" ? "Cancelling..." : "বাতিল হচ্ছে...") : (language === "EN" ? "Cancel" : "বাতিল")}
                  </button>
                )}
                {activeJob.status === "FAILED" && (
                  <button
                    type="button"
                    onClick={handleRetryJob}
                    disabled={isRetryingJob}
                    className="px-2.5 py-1 text-white bg-blue-600 rounded-lg text-[11px] font-semibold hover:bg-blue-700 transition-colors"
                  >
                    {isRetryingJob ? (language === "EN" ? "Retrying..." : "পুনরায় চেষ্টা...") : (language === "EN" ? "Retry" : "পুনরায় চেষ্টা")}
                  </button>
                )}
              </div>
            </div>
            <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.max(5, activeJob.progress_pct)}%` }}
              />
            </div>
          </div>
        )}

        {/* Tab Switcher */}
        {userRole === "admin" || userRole === "superadmin" ? (
          <div className="flex flex-wrap gap-2 border-b border-gray-100 dark:border-white/10 pb-3">
            <button
              onClick={() => setActiveTab("routine")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "routine"
                  ? "bg-blue-600 text-white shadow-sm dark:bg-white/10 dark:text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
              }`}
            >
              <Clock size={14} />
              <span>{language === "EN" ? "Class Routine & Timetable" : "ক্লাস রুটিন ও সময়সূচি"}</span>
            </button>

            <button
              onClick={() => setActiveTab("curriculum")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "curriculum"
                  ? "bg-blue-600 text-white shadow-sm dark:bg-white/10 dark:text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
              }`}
            >
              <Sparkles size={14} />
              <span>{language === "EN" ? "Curriculum & Competencies" : "পাঠ্যক্রম ও শ্রেণি বিন্যাস"}</span>
            </button>

            <button
              onClick={() => setActiveTab("knowledge-base")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "knowledge-base"
                  ? "bg-blue-600 text-white shadow-sm dark:bg-white/10 dark:text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
              }`}
            >
              <Database size={14} />
              <span>{language === "EN" ? "Curriculum Knowledge Base (RAG)" : "কারিকুলাম নলেজ বেস (আরএজি)"}</span>
            </button>

            <button
              onClick={() => setActiveTab("lessons")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "lessons"
                  ? "bg-blue-600 text-white shadow-sm dark:bg-white/10 dark:text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
              }`}
            >
              <FileText size={14} />
              <span>{language === "EN" ? "Lesson Handouts & History" : "লেসন হ্যান্ডআউট ও ইতিহাস"}</span>
            </button>
          </div>
        ) : userRole === "teacher" ? (
          <div className="flex flex-wrap gap-2 border-b border-gray-100 dark:border-white/10 pb-3">
            <button
              onClick={() => setActiveTab("routine")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "routine"
                  ? "bg-blue-600 text-white shadow-sm dark:bg-white/10 dark:text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
              }`}
            >
              <Clock size={14} />
              <span>{language === "EN" ? "Class Routine & Timetable" : "ক্লাস রুটিন ও সময়সূচি"}</span>
            </button>

            <button
              onClick={() => setActiveTab("curriculum")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "curriculum"
                  ? "bg-blue-600 text-white shadow-sm dark:bg-white/10 dark:text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
              }`}
            >
              <Sparkles size={14} />
              <span>{language === "EN" ? "Assigned Syllabus & Competencies" : "নির্ধারিত পাঠ্যক্রম ও যোগ্যতা"}</span>
            </button>

            <button
              onClick={() => setActiveTab("lessons")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "lessons"
                  ? "bg-blue-600 text-white shadow-sm dark:bg-white/10 dark:text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
              }`}
            >
              <FileText size={14} />
              <span>{language === "EN" ? "Daily Teaching Hub & Diary" : "টিচিং হাব ও লেসন ডায়েরি"}</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 border-b border-gray-100 dark:border-white/10 pb-3">
            <button
              onClick={() => setActiveTab("routine")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white shadow-sm dark:bg-white/10 dark:text-white"
            >
              <Clock size={14} />
              <span>{language === "EN" ? "Weekly Timetable" : "সাপ্তাহিক রুটিন"}</span>
            </button>
          </div>
        )}

        {/* ================= TAB 1: ROUTINE TIMETABLE ================= */}
        {activeTab === "routine" && (
          <div className="space-y-6">
            
            {/* Filter Bar */}
            <div className="flex flex-wrap gap-4 items-center bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 p-4 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500">Select Class:</span>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs text-gray-900 dark:text-white outline-none font-semibold"
                >
                  {classes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar">
                {days.map(d => (
                  <button
                    key={d}
                    onClick={() => setSelectedDay(d)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      selectedDay === d
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Routine Slots Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {loadingRoutine ? (
                <div className="col-span-full p-12 text-center text-gray-500 flex justify-center items-center gap-2">
                  <Loader2 className="animate-spin text-blue-600" size={20} /> Loading timetable...
                </div>
              ) : routines.length === 0 ? (
                <div className="col-span-full p-12 text-center text-gray-400 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl text-xs">
                  No periods scheduled for {selectedClass} on {selectedDay}.
                </div>
              ) : (
                routines.map((r) => (
                  <div key={r.id} className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl p-5 shadow-sm space-y-3 relative group">
                    <div className="flex justify-between items-start">
                      <span className="text-[11px] font-bold text-blue-600 dark:text-purple-400 bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1 rounded-md">
                        {r.period_number}
                      </span>
                      {userRole !== "student" && userRole !== "guardian" && (
                        <button
                          onClick={() => handleDeleteSlot(r.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors p-1"
                          title="Delete slot"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">{r.subject}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Instructor: <strong>{r.teacher_name}</strong></p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-white/5 text-[11px] text-gray-400">
                      <span className="flex items-center gap-1 font-mono"><Clock size={12} /> {r.start_time} - {r.end_time}</span>
                      <span className="font-medium text-gray-600 dark:text-gray-400">{r.room_number}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 2: CURRICULUM & GRADES ================= */}
        {activeTab === "curriculum" && (
          <div className="space-y-6">
            {/* Filter and Overview Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 p-5 rounded-2xl shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 dark:bg-white/[0.05] rounded-xl text-blue-600 dark:text-purple-400">
                  <GraduationCap size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                    {language === "EN" ? "NCTB Curriculum Framework & Subject Competencies" : "জাতীয় শিক্ষাক্রম ও বিষয়ভিত্তিক যোগ্যতা কাঠামো"}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {language === "EN" 
                      ? "Standards-based curriculum aligned with national benchmarks, learning outcomes, and RAG knowledge base." 
                      : "জাতীয় মানদণ্ড ও আরএজি নলেজ বেসের সাথে সমন্বিত বিষয়ভিত্তিক শিখনফল।"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-stretch sm:self-auto">
                <span className="text-xs font-semibold text-gray-500 shrink-0">
                  {language === "EN" ? "Filter Class:" : "ক্লাস নির্বাচন:"}
                </span>
                <select
                  value={curriculumClassFilter}
                  onChange={(e) => setCurriculumClassFilter(e.target.value)}
                  className="bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white outline-none font-semibold w-full sm:w-auto"
                >
                  <option value="all">{language === "EN" ? "All Configured Classes" : "সকল কনফিগার করা ক্লাস"}</option>
                  {(grades.length > 0 ? grades.map(g => g.name) : classes).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Main Content Grid: Classes & Subjects + Side Intelligence Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              <div className="lg:col-span-3 space-y-6">
                {loadingGrades ? (
                  <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-10 text-center flex justify-center items-center gap-2 text-gray-500 border border-gray-200 dark:border-white/10">
                    <Loader2 className="animate-spin text-blue-500" size={20} /> {language === "EN" ? "Loading Curriculum..." : "লোড হচ্ছে..."}
                  </div>
                ) : (
                  (() => {
                    const candidateClasses = grades.length > 0
                      ? (curriculumClassFilter === "all" ? grades : grades.filter(g => g.name === curriculumClassFilter))
                      : (curriculumClassFilter === "all" ? classes.map((c, i) => ({ id: `class-${i}`, name: c, description: "NCTB Curriculum Grade" })) : [{ id: "curr-1", name: curriculumClassFilter, description: "NCTB Curriculum Grade" }]);

                    if (candidateClasses.length === 0) {
                      return (
                        <div className="bg-white dark:bg-[#0f0f11] rounded-2xl p-10 text-center text-gray-500 border border-gray-200 dark:border-white/10 text-xs">
                          {language === "EN" ? "No classes match the selected filter." : "নির্বাচিত ফিল্টারের সাথে কোনো ক্লাস মিলছে না।"}
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-6">
                        {candidateClasses.map((grade) => {
                          const tierData = getCurriculumTierForClass(grade.name);
                          return (
                            <div key={grade.id} className="bg-white dark:bg-[#0f0f11] rounded-3xl p-6 border border-gray-200 dark:border-white/10 shadow-sm space-y-5">
                              {/* Class Header */}
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-100 dark:border-white/5 pb-4">
                                <div>
                                  <div className="flex items-center gap-2.5">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{grade.name}</h3>
                                    <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-500/20">
                                      {tierData.tier}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {grade.description || tierData.description}
                                  </p>
                                </div>

                                <button
                                  onClick={() => {
                                    setSelectedClass(grade.name);
                                    setActiveTab("routine");
                                  }}
                                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                >
                                  <span>{language === "EN" ? "View Class Routine" : "ক্লাস রুটিন দেখুন"}</span>
                                  <ArrowRight size={13} />
                                </button>
                              </div>

                              {/* Subjects & Competencies Grid */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {tierData.subjects.map((sub) => {
                                  const matchingDocs = curriculumDocs.filter(d => 
                                    (d.class_name.toLowerCase() === grade.name.toLowerCase() || d.class_name.toLowerCase() === "all" || d.class_name === "") &&
                                    d.subject.toLowerCase() === sub.name.toLowerCase() &&
                                    d.status === "INDEXED"
                                  );
                                  const ragChunks = matchingDocs.reduce((acc, d) => acc + (d.chunks_count || 0), 0);

                                  return (
                                    <div 
                                      key={sub.code}
                                      className="p-4 bg-gray-50/70 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-2xl space-y-3.5 hover:border-blue-300 dark:hover:border-blue-500/30 transition-all flex flex-col justify-between"
                                    >
                                      <div>
                                        <div className="flex justify-between items-start gap-2">
                                          <div>
                                            <div className="flex items-center gap-2">
                                              <span className="font-mono text-[10px] font-bold text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-white/10 px-1.5 py-0.5 rounded">
                                                {sub.code}
                                              </span>
                                              <h4 className="text-sm font-bold text-gray-900 dark:text-white">{sub.name}</h4>
                                            </div>
                                            <span className="text-[11px] text-gray-400 mt-0.5 block">
                                              {sub.weeklyPeriods} {language === "EN" ? "Weekly Periods" : "সাপ্তাহিক পিরিয়ড"}
                                            </span>
                                          </div>

                                          {/* RAG Grounding Indicator */}
                                          {ragChunks > 0 ? (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1 shrink-0">
                                              <Sparkles size={10} />
                                              <span>{ragChunks} Chunks Grounded</span>
                                            </span>
                                          ) : (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-white/10 shrink-0">
                                              NCTB Baseline
                                            </span>
                                          )}
                                        </div>

                                        {/* Competencies Badges */}
                                        <div className="mt-3 flex flex-wrap gap-1.5">
                                          {sub.competencies.map((c) => (
                                            <span 
                                              key={c.name}
                                              className="text-[10px] font-semibold bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 px-2 py-1 rounded-lg text-gray-700 dark:text-gray-400 flex items-center gap-1 shadow-2xs"
                                              title={c.description}
                                            >
                                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                              <span>{c.name}</span>
                                            </span>
                                          ))}
                                        </div>

                                        {/* Key Learning Outcomes Preview */}
                                        <div className="mt-3 text-[11px] text-gray-600 dark:text-gray-400 space-y-1">
                                          <div className="font-semibold text-gray-700 dark:text-gray-400 flex items-center gap-1 text-[10px] uppercase tracking-wider">
                                            <CheckCircle2 size={12} className="text-green-500" />
                                            <span>Key Learning Outcomes:</span>
                                          </div>
                                          <ul className="list-disc list-inside text-[11px] text-gray-500 dark:text-gray-400 space-y-0.5 pl-1">
                                            {sub.learningOutcomes.slice(0, 2).map((lo, idx) => (
                                              <li key={idx} className="truncate">{lo}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      </div>

                                      {/* Action Buttons */}
                                      <div className="flex items-center justify-between pt-2.5 border-t border-gray-200/60 dark:border-white/5 text-xs">
                                        <button
                                          onClick={() => setSelectedSubjectModal({
                                            className: grade.name,
                                            subjectName: sub.name,
                                            code: sub.code,
                                            competencies: sub.competencies,
                                            learningOutcomes: sub.learningOutcomes,
                                            weeklyPeriods: sub.weeklyPeriods,
                                            ragChunks
                                          })}
                                          className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
                                        >
                                          <Eye size={12} />
                                          <span>Competency Map</span>
                                        </button>

                                        <button
                                          onClick={() => {
                                            setActiveTab("lessons");
                                            setLessonForm({
                                              ...lessonForm,
                                              class_name: grade.name,
                                              subject: sub.name,
                                            });
                                            setAiGeneratorForm({
                                              ...aiGeneratorForm,
                                              class_name: grade.name,
                                              subject: sub.name,
                                            });
                                          }}
                                          className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-1"
                                        >
                                          <Sparkles size={12} />
                                          <span>Draft Lesson</span>
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                )}
              </div>

              {/* AI Curriculum Intelligence Panel */}
              <div className="lg:col-span-1 space-y-5">
                <div className="bg-white dark:bg-[#0f0f11] rounded-3xl p-6 relative overflow-hidden group border border-blue-100 dark:border-blue-500/20 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <Sparkles size={18} className="animate-pulse" />
                    <h2 className="font-semibold text-xs tracking-wide uppercase">
                      {language === "EN" ? "AI Curriculum Grounding" : "এআই পাঠ্যক্রম গ্রাউন্ডিং"}
                    </h2>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-50/60 dark:bg-white/[0.03] border border-blue-100 dark:border-white/10 rounded-2xl">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Active Grade Levels</div>
                      <div className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">
                        {grades.length || classes.length} Levels
                      </div>
                    </div>

                    <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl">
                      <div className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase tracking-wider font-semibold">RAG Documents Indexed</div>
                      <div className="text-xl font-bold text-emerald-800 dark:text-emerald-300 mt-0.5 flex items-center justify-between">
                        <span>{curriculumDocs.filter(d => d.status === "INDEXED").length} Docs</span>
                        <span className="text-xs font-mono font-normal">
                          {curriculumDocs.filter(d => d.status === "INDEXED").reduce((a, b) => a + (b.chunks_count || 0), 0)} chunks
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Grounding Alignment Status */}
                  <div className="space-y-2 text-xs">
                    <div className="p-3.5 bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-xl leading-relaxed text-gray-700 dark:text-gray-400 text-[11px] space-y-1.5">
                      <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <CheckCircle2 size={13} className="text-green-500" />
                        <span>NCTB Standards Compliance</span>
                      </div>
                      <p>
                        Core subjects adhere to Bangladesh National Curriculum competencies with 100% baseline coverage across Primary and Secondary levels.
                      </p>
                    </div>

                    {curriculumDocs.length === 0 ? (
                      <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-xl text-amber-800 dark:text-amber-300 text-[11px] space-y-1">
                        <div className="font-bold flex items-center gap-1.5">
                          <AlertTriangle size={13} />
                          <span>No Textbooks Indexed</span>
                        </div>
                        <p>
                          Upload NCTB PDF textbooks in the Knowledge Base tab to activate vector-grounded lecture generation and exam blueprinting.
                        </p>
                      </div>
                    ) : (
                      <div className="p-3.5 bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/30 rounded-xl text-purple-900 dark:text-purple-300 text-[11px] space-y-1">
                        <div className="font-bold flex items-center gap-1.5">
                          <Sparkles size={13} />
                          <span>Vector RAG Active</span>
                        </div>
                        <p>
                          AI Teaching Hub queries retrieve real textbook paragraphs for lesson generation without hallucination.
                        </p>
                      </div>
                    )}
                  </div>

                  {(userRole === "admin" || userRole === "superadmin") && (
                    <button
                      onClick={() => setActiveTab("knowledge-base")}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
                    >
                      <Database size={14} />
                      <span>{language === "EN" ? "Manage Knowledge Base" : "নলেজ বেস পরিচালনা"}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: CURRICULUM KNOWLEDGE BASE (RAG) (ADMIN ONLY) ================= */}
        {activeTab === "knowledge-base" && (userRole === "admin" || userRole === "superadmin") && (
          <div className="space-y-6">
            {/* Overview / Grounding Status Banner */}
            <div className="bg-gradient-to-r from-blue-900/10 via-purple-900/10 to-transparent border border-blue-200 dark:border-blue-900/40 p-5 rounded-3xl">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-sm">
                    <Database size={22} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <span>{language === "EN" ? "Authentic NCTB Curriculum Grounding" : "প্রামাণ্য এনসিটিবি পাঠ্যক্রম নলেজ বেস"}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                        RAG Active
                      </span>
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {language === "EN" 
                        ? "Institutional documents are parsed into semantic chunks to ground question paper and lesson plan generation in authentic syllabus." 
                        : "প্রশ্নপত্র ও পাঠ পরিকল্পনা তৈরিতে প্রাতিষ্ঠানিক পাঠ্যবই এবং সিলেবাসের সঠিক তথ্য নিশ্চিত করতে সেমান্টিক চাঙ্কিং ব্যবহৃত হয়।"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-xs shrink-0">
                  <div className="text-right">
                    <div className="text-[10px] uppercase font-bold text-gray-400">Indexed Documents</div>
                    <div className="text-base font-bold font-mono text-gray-900 dark:text-white">{curriculumDocs.length}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase font-bold text-gray-400">Knowledge Chunks</div>
                    <div className="text-base font-bold font-mono text-blue-600 dark:text-purple-400">
                      {curriculumDocs.reduce((acc, d) => acc + (d.chunks_count || 0), 0)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter & Action Bar */}
            <div className="flex flex-wrap gap-3 items-center justify-between bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 p-3.5 rounded-2xl shadow-sm text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-500">{language === "EN" ? "Class:" : "শ্রেণি:"}</span>
                  <select
                    value={kbFilterClass}
                    onChange={(e) => setKbFilterClass(e.target.value)}
                    className="bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-gray-900 dark:text-white outline-none"
                  >
                    <option value="all">{language === "EN" ? "All Classes" : "সকল শ্রেণি"}</option>
                    {classes.map((cls) => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-500">{language === "EN" ? "Subject:" : "বিষয়:"}</span>
                  <div className="relative">
                    <input
                      value={kbFilterSubject}
                      onChange={(e) => setKbFilterSubject(e.target.value)}
                      placeholder={language === "EN" ? "e.g. Science, Math..." : "যেমন: বিজ্ঞান, গণিত..."}
                      className="bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl pl-7 pr-3 py-1.5 text-xs text-gray-900 dark:text-white outline-none"
                    />
                    <Search size={12} className="absolute left-2.5 top-2.5 text-gray-400" />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchCurriculumDocs}
                  disabled={loadingDocs}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-1.5"
                >
                  <RefreshCw size={12} className={loadingDocs ? "animate-spin" : ""} />
                  <span>{language === "EN" ? "Refresh" : "রিফ্রেশ"}</span>
                </button>
                <button
                  onClick={() => {
                    setIsUploadModalOpen(true);
                    setUploadError(null);
                    setUploadSuccess(null);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <Plus size={14} />
                  <span>{language === "EN" ? "Upload Document" : "ডকুমেন্ট আপলোড"}</span>
                </button>
              </div>
            </div>

            {/* Document Table */}
            <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
              {loadingDocs ? (
                <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-2">
                  <Loader2 className="animate-spin text-blue-600" size={24} />
                  <span className="text-xs">{language === "EN" ? "Loading indexed curriculum documents..." : "ইন্ডেক্সকৃত কারিকুলাম ডকুমেন্ট লোড হচ্ছে..."}</span>
                </div>
              ) : curriculumDocs.length === 0 ? (
                <div className="p-12 text-center text-gray-400 space-y-3">
                  <FileText className="mx-auto text-gray-400 dark:text-gray-600" size={36} />
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-400">
                      {language === "EN" ? "No curriculum documents indexed yet" : "কোনো কারিকুলাম ডকুমেন্ট পাওয়া যায়নি"}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                      {language === "EN"
                        ? "Upload NCTB textbooks, chapter notes, or official curriculum syllabi (PDF, DOCX, TXT) to ground AI question papers and lesson plans in authentic institutional facts."
                        : "এনসিটিবি পাঠ্যবই, নোট অথবা প্রাতিষ্ঠানিক সিলেবাস আপলোড করুন যা এআই প্রশ্নপত্র ও লেকচার শিট তৈরিতে ব্যবহৃত হবে।"}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setIsUploadModalOpen(true);
                      setUploadError(null);
                      setUploadSuccess(null);
                    }}
                    className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm"
                  >
                    <UploadCloud size={14} />
                    <span>{language === "EN" ? "Upload First Document" : "প্রথম ডকুমেন্ট আপলোড করুন"}</span>
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] text-gray-500 font-semibold">
                        <th className="p-3.5">{language === "EN" ? "Document Title / File" : "ডকুমেন্ট শিরোনাম / ফাইল"}</th>
                        <th className="p-3.5">{language === "EN" ? "Class & Subject" : "শ্রেণি ও বিষয়"}</th>
                        <th className="p-3.5">{language === "EN" ? "Chapter / Unit" : "অধ্যায়"}</th>
                        <th className="p-3.5 text-center">{language === "EN" ? "Chunks" : "চাঙ্ক সংখ্যা"}</th>
                        <th className="p-3.5">{language === "EN" ? "Status" : "অবস্থা"}</th>
                        <th className="p-3.5">{language === "EN" ? "Uploaded At" : "আপলোড তারিখ"}</th>
                        <th className="p-3.5 text-right">{language === "EN" ? "Action" : "অ্যাকশন"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                      {curriculumDocs.map((doc) => {
                        const fileSizeMb = doc.file_size_bytes 
                          ? (doc.file_size_bytes / (1024 * 1024)).toFixed(2) + " MB" 
                          : null;
                        return (
                          <tr key={doc.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                            <td className="p-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl shrink-0">
                                  <FileText size={16} />
                                </div>
                                <div>
                                  <div className="font-semibold text-gray-900 dark:text-white">{doc.title}</div>
                                  <div className="text-[11px] text-gray-400 font-mono flex items-center gap-1.5 mt-0.5">
                                    <span>{doc.file_name || doc.filename || "file"}</span>
                                    {fileSizeMb && <span>• {fileSizeMb}</span>}
                                    {doc.file_type && <span className="uppercase text-[9px] bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded font-sans">{doc.file_type}</span>}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="p-3.5">
                              <span className="font-medium text-gray-800 dark:text-gray-200">{doc.class_name}</span>
                              <div className="text-[11px] text-gray-400">{doc.subject}</div>
                            </td>
                            <td className="p-3.5 text-gray-600 dark:text-gray-400">
                              {doc.chapter || "—"}
                            </td>
                            <td className="p-3.5 text-center font-mono font-bold text-blue-600 dark:text-purple-400">
                              {doc.chunks_count}
                            </td>
                            <td className="p-3.5">
                              {doc.status === "INDEXED" ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                                  <CheckCircle2 size={11} /> INDEXED
                                </span>
                              ) : doc.status === "PARSING" ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-800">
                                  <Loader2 size={11} className="animate-spin" /> PARSING
                                </span>
                              ) : doc.status === "FAILED" ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800" title={doc.error_message || undefined}>
                                  <AlertTriangle size={11} /> FAILED
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                                  <Clock size={11} /> {doc.status || "PENDING"}
                                </span>
                              )}
                            </td>
                            <td className="p-3.5 text-gray-500 font-mono text-[11px]">
                              {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : "—"}
                            </td>
                            <td className="p-3.5 text-right">
                              <button
                                onClick={() => handleDeleteDoc(doc.id, doc.title)}
                                className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                                title={language === "EN" ? "Delete document and chunks" : "ডকুমেন্ট ও নলেজ চাঙ্ক মুছে ফেলুন"}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 4: Daily Teaching Hub & Handouts ================= */}
        {activeTab === "lessons" && (
          <div className="space-y-8">
            {/* Header / Intro */}
            <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 p-6 rounded-3xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Sparkles size={18} className="text-purple-500" />
                  <span>{language === "EN" ? "TeacherOS Daily Teaching Hub & AI Handouts" : "দৈনিক পাঠদান হাব ও এআই লেকচার শিট"}</span>
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  {language === "EN"
                    ? "Prepare daily lectures, generate 1-page student handouts with homework, and record immutable curriculum logs."
                    : "শ্রেণিকক্ষের লেকচার প্রস্তুত করুন, বাড়ির কাজের শিট তৈরি করুন এবং পাঠদান অডিট লগ সংরক্ষণ করুন।"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500">Quick Class:</span>
                <select
                  value={lessonForm.class_name}
                  onChange={(e) => {
                    setLessonForm({ ...lessonForm, class_name: e.target.value });
                    setAiGeneratorForm({ ...aiGeneratorForm, class_name: e.target.value });
                  }}
                  className="bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs text-gray-900 dark:text-white outline-none font-semibold"
                >
                  {classes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* 2-Column Interactive Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              
              {/* Left Column: Daily Lesson Logger (Anti-Drift Curriculum Record) */}
              <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 p-6 rounded-3xl shadow-sm space-y-5">
                <div className="flex justify-between items-center border-b border-gray-100 dark:border-white/5 pb-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <BookOpen size={16} className="text-blue-500" />
                      <span>{language === "EN" ? "Daily Lesson Planner & Audit Trail" : "দৈনিক পাঠদান ও কারিকুলাম লগ"}</span>
                    </h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Log lecture coverage to the institutional curriculum audit trail.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-md font-bold">
                    Official Record
                  </span>
                </div>

                {lessonLogStatus && (
                  <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    lessonLogStatus.type === "success" 
                      ? "bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300"
                      : "bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
                  }`}>
                    {lessonLogStatus.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    <span>{lessonLogStatus.text}</span>
                  </div>
                )}

                <form onSubmit={handleLogLesson} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-gray-700 dark:text-gray-400">Class *</label>
                      <select
                        value={lessonForm.class_name}
                        onChange={(e) => setLessonForm({ ...lessonForm, class_name: e.target.value })}
                        className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none font-semibold text-gray-900 dark:text-white"
                      >
                        {classes.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-gray-700 dark:text-gray-400">Subject *</label>
                      <input
                        required
                        value={lessonForm.subject}
                        onChange={(e) => setLessonForm({ ...lessonForm, subject: e.target.value })}
                        className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none text-gray-900 dark:text-white"
                        placeholder="e.g. General Science"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-gray-700 dark:text-gray-400">Educator / Teacher *</label>
                      <input
                        required
                        value={lessonForm.teacher_name}
                        onChange={(e) => setLessonForm({ ...lessonForm, teacher_name: e.target.value })}
                        className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none text-gray-900 dark:text-white"
                        placeholder="e.g. Mahfuz Alam"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-gray-700 dark:text-gray-400">Topic Title *</label>
                      <input
                        required
                        value={lessonForm.topic_title}
                        onChange={(e) => setLessonForm({ ...lessonForm, topic_title: e.target.value })}
                        className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none text-gray-900 dark:text-white"
                        placeholder="e.g. Chapter 4: Photosynthesis & Energy"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-gray-700 dark:text-gray-400">Lecture Summary & Notes *</label>
                    <textarea
                      required
                      rows={4}
                      value={lessonForm.lecture_summary}
                      onChange={(e) => setLessonForm({ ...lessonForm, lecture_summary: e.target.value })}
                      className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none text-gray-900 dark:text-white resize-y font-mono text-[11px]"
                      placeholder="Outline key concepts explained, formulas covered, and student questions addressed..."
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="font-semibold text-gray-700 dark:text-gray-400">Homework Assigned</label>
                      <input
                        value={lessonForm.homework_assigned}
                        onChange={(e) => setLessonForm({ ...lessonForm, homework_assigned: e.target.value })}
                        className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none text-gray-900 dark:text-white"
                        placeholder="e.g. Exercise 4.2 Questions 1 to 5"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-gray-700 dark:text-gray-400">Submission Due</label>
                      <input
                        value={lessonForm.submission_deadline}
                        onChange={(e) => setLessonForm({ ...lessonForm, submission_deadline: e.target.value })}
                        className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none text-gray-900 dark:text-white"
                        placeholder="Next Class"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loggingLesson}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50"
                  >
                    {loggingLesson ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Logging to Audit Trail...</span>
                      </>
                    ) : (
                      <>
                        <BookOpen size={14} />
                        <span>Save Lesson to Audit Trail</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Right Column: AI Handout & Homework Generator */}
              <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 p-6 rounded-3xl shadow-sm space-y-5">
                <div className="flex justify-between items-center border-b border-gray-100 dark:border-white/5 pb-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Sparkles size={16} className="text-purple-500" />
                      <span>{language === "EN" ? "AI Handout & Homework Generator" : "এআই লেকচার শিট ও হোমওয়ার্ক জেনারেটর"}</span>
                    </h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Grounds lesson content in NCTB textbooks via RAG with clear exercises.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 px-2.5 py-1 rounded-md font-bold">
                    RAG Grounded
                  </span>
                </div>

                {handoutError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-xl text-xs flex items-center gap-2">
                    <AlertTriangle size={16} />
                    <span>{handoutError}</span>
                  </div>
                )}

                <form onSubmit={handleGenerateMaterials} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-gray-700 dark:text-gray-400">Class</label>
                      <select
                        value={aiGeneratorForm.class_name}
                        onChange={(e) => setAiGeneratorForm({ ...aiGeneratorForm, class_name: e.target.value })}
                        className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none font-semibold text-gray-900 dark:text-white"
                      >
                        {classes.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-gray-700 dark:text-gray-400">Subject</label>
                      <input
                        required
                        value={aiGeneratorForm.subject}
                        onChange={(e) => setAiGeneratorForm({ ...aiGeneratorForm, subject: e.target.value })}
                        className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none text-gray-900 dark:text-white"
                        placeholder="e.g. General Science"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-gray-700 dark:text-gray-400">Topic / Chapter Title *</label>
                    <input
                      required
                      value={aiGeneratorForm.topic_title}
                      onChange={(e) => setAiGeneratorForm({ ...aiGeneratorForm, topic_title: e.target.value })}
                      className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none text-gray-900 dark:text-white"
                      placeholder="e.g. Chapter 4: Fractions and Decimal Operations"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={generatingHandout}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white p-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50"
                  >
                    {generatingHandout ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Generating Grounded Handout...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        <span>Generate 1-Page Teaching Handout</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Generated Handout Interactive Preview */}
                {generatedHandout && (
                  <div className="mt-4 p-4 bg-purple-50/50 dark:bg-white/[0.02] border border-purple-200 dark:border-purple-500/20 rounded-2xl space-y-3 animate-in fade-in">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-green-500" />
                        <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                          {generatedHandout.topic_title}
                        </h4>
                      </div>
                      <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/40 px-2 py-0.5 rounded-full">
                        Ready for Print
                      </span>
                    </div>

                    <div className="max-h-56 overflow-y-auto custom-scrollbar p-3 bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-xs whitespace-pre-wrap font-sans leading-relaxed text-gray-700 dark:text-gray-400">
                      {generatedHandout.handout_content}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 border-t border-purple-100 dark:border-white/5">
                      <button
                        type="button"
                        onClick={() => handlePrintHandout(generatedHandout)}
                        className="bg-gray-900 hover:bg-black text-white dark:bg-white dark:text-black dark:hover:bg-gray-200 px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                      >
                        <Printer size={13} />
                        <span>Print Handout (A4)</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleTransferToLessonForm}
                        className="bg-purple-100 dark:bg-purple-900/40 hover:bg-purple-200 dark:hover:bg-purple-800/40 text-purple-700 dark:text-purple-300 px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                      >
                        <ArrowRight size={13} />
                        <span>Transfer to Lesson Planner</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Section: Daily Lesson History & Audit Trail */}
            <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 p-6 rounded-3xl shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-100 dark:border-white/5 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Calendar size={16} className="text-blue-500" />
                    <span>{language === "EN" ? "Daily Lesson History & Audit Trail" : "দৈনিক পাঠদান ইতিহাস ও অডিট ট্রেইল"}</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Recent curriculum logs delivered by educators across classes.
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={historyClassFilter}
                    onChange={(e) => setHistoryClassFilter(e.target.value)}
                    className="bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs text-gray-900 dark:text-white outline-none font-semibold"
                  >
                    <option value="all">All Classes</option>
                    {classes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>

                  <button
                    onClick={() => fetchLessonHistory()}
                    className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5"
                    title="Refresh History"
                  >
                    <RefreshCw size={14} className={loadingHistory ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>

              {loadingHistory ? (
                <div className="p-8 text-center text-gray-500 flex justify-center items-center gap-2">
                  <Loader2 className="animate-spin text-blue-500" size={18} />
                  <span>Loading lesson history...</span>
                </div>
              ) : lessonHistory.length === 0 ? (
                <div className="p-8 text-center text-gray-400 bg-gray-50/50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 rounded-2xl text-xs">
                  No lesson logs recorded yet for {historyClassFilter === "all" ? "any class" : historyClassFilter}.
                </div>
              ) : (
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-white/10 text-gray-400 font-semibold text-[11px]">
                        <th className="p-3">Date</th>
                        <th className="p-3">Class & Subject</th>
                        <th className="p-3">Topic Title</th>
                        <th className="p-3">Educator</th>
                        <th className="p-3">Homework</th>
                        <th className="p-3">Due</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                      {lessonHistory.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="p-3 font-mono text-gray-500 text-[11px] whitespace-nowrap">
                            {item.lesson_date ? new Date(item.lesson_date).toLocaleDateString("en-GB") : (item.date || "Today")}
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-gray-900 dark:text-white">{item.class_name}</span>
                            <span className="text-gray-400 ml-1.5 font-medium">{item.subject}</span>
                          </td>
                          <td className="p-3 font-semibold text-gray-800 dark:text-gray-200 max-w-xs truncate">
                            {item.topic_title}
                          </td>
                          <td className="p-3 text-gray-600 dark:text-gray-400">
                            {item.teacher_name}
                          </td>
                          <td className="p-3 text-gray-500 max-w-xs truncate">
                            {item.homework_assigned || "—"}
                          </td>
                          <td className="p-3 font-mono text-[11px] text-gray-500">
                            {item.submission_deadline || "Next Class"}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => setSelectedLessonLog(item)}
                              className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                            >
                              <Eye size={12} />
                              <span>View Notes</span>
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

      {/* ================= OFFICIAL PRINT-ONLY SHEET (A4 HANDOUT) ================= */}
      {handoutToPrint && (
        <div className="hidden print:block font-serif text-black p-8 bg-white max-w-[210mm] mx-auto text-xs leading-normal">
          <div className="text-center border-b-2 border-black pb-3 mb-4">
            <h1 className="text-2xl font-black uppercase tracking-wider">{name}</h1>
            <p className="text-[10px] italic">Official Daily Teaching Handout & Homework Assignment</p>
            <div className="flex justify-between items-center text-xs mt-3 pt-2 border-t border-gray-400 font-sans">
              <span><strong>Class:</strong> {handoutToPrint.class_name}</span>
              <span><strong>Subject:</strong> {handoutToPrint.subject}</span>
              <span><strong>Date:</strong> {handoutToPrint.date}</span>
              <span><strong>Educator:</strong> {handoutToPrint.teacher || "Faculty"}</span>
            </div>
          </div>

          <div className="mb-4">
            <h2 className="text-base font-bold font-sans mb-2 uppercase tracking-wide">
              Topic: {handoutToPrint.topic}
            </h2>
            <div className="whitespace-pre-wrap font-sans text-xs leading-relaxed border p-4 rounded bg-gray-50/50">
              {handoutToPrint.content}
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-black flex justify-between text-[11px] font-sans">
            <div>Student Name: _______________________</div>
            <div>Roll: _________</div>
            <div>Teacher Signature: __________________</div>
          </div>
        </div>
      )}

      {/* ================= OFFICIAL PRINT-ONLY SHEET (A4 TIMETABLE) ================= */}
      <div className={`hidden ${!handoutToPrint ? "print:block" : "print:hidden"} font-serif text-black p-6 bg-white max-w-[210mm] mx-auto text-xs leading-normal`}>
        <div className="text-center border-b-2 border-black pb-3 mb-4">
          <h2 className="text-xl font-black uppercase tracking-wider">{name}</h2>
          <p className="text-[10px] italic">Official Class Timetable • Academic Session 2027</p>
          <div className="mt-2 font-sans text-xs font-bold uppercase">
            {selectedClass} — {selectedDay} Schedule
          </div>
        </div>

        <table className="w-full text-left border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-gray-100 font-sans text-[11px]">
              <th className="border border-black p-2">Period</th>
              <th className="border border-black p-2">Timing</th>
              <th className="border border-black p-2">Subject</th>
              <th className="border border-black p-2">Teacher</th>
              <th className="border border-black p-2">Room</th>
            </tr>
          </thead>
          <tbody>
            {routines.map((r) => (
              <tr key={r.id}>
                <td className="border border-black p-2 font-bold">{r.period_number}</td>
                <td className="border border-black p-2 font-mono">{r.start_time} - {r.end_time}</td>
                <td className="border border-black p-2 font-bold">{r.subject}</td>
                <td className="border border-black p-2">{r.teacher_name}</td>
                <td className="border border-black p-2">{r.room_number}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-between pt-16 text-[10px] font-sans">
          <div className="text-center">
            <div className="w-32 border-t border-black mb-1"></div>
            <span>Academic Coordinator</span>
          </div>
          <div className="text-center">
            <div className="w-32 border-t border-black mb-1"></div>
            <span>Head of Institution</span>
          </div>
        </div>
      </div>

      {/* Routine Slot Creation Modal */}
      {isRoutineModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsRoutineModalOpen(false);
          }}
          role="presentation"
        >
          <div
            className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl sm:rounded-3xl w-full max-w-md max-h-[92vh] max-w-[calc(100vw-1.5rem)] p-5 sm:p-6 shadow-2xl space-y-4 overflow-y-auto custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-white/10">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Assign Class Period</h3>
              <button onClick={() => setIsRoutineModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <form onSubmit={handleAddSlot} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-700 dark:text-gray-400">Period Slot *</label>
                  <input
                    required
                    value={routineForm.period_number}
                    onChange={(e) => setRoutineForm({...routineForm, period_number: e.target.value})}
                    className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none"
                    placeholder="Period 1"
                  />
                </div>
                <div>
                  <label className="font-semibold text-gray-700 dark:text-gray-400">Subject *</label>
                  <input
                    required
                    value={routineForm.subject}
                    onChange={(e) => setRoutineForm({...routineForm, subject: e.target.value})}
                    className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none"
                    placeholder="e.g. Mathematics"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-700 dark:text-gray-400">Start Time *</label>
                  <input
                    required
                    value={routineForm.start_time}
                    onChange={(e) => setRoutineForm({...routineForm, start_time: e.target.value})}
                    className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none font-mono"
                    placeholder="09:00 AM"
                  />
                </div>
                <div>
                  <label className="font-semibold text-gray-700 dark:text-gray-400">End Time *</label>
                  <input
                    required
                    value={routineForm.end_time}
                    onChange={(e) => setRoutineForm({...routineForm, end_time: e.target.value})}
                    className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none font-mono"
                    placeholder="09:45 AM"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-400">Educator / Teacher *</label>
                <input
                  required
                  value={routineForm.teacher_name}
                  onChange={(e) => setRoutineForm({...routineForm, teacher_name: e.target.value})}
                  className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none"
                  placeholder="e.g. Mahfuz Alam"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-400">Room</label>
                <input
                  value={routineForm.room_number}
                  onChange={(e) => setRoutineForm({...routineForm, room_number: e.target.value})}
                  className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none"
                  placeholder="Room 101"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-white/10">
                <button type="button" onClick={() => setIsRoutineModalOpen(false)} className="px-4 py-2 font-semibold text-gray-500">Cancel</button>
                <button
                  type="submit"
                  disabled={submittingRoutine}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  {submittingRoutine ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Save Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Class Creation Modal */}
      {isClassModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsClassModalOpen(false);
          }}
          role="presentation"
        >
          <div
            className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl sm:rounded-3xl w-full max-w-md max-h-[92vh] max-w-[calc(100vw-1.5rem)] p-5 sm:p-6 shadow-2xl space-y-4 overflow-y-auto custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-white/10">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                {language === "EN" ? "Add New Class" : "নতুন ক্লাস যোগ করুন"}
              </h3>
              <button onClick={() => setIsClassModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateClass} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-400">Class Name *</label>
                <input
                  required
                  value={classForm.name}
                  onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                  className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none"
                  placeholder="e.g. Class 6"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-400">Curriculum Description</label>
                <input
                  value={classForm.description}
                  onChange={(e) => setClassForm({ ...classForm, description: e.target.value })}
                  className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 outline-none"
                  placeholder="Optional description"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-white/10">
                <button type="button" onClick={() => setIsClassModalOpen(false)} className="px-4 py-2 font-semibold text-gray-500">Cancel</button>
                <button
                  type="submit"
                  disabled={submittingClass}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  {submittingClass ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Save Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Curriculum Document Upload Modal (RAG Grounding) */}
      {isUploadModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (!uploadingDoc && e.target === e.currentTarget) setIsUploadModalOpen(false);
          }}
          role="presentation"
        >
          <div
            className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl sm:rounded-3xl w-full max-w-lg p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] max-w-[calc(100vw-1.5rem)] overflow-y-auto custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-white/10">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <UploadCloud className="text-blue-600 dark:text-purple-400" size={20} />
                <span>{language === "EN" ? "Upload Curriculum Document (RAG Grounding)" : "কারিকুলাম ফাইল আপলোড ও ইনডেক্সিং"}</span>
              </h3>
              <button 
                onClick={() => setIsUploadModalOpen(false)} 
                disabled={uploadingDoc}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            {uploadError && (
              <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>{uploadError}</span>
                </div>
                {activeJob?.id && (
                  <button
                    type="button"
                    onClick={handleRetryJob}
                    disabled={isRetryingJob}
                    className="px-2.5 py-1 bg-red-600 text-white rounded-lg text-[11px] font-bold shrink-0 hover:bg-red-700 flex items-center gap-1"
                  >
                    {isRetryingJob ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    <span>Retry</span>
                  </button>
                )}
              </div>
            )}

            {uploadSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            {activeJob && uploadingDoc ? (
              <div className="space-y-4 py-2">
                <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
                      <span className="font-bold text-gray-900 dark:text-white capitalize">
                        {activeJob.stage === "queued" && (language === "EN" ? "Queued for processing" : "প্রক্রিয়াকরণের জন্য অপেক্ষারত")}
                        {activeJob.stage === "validating" && (language === "EN" ? "Validating Document" : "ডকুমেন্ট যাচাইকরণ")}
                        {activeJob.stage === "extracting" && (language === "EN" ? "Extracting Text Streams" : "টেক্সট স্ট্রিম এক্সট্র্যাক্ট করা হচ্ছে")}
                        {activeJob.stage === "chunking" && (language === "EN" ? "Segmenting Knowledge Chunks" : "নলেজ চাঙ্ক সেগমেন্টেশন")}
                        {activeJob.stage === "indexing" && (language === "EN" ? "Generating Semantic Embeddings & Indexing" : "এমবেডিং তৈরি ও ইনডেক্সিং")}
                        {activeJob.stage === "completed" && (language === "EN" ? "Indexing Complete" : "ইনডেক্সিং সম্পন্ন")}
                        {activeJob.stage === "cancelling" && (language === "EN" ? "Cancelling Job..." : "বাতিল করা হচ্ছে...")}
                        {activeJob.stage === "cancelled" && (language === "EN" ? "Ingestion Cancelled" : "ইনডেক্সিং বাতিল")}
                        {activeJob.stage === "failed" && (language === "EN" ? "Ingestion Failed" : "ইনডেক্সিং ব্যর্থ")}
                      </span>
                    </div>
                    <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      {activeJob.progress_pct}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${Math.max(5, activeJob.progress_pct)}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-gray-500 dark:text-gray-400">
                    <span className="truncate max-w-[200px]">{activeJob.file_name || activeJob.title}</span>
                    <span>
                      {language === "EN" ? "Chunks Indexed: " : "চাঙ্ক ইনডেক্সড: "}
                      <strong className="font-mono text-gray-900 dark:text-white">{activeJob.chunks_indexed || 0}</strong>
                      {activeJob.chunks_total ? ` / ${activeJob.chunks_total}` : ""}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCancelJob}
                    disabled={isCancellingJob || activeJob.status === "INDEXED" || activeJob.status === "FAILED"}
                    className="px-4 py-2 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    {isCancellingJob ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                    <span>{language === "EN" ? "Cancel Ingestion" : "ইনডেক্সিং বাতিল"}</span>
                  </button>
                  {activeJob.status === "FAILED" && (
                    <button
                      type="button"
                      onClick={handleRetryJob}
                      disabled={isRetryingJob}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                    >
                      {isRetryingJob ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                      <span>{language === "EN" ? "Retry Ingestion" : "পুনরায় চেষ্টা করুন"}</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
            <form onSubmit={handleUploadCurriculum} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-400">
                  {language === "EN" ? "Document Title *" : "ডকুমেন্টের শিরোনাম *"}
                </label>
                <input
                  required
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs text-gray-900 dark:text-white outline-none"
                  placeholder={language === "EN" ? "e.g. NCTB Class 9 Chemistry Chapter 3" : "যেমন: এনসিটিবি ৯ম শ্রেণি রসায়ন অধ্যায় ৩"}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-700 dark:text-gray-400">
                    {language === "EN" ? "Academic Class *" : "শ্রেণি *"}
                  </label>
                  <select
                    value={uploadForm.class_name}
                    onChange={(e) => setUploadForm({ ...uploadForm, class_name: e.target.value })}
                    className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs text-gray-900 dark:text-white outline-none"
                  >
                    {classes.map((cls) => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-gray-700 dark:text-gray-400">
                    {language === "EN" ? "Subject *" : "বিষয় *"}
                  </label>
                  <input
                    required
                    value={uploadForm.subject}
                    onChange={(e) => setUploadForm({ ...uploadForm, subject: e.target.value })}
                    className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs text-gray-900 dark:text-white outline-none"
                    placeholder="e.g. Physics / রসায়ন"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-700 dark:text-gray-400">
                    {language === "EN" ? "Chapter / Unit (Optional)" : "অধ্যায় বা পরিচ্ছেদ (ঐচ্ছিক)"}
                  </label>
                  <input
                    value={uploadForm.chapter}
                    onChange={(e) => setUploadForm({ ...uploadForm, chapter: e.target.value })}
                    className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs text-gray-900 dark:text-white outline-none"
                    placeholder="e.g. Chapter 3: Atomic Structure"
                  />
                </div>

                <div>
                  <label className="font-semibold text-gray-700 dark:text-gray-400">
                    {language === "EN" ? "Academic Session / Year" : "শিক্ষাবর্ষ"}
                  </label>
                  <input
                    value={uploadForm.academic_year}
                    onChange={(e) => setUploadForm({ ...uploadForm, academic_year: e.target.value })}
                    className="w-full mt-1 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs text-gray-900 dark:text-white outline-none"
                    placeholder="2026"
                  />
                </div>
              </div>

              {/* File Dropzone */}
              <div>
                <label className="font-semibold text-gray-700 dark:text-gray-400 mb-1.5 block">
                  {language === "EN" ? "Document File (.pdf, .docx, .txt, max 25MB) *" : "ডকুমেন্ট ফাইল (.pdf, .docx, .txt, সর্বোচ্চ ২৫ মেগাবাইট) *"}
                </label>
                <div 
                  className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all ${
                    selectedFile 
                      ? "border-blue-500 bg-blue-50/30 dark:bg-blue-950/20" 
                      : "border-gray-200 dark:border-white/10 hover:border-blue-400 bg-gray-50/50 dark:bg-white/[0.02]"
                  }`}
                >
                  <input
                    type="file"
                    id="curriculum-file-input"
                    accept=".pdf,.docx,.doc,.txt,.md"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                  {selectedFile ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 text-left">
                        <FileText className="text-blue-600 dark:text-purple-400 shrink-0" size={24} />
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white truncate max-w-xs">{selectedFile.name}</div>
                          <div className="text-[10px] text-gray-400 font-mono">
                            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="text-gray-400 hover:text-red-500 p-1"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <label htmlFor="curriculum-file-input" className="cursor-pointer block space-y-1">
                      <UploadCloud className="mx-auto text-gray-400" size={28} />
                      <div className="font-semibold text-gray-700 dark:text-gray-400">
                        {language === "EN" ? "Click to browse or drag file here" : "ফাইল নির্বাচন করতে এখানে ক্লিক করুন"}
                      </div>
                      <div className="text-[10px] text-gray-400">PDF textbooks, Word lecture notes, or Plain text syllabus</div>
                    </label>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  disabled={uploadingDoc}
                  className="px-4 py-2 text-xs font-semibold text-gray-500"
                >
                  {language === "EN" ? "Cancel" : "বাতিল"}
                </button>
                <button
                  type="submit"
                  disabled={uploadingDoc || !selectedFile}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {uploadingDoc ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>{language === "EN" ? "Parsing & Indexing..." : "ইন্ডেক্সিং চলছে..."}</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud size={14} />
                      <span>{language === "EN" ? "Upload & Index" : "আপলোড ও ইন্ডেক্স"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}

      {/* Subject Competency & Learning Outcomes Modal */}
      {selectedSubjectModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedSubjectModal(null);
          }}
          role="presentation"
        >
          <div
            className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl sm:rounded-3xl w-full max-w-xl max-h-[92vh] max-w-[calc(100vw-1.5rem)] p-5 sm:p-6 shadow-2xl space-y-5 overflow-y-auto custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex justify-between items-start pb-3 border-b border-gray-100 dark:border-white/10">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-gray-500 bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded">
                    {selectedSubjectModal.code}
                  </span>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {selectedSubjectModal.subjectName}
                  </h3>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedSubjectModal.className} • {selectedSubjectModal.weeklyPeriods} Weekly Periods
                </p>
              </div>
              <button
                onClick={() => setSelectedSubjectModal(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={18} />
              </button>
            </div>

            {/* RAG Status */}
            <div className="p-3 bg-blue-50/50 dark:bg-white/[0.02] border border-blue-100 dark:border-white/10 rounded-xl flex items-center justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">RAG Knowledge Grounding:</span>
              {selectedSubjectModal.ragChunks > 0 ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                  <Sparkles size={11} /> {selectedSubjectModal.ragChunks} Vector Chunks
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-white/10 text-gray-500">
                  NCTB Framework Baseline
                </span>
              )}
            </div>

            {/* Core Competencies */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-400">
                Core Competencies
              </h4>
              <div className="space-y-2">
                {selectedSubjectModal.competencies.map((c) => (
                  <div key={c.name} className="p-3 bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/5 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900 dark:text-white">{c.name}</span>
                      <span className="text-[10px] font-mono bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
                        {c.tag}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">{c.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Learning Outcomes Checklist */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-400">
                Key Learning Outcomes
              </h4>
              <ul className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
                {selectedSubjectModal.learningOutcomes.map((lo, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-green-500 shrink-0 mt-0.5" />
                    <span>{lo}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-white/10">
              <button
                type="button"
                onClick={() => setSelectedSubjectModal(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-500"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const subjectToSet = selectedSubjectModal.subjectName;
                  const classToSet = selectedSubjectModal.className;
                  setSelectedSubjectModal(null);
                  setActiveTab("lessons");
                  setLessonForm({
                    ...lessonForm,
                    class_name: classToSet,
                    subject: subjectToSet,
                  });
                  setAiGeneratorForm({
                    ...aiGeneratorForm,
                    class_name: classToSet,
                    subject: subjectToSet,
                  });
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm"
              >
                <Sparkles size={13} />
                <span>Create Lesson for this Subject</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lesson Log Full Detail Modal */}
      {selectedLessonLog && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedLessonLog(null);
          }}
          role="presentation"
        >
          <div
            className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl sm:rounded-3xl w-full max-w-xl max-h-[92vh] max-w-[calc(100vw-1.5rem)] p-5 sm:p-6 shadow-2xl space-y-4 overflow-y-auto custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex justify-between items-start pb-3 border-b border-gray-100 dark:border-white/10">
              <div>
                <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded font-bold">
                  {selectedLessonLog.class_name} • {selectedLessonLog.subject}
                </span>
                <h3 className="text-base font-bold text-gray-900 dark:text-white mt-1">
                  {selectedLessonLog.topic_title}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Educator: <strong>{selectedLessonLog.teacher_name}</strong> • Date: {selectedLessonLog.lesson_date ? new Date(selectedLessonLog.lesson_date).toLocaleDateString("en-GB") : (selectedLessonLog.date || "Today")}
                </p>
              </div>
              <button
                onClick={() => setSelectedLessonLog(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <h4 className="text-xs font-bold text-gray-700 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                Lecture Notes & Concepts
              </h4>
              <div className="p-3 bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/5 rounded-xl text-xs text-gray-700 dark:text-gray-400 whitespace-pre-wrap leading-relaxed">
                {selectedLessonLog.lecture_summary}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/5 rounded-xl">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold block">Homework Assigned</span>
                <span className="font-semibold text-gray-900 dark:text-white mt-1 block">
                  {selectedLessonLog.homework_assigned || "None"}
                </span>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/5 rounded-xl">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold block">Submission Deadline</span>
                <span className="font-semibold text-gray-900 dark:text-white mt-1 block">
                  {selectedLessonLog.submission_deadline || "Next Class"}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-white/10">
              <button
                type="button"
                onClick={() => setSelectedLessonLog(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}