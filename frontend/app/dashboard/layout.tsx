"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLanguage } from "@/components/providers";
import { CommandMenu } from "@/components/CommandMenu";
import SettingsModal from "@/components/SettingsModal";
import { WorkspaceProvider, useWorkspace } from "@/lib/workspaceContext";
import { RagJobProvider } from "@/lib/ragJobContext";
import WorkspaceSwitcher from "@/components/WorkspaceSwitcher";
import VoiceLessonModal from "@/components/VoiceLessonModal";
import { clearSession, performLogout, fetchWithTenant } from "@/lib/api-client";
import { 
  LayoutDashboard, Users, GraduationCap, BookOpen, 
  Settings as SettingsIcon, LogOut, Fingerprint, Trophy, School, 
  Menu, ChevronLeft, Globe, ShieldCheck, MessageSquare, Building2, Phone, Wallet, ShieldAlert,
  Languages, Mic, HelpCircle, CalendarCheck, BrainCircuit, Sparkles, UserPlus
} from "lucide-react";
import RoleRouteGuard from "@/components/RoleRouteGuard";
import OfflineBanner from "@/components/OfflineBanner";
import ThemeToggle from "@/components/ThemeToggle";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { language, toggleLanguage } = useLanguage();
  const { currentWorkspace } = useWorkspace();
  
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [userRole, setUserRole] = useState<string>("admin");
  const [userName, setUserName] = useState<string>("Principal Admin");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [subStatus, setSubStatus] = useState<{
    status: string;
    is_active: boolean;
    is_trial?: boolean;
    subscription_status: string;
    plan_key: string;
    plan_name: string;
    days_remaining: number;
    valid_until: string;
  } | null>(null);

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // 1. Authenticate and Initialize User
  useEffect(() => {
    const token = localStorage.getItem("access_token") || localStorage.getItem("token");
    if (!token) {
      router.replace("/login");
      return;
    }

    const role = (localStorage.getItem("user_role") || "admin").toLowerCase();
    const name = localStorage.getItem("user_name") || "Principal Admin";
    queueMicrotask(() => {
      setMounted(true);
      setUserRole(role);
      setUserName(name);
    });

    if (role === "admin") {
      fetchWithTenant("/api/v1/billing/status")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.status === "success") {
            setSubStatus(data);
          }
        })
        .catch(() => {});
    }
  }, [router]);

  // 2. Strict Role-Based and Workspace-Aware Navigation
  const getNavigationGroups = (): NavGroup[] => {
    const isAcademy = currentWorkspace?.type === "academy";

    // --- ACADEMY MODE (Coaching Model) ---
    if (isAcademy) {
      return [
        {
          title: language === "EN" ? "Academy Operations" : "একাডেমিক কেয়ার কার্যক্রম",
          items: [
            { name: language === "EN" ? "Overview" : "ওভারভিউ", href: "/dashboard", icon: LayoutDashboard },
            { name: language === "EN" ? "Programs & Batches" : "কোর্স ও ব্যাচসমূহ", href: "/dashboard/batches", icon: Users },
            { name: language === "EN" ? "Shift Routine" : "শিফট শিডিউল", href: "/dashboard/academic", icon: BookOpen },
            { name: language === "EN" ? "Live Exams & OMR" : "লাইভ এক্সাম ও ওএমআর", href: "/dashboard/live-exams", icon: Trophy },
          ]
        },
        {
          title: language === "EN" ? "Learning Studio" : "লার্নিং স্টুডিও ও এআই",
          items: [
            { name: language === "EN" ? "AI Doubt Solver" : "সক্রেটিক প্রবলেম সলভার", href: "/dashboard/doubt-solver", icon: HelpCircle },
            { name: language === "EN" ? "Question Bank" : "প্রশ্ন ব্যাংক ও এনালাইসিস", href: "/dashboard/exams", icon: BookOpen },
            { name: language === "EN" ? "Bulletins" : "জরুরি ঘোষণা", href: "/dashboard/notices", icon: School },
          ]
        },
        {
          title: language === "EN" ? "Accounts & Faculty" : "হিসাব ও ফ্যাকাল্টি",
          items: [
            { name: language === "EN" ? "Payment Ledger" : "ফি ও ক্যাশ লেজার", href: "/dashboard/finance", icon: Wallet },
            { name: language === "EN" ? "Faculty Panel" : "ফ্যাকাল্টি পরিষদ", href: "/dashboard/teachers", icon: GraduationCap },
            { name: language === "EN" ? "Action Center" : "অ্যাকশন সেন্টার", href: "/dashboard/approvals", icon: ShieldCheck },
          ]
        }
      ];
    }

    // --- SCHOOL MODE: Role Filtered (K-12 Model) ---
    if (userRole === "superadmin") {
      return [
        {
          title: language === "EN" ? "Platform Operations" : "প্ল্যাটফর্ম অপারেশনস",
          items: [
            { name: language === "EN" ? "Platform Console" : "প্ল্যাটফর্ম কনসোল", href: "/dashboard/platform", icon: Building2 },
            { name: language === "EN" ? "Tenant Registry" : "স্কুল ও একাডেমি তালিকা", href: "/dashboard/platform#tenants", icon: School },
            { name: language === "EN" ? "Payment Claims" : "পেমেন্ট অনুমোদন কিউ", href: "/dashboard/platform#payments", icon: Wallet },
            { name: language === "EN" ? "Action Center" : "অ্যাকশন সেন্টার", href: "/dashboard/approvals", icon: ShieldCheck },
          ]
        },
      ];
    }

    if (userRole === "teacher") {
      return [
        {
          title: language === "EN" ? "Classroom Operations" : "শ্রেণিকক্ষ ও পাঠদান",
          items: [
            { name: language === "EN" ? "Overview" : "ওভারভিউ", href: "/dashboard", icon: LayoutDashboard },
            { name: language === "EN" ? "Admissions" : "ভর্তি মূল্যায়ন", href: "/dashboard/admissions", icon: UserPlus },
            { name: language === "EN" ? "Daily Attendance" : "ডিজিটাল হাজিরা", href: "/dashboard/attendance", icon: Fingerprint },
            { name: language === "EN" ? "Results & Grading" : "ফলাফল ও মূল্যায়ন", href: "/dashboard/results", icon: Trophy },
            { name: language === "EN" ? "Question Papers" : "প্রশ্নপত্র প্রণয়ন", href: "/dashboard/exams", icon: BookOpen },
            { name: language === "EN" ? "Notice Board" : "বিজ্ঞপ্তি", href: "/dashboard/notices", icon: School },
            { name: language === "EN" ? "Timetable & Classes" : "ক্লাস রুটিন", href: "/dashboard/academic", icon: BookOpen },
            { name: language === "EN" ? "Guardian Directory" : "অভিভাবক ডিরেক্টরি", href: "/dashboard/guardians", icon: Phone },
          ]
        }
      ];
    }

    if (userRole === "student") {
      return [
        {
          title: language === "EN" ? "Student Workspace" : "শিক্ষার্থী কর্নার",
          items: [
            { name: language === "EN" ? "Study Room Overview" : "স্টাডি রুম (ওভারভিউ)", href: "/dashboard", icon: LayoutDashboard },
            { name: language === "EN" ? "Learning Studio (AI)" : "লার্নিং স্টুডিও (AI)", href: "/dashboard/learning", icon: BrainCircuit },
            { name: language === "EN" ? "My Attendance" : "আমার উপস্থিতি", href: "/dashboard/attendance", icon: Fingerprint },
            { name: language === "EN" ? "My Class Routine" : "আমার ক্লাস রুটিন", href: "/dashboard/academic", icon: BookOpen },
            { name: language === "EN" ? "Marks & Progress Card" : "ফলাফল ও মার্কশিট", href: "/dashboard/results", icon: Trophy },
            { name: language === "EN" ? "Live Exams" : "লাইভ পরীক্ষা", href: "/dashboard/live-exams", icon: GraduationCap },
            { name: language === "EN" ? "AI Doubt Solver" : "সক্রেটিক ডাউট সলভার", href: "/dashboard/doubt-solver", icon: HelpCircle },
            { name: language === "EN" ? "Fee & Receipt Status" : "ফি ও রসিদ", href: "/dashboard/finance", icon: Wallet },
            { name: language === "EN" ? "School Notices" : "স্কুল নোটিশ", href: "/dashboard/notices", icon: School },
            { name: language === "EN" ? "My Profile & Security" : "প্রোফাইল ও নিরাপত্তা", href: "/dashboard/profile", icon: ShieldCheck },
          ]
        }
      ];
    }

    if (userRole === "guardian") {
      return [
        {
          title: language === "EN" ? "Parent Portal" : "অভিভাবক পোর্টাল",
          items: [
            { name: language === "EN" ? "Children Overview" : "সন্তানদের সারসংক্ষেপ", href: "/dashboard", icon: LayoutDashboard },
            { name: language === "EN" ? "Child Progress Card" : "সন্তানের ফলাফল", href: "/dashboard/results", icon: Trophy },
            { name: language === "EN" ? "Attendance Record" : "উপস্থিতি রেকর্ড", href: "/dashboard/attendance", icon: Fingerprint },
            { name: language === "EN" ? "Fees & Payment Receipts" : "ফি ও পেমেন্ট রসিদ", href: "/dashboard/finance", icon: Wallet },
            { name: language === "EN" ? "Class Timetable" : "ক্লাস রুটিন", href: "/dashboard/academic", icon: BookOpen },
            { name: language === "EN" ? "School Notices" : "স্কুল নোটিশ", href: "/dashboard/notices", icon: School },
            { name: language === "EN" ? "Direct Help Desk" : "যোগাযোগ / ইনবক্স", href: "/dashboard/communication", icon: MessageSquare },
            { name: language === "EN" ? "Account & Security" : "প্রোফাইল ও নিরাপত্তা", href: "/dashboard/profile", icon: ShieldCheck },
          ]
        }
      ];
    }

    // Default: School Admin (Full Access)
    return [
      {
        title: language === "EN" ? "Daily Operations" : "দৈনন্দিন কার্যক্রম",
        items: [
          { name: language === "EN" ? "Overview" : "ওভারভিউ", href: "/dashboard", icon: LayoutDashboard },
          { name: language === "EN" ? "Students Base" : "শিক্ষার্থী তালিকা", href: "/dashboard/students", icon: Users },
          { name: language === "EN" ? "Daily Attendance" : "ডিজিটাল হাজিরা", href: "/dashboard/attendance", icon: Fingerprint },
          { name: language === "EN" ? "Results & Grading" : "ফলাফল ও মূল্যায়ন", href: "/dashboard/results", icon: Trophy },
          { name: language === "EN" ? "Question Papers" : "প্রশ্নপত্র প্রণয়ন", href: "/dashboard/exams", icon: BookOpen },
          { name: language === "EN" ? "Notice Composer" : "বিজ্ঞপ্তি প্রস্তুতকারক", href: "/dashboard/notices", icon: School },
          { name: language === "EN" ? "Fee Ledger" : "ফি ও হিসাব খাতা", href: "/dashboard/finance", icon: Wallet },
        ]
      },
      {
        title: language === "EN" ? "Institution & Staff" : "প্রতিষ্ঠান ও শিক্ষক",
        items: [
          { name: language === "EN" ? "Admissions" : "ভর্তি কার্যক্রম", href: "/dashboard/admissions", icon: UserPlus },
          { name: language === "EN" ? "Educators" : "শিক্ষকবৃন্দ", href: "/dashboard/teachers", icon: GraduationCap },
          { name: language === "EN" ? "Curriculum" : "পাঠ্যক্রম ও রুটিন", href: "/dashboard/academic", icon: BookOpen },
          { name: language === "EN" ? "Guardian Hub" : "অভিভাবক ডিরেক্টরি", href: "/dashboard/guardians", icon: Phone },
        ]
      },
      {
        title: language === "EN" ? "AI & Controls" : "এআই ও গভর্ন্যান্স",
        items: [
          { name: language === "EN" ? "Action Center" : "অ্যাকশন সেন্টার", href: "/dashboard/approvals", icon: ShieldCheck },
          { name: language === "EN" ? "Guardian Inbox" : "অভিভাবক ইনবক্স", href: "/dashboard/communication", icon: MessageSquare },
          { name: language === "EN" ? "Gov Copilot" : "আইপিইএমআইএস", href: "/dashboard/ipemis", icon: Building2 },
        ]
      }
    ];
  };

  // 🚀 Fixed Client-Side Route Guard (Whitelisted All New Routes)
  useEffect(() => {
    if (!mounted || userRole === "admin" || userRole === "superadmin") return;

    const allowedPrefixesByRole: Record<string, string[]> = {
      teacher: [
        "/dashboard",
        "/dashboard/admissions",
        "/dashboard/attendance",
        "/dashboard/results",
        "/dashboard/live-exams",
        "/dashboard/exams",
        "/dashboard/batches",
        "/dashboard/doubt-solver",
        "/dashboard/notices",
        "/dashboard/academic",
        "/dashboard/guardians",
        "/dashboard/voice-diary",
        "/dashboard/profile",
      ],
      student: [
        "/dashboard",
        "/dashboard/learning",
        "/dashboard/attendance",
        "/dashboard/live-exams",
        "/dashboard/doubt-solver",
        "/dashboard/results",
        "/dashboard/academic",
        "/dashboard/finance",
        "/dashboard/notices",
        "/dashboard/profile",
      ],
      guardian: [
        "/dashboard",
        "/dashboard/results",
        "/dashboard/attendance",
        "/dashboard/finance",
        "/dashboard/academic",
        "/dashboard/notices",
        "/dashboard/communication",
        "/dashboard/helpdesk",
        "/dashboard/profile",
      ],
      finance_officer: ["/dashboard", "/dashboard/finance", "/dashboard/profile"],
      accountant: ["/dashboard", "/dashboard/finance", "/dashboard/profile"],
    };

    const allowedList = allowedPrefixesByRole[userRole] || ["/dashboard"];
    const isAllowed = allowedList.some((route) => pathname === route || pathname.startsWith(`${route}/`));

    if (!isAllowed && pathname.startsWith("/dashboard")) {
      queueMicrotask(() => setAccessDenied(true));
      const timer = setTimeout(() => {
        setAccessDenied(false);
        router.replace("/dashboard");
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [pathname, userRole, mounted, router]);

  const handleLogout = async () => {
    await performLogout();
  };

  if (!mounted) return null;

  return (
    <div className="flex h-screen bg-[#f8f9fa] dark:bg-[#050505] text-gray-900 dark:text-gray-100 transition-colors duration-300 font-sans print:h-auto print:bg-white print:text-black">
      
      {/* Route Tampering Alert */}
      {accessDenied && (
        <div className="fixed top-5 right-5 z-[999999] bg-red-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-bold animate-in slide-in-from-top-4">
          <ShieldAlert size={18} />
          <span>অননুমোদিত অ্যাক্সেস নিষিদ্ধ! আপনার রোল ({userRole}) অনুযায়ী রিডিরেক্ট করা হচ্ছে...</span>
        </div>
      )}

      {/* Background Glows */}
      <div className="hidden dark:block fixed top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-600/10 blur-[150px] rounded-full pointer-events-none print:hidden" />
      <div className="hidden dark:block fixed bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-600/10 blur-[150px] rounded-full pointer-events-none print:hidden" />

      {/* Mobile Sidebar Overlay Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden animate-in fade-in duration-200"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar (Mobile Slide-Over Drawer + Desktop Collapsible) */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 md:static md:z-20 flex flex-col flex-shrink-0
          bg-white dark:bg-[#0f0f11] border-r border-gray-200 dark:border-white/[0.05]
          transition-all duration-300 ease-in-out shadow-2xl md:shadow-sm print:hidden
          ${isMobileOpen ? "translate-x-0 w-72" : "-translate-x-full md:translate-x-0"}
          ${isCollapsed ? "md:w-20" : "md:w-64"}
        `}
      >
        
        {/* Logo / Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-white/[0.05] shrink-0">
          <Link
            href="/dashboard"
            onClick={() => setIsMobileOpen(false)}
            className="flex items-center gap-3 overflow-hidden hover:opacity-80 transition-opacity"
          >
            <div className="p-2 bg-blue-50 dark:bg-white/5 rounded-xl border border-blue-100 dark:border-white/10 shadow-sm">
              <School className="text-blue-600 dark:text-purple-400 w-5 h-5 flex-shrink-0" />
            </div>
            {(!isCollapsed || isMobileOpen) && (
              <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white whitespace-nowrap">
                {currentWorkspace?.type === "academy" ? "AcademyOS" : "EducationOS"}
              </h1>
            )}
          </Link>

          {/* Close button on mobile */}
          <button
            onClick={() => setIsMobileOpen(false)}
            className="md:hidden p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            aria-label="Close sidebar"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        {/* Command Menu */}
        {(!isCollapsed || isMobileOpen) && (
          <div className="px-4 pt-5 pb-2 shrink-0">
            <CommandMenu />
          </div>
        )}

        {/* Dynamic Navigation Groups */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto custom-scrollbar space-y-6">
          {getNavigationGroups().map((group: NavGroup, idx: number) => (
            <div key={idx} className="space-y-1">
              {(!isCollapsed || isMobileOpen) && (
                <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400/80 dark:text-neutral-400 select-none">
                  {group.title}
                </div>
              )}
              {group.items.map((item: NavItem) => {
                const isActive = pathname === item.href || (pathname.startsWith(`${item.href}/`) && item.href !== "/dashboard");
                const Icon = item.icon;
                return (
                  <Link 
                    key={item.name} 
                    href={item.href} 
                    onClick={() => setIsMobileOpen(false)}
                    title={isCollapsed && !isMobileOpen ? item.name : ""}
                    className={`flex items-center px-3 py-2 rounded-xl transition-all duration-200 group ${
                      isActive
                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 dark:bg-white/10 dark:text-white dark:border dark:border-white/10 dark:shadow-none font-bold"
                        : "text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    <Icon className={`h-4 w-4 flex-shrink-0 ${
                      isActive 
                        ? "text-white" 
                        : "text-gray-500 group-hover:text-gray-900 dark:text-neutral-400 dark:group-hover:text-white"
                    } ${(!isCollapsed || isMobileOpen) ? "mr-3" : ""}`} />

                    {(!isCollapsed || isMobileOpen) && (
                      <span className="text-[12px] font-medium tracking-normal whitespace-nowrap">
                        {item.name}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom Profile Badge & Controls */}
        <div className="p-3 border-t border-gray-200 dark:border-white/[0.05] bg-gray-50/50 dark:bg-black/20 shrink-0 space-y-1">

          {userRole === "admin" && (
            <Link 
              href="/dashboard/settings"
              onClick={() => setIsMobileOpen(false)}
              title={isCollapsed && !isMobileOpen ? "Settings" : ""}
              className="flex items-center w-full px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-100 dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              <SettingsIcon className={`h-4 w-4 flex-shrink-0 ${(!isCollapsed || isMobileOpen) ? "mr-3" : ""}`} />
              {(!isCollapsed || isMobileOpen) && <span>{language === "EN" ? "Settings" : "সেটিংস"}</span>}
            </Link>
          )}
      
          <button 
            onClick={handleLogout} 
            title={isCollapsed && !isMobileOpen ? "Sign Out" : ""}
            className="flex items-center w-full px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400/80 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors group"
          >
            <LogOut className={`h-4 w-4 flex-shrink-0 ${(!isCollapsed || isMobileOpen) ? "mr-3" : ""} group-hover:scale-110 transition-transform`}
             />
            {(!isCollapsed || isMobileOpen) && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative print:overflow-visible print:h-auto">
        {/* Offline Banner for Network Resilience & Auto-Sync */}
        <OfflineBanner />

        {/* Post-Expiry Notice Banner */}
        {subStatus && (!subStatus.is_active || subStatus.days_remaining <= 0) && userRole === "admin" && (
          <div className="bg-red-600 text-white px-4 py-2.5 text-xs font-bold flex flex-wrap items-center justify-between gap-2 z-30 shadow-md print:hidden">
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} className="shrink-0" />
              <span>
                {language === "EN"
                  ? "Your 30-Day Free Trial / Subscription has expired. Please submit payment proof to activate an operational license."
                  : "আপনার ৩০ দিনের ফ্রি ট্রায়াল / সাবস্ক্রিপশনের মেয়াদ শেষ হয়েছে। প্ল্যাটফর্ম পুনরায় সক্রিয় করতে পেমেন্ট জমা দিন।"}
              </span>
            </div>
            <Link
              href="/dashboard/settings?tab=billing"
              className="px-3 py-1 bg-white text-red-600 rounded-lg text-xs font-extrabold hover:bg-red-50 transition-colors shadow-sm"
            >
              {language === "EN" ? "Upgrade License" : "লাইসেন্স আপগ্রেড করুন"}
            </Link>
          </div>
        )}

        <header className="h-16 flex items-center justify-between px-4 sm:px-6 bg-white/80 dark:bg-[#0f0f11]/80 backdrop-blur-md border-b border-gray-200 dark:border-white/[0.05] shrink-0 print:hidden">
          
          {/* Left: Mobile drawer button, Desktop collapse toggle, Greeting & Workspace Switcher */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setIsMobileOpen(true)}
              className="md:hidden p-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Open mobile navigation drawer"
            >
              <Menu size={20} />
            </button>

            {/* Desktop Collapse Toggle Button */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden md:flex p-2.5 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors min-w-[40px] min-h-[40px] items-center justify-center"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
            </button>

            <div className="hidden lg:block text-xs font-medium text-gray-500 dark:text-gray-400 mr-2">
              Welcome back, <strong className="text-gray-900 dark:text-white">{userName}</strong> <span className="capitalize font-mono text-[10px]">({userRole})</span>
            </div>

            {/* 🚀 Workspace Switcher Button */}
            <WorkspaceSwitcher />

            {/* 30-Day Free Trial / License Countdown Badge for Admin */}
            {subStatus && userRole === "admin" && (
              <Link
                href="/dashboard/settings?tab=billing"
                className={`hidden xl:flex items-center gap-2 px-2 py-1 rounded-xl text-xs font-semibold border transition-all ${
                  subStatus.days_remaining <= 5 || subStatus.subscription_status === "EXPIRED"
                    ? "bg-red-50 dark:bg-red-500/10 border-red-300 dark:border-red-500/30 text-red-700 dark:text-red-400 animate-pulse"
                    : "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20"
                }`}
                title="Institutional SaaS Subscription Status"
              >
                <Sparkles size={13} className={subStatus.days_remaining <= 5 ? "text-red-500" : "text-amber-500"} />
                <span>
                  {subStatus.is_trial || subStatus.plan_key === "free_trial"
                    ? `${language === "EN" ? "30-Day Free Trial" : "৩০ দিনের ফ্রি ট্রায়াল"} • ${subStatus.days_remaining} ${language === "EN" ? "days left" : "দিন বাকি"}`
                    : `${subStatus.plan_name} • ${subStatus.days_remaining}d`}
                </span>
                <span className="text-[10px] uppercase font-xs bg-amber-200 dark:bg-amber-400/20 px-1.5 py-0.5 rounded text-amber-900 dark:text-amber-200">
                  {subStatus.subscription_status === "EXPIRED" ? (language === "EN" ? "Expired" : "মেয়াদোত্তীর্ণ") : (language === "EN" ? "Upgrade" : "আপগ্রেড")}
                </span>
              </Link>
            )}
          </div>

          {/* Right: Voice-to-Diary Trigger, Theme Switcher, Language Toggle, User Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* 🎙️ Voice-to-Diary Action Button (Strictly Teacher-Only) */}
            {userRole === "teacher" && (
              <button
                onClick={() => setIsVoiceModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 text-purple-700 dark:text-purple-300 text-xs font-semibold flex items-center gap-1.5 hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-all shadow-sm"
                title="Open Teacher Voice-to-Diary Copilot"
              >
                <Mic size={14} className="text-purple-600 dark:text-purple-400" />
                <span className="hidden sm:inline">Voice Diary AI</span>
              </button>
            )}

            {/* Global Theme Toggle (Light / Dark / System) */}
            <ThemeToggle />

            {/* Language Toggle */}
            <button onClick={toggleLanguage} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors bg-white dark:bg-black/40 text-gray-700 dark:text-gray-400 shadow-sm">
              <Globe size={14} className="text-blue-500 dark:text-purple-400" />
              <span>{language === "EN" ? "বাংলা" : "English"}</span>
            </button>

            {/* User Profile Badge (Clickable Link to /dashboard/profile) */}
            <Link
              href="/dashboard/profile"
              className="hidden md:flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-white/10 text-xs hover:opacity-80 transition-opacity"
              title="View Profile & Account Settings"
            >
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px] shadow-sm">
                {userName.substring(0, 2).toUpperCase()}
              </div>
              <div className="leading-tight text-left">
                <div className="font-bold text-[11px] text-gray-900 dark:text-white truncate max-w-[100px]">{userName}</div>
                <div className="text-[9px] text-gray-400 uppercase font-mono">{userRole}</div>
              </div>
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar print:p-0 print:m-0 print:overflow-visible">
          {children}
        </main>
      </div>

      {/* Settings Modal (Only for Admin) */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* 🚀 Mounted Voice-to-Diary Modal */}
      <VoiceLessonModal 
        isOpen={isVoiceModalOpen} 
        onClose={() => setIsVoiceModalOpen(false)} 
      />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <RagJobProvider>
        <RoleRouteGuard>
          <DashboardLayoutContent>{children}</DashboardLayoutContent>
        </RoleRouteGuard>
      </RagJobProvider>
    </WorkspaceProvider>
  );
}