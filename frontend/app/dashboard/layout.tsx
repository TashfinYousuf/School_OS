"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLanguage } from "@/components/providers";
import { CommandMenu } from "@/components/CommandMenu";
import SettingsModal from "@/components/SettingsModal";

import { 
  LayoutDashboard, Users, GraduationCap, BookOpen, 
  Settings as SettingsIcon, LogOut, Fingerprint, Trophy, School, 
  Menu, ChevronLeft, Globe, ShieldCheck, MessageSquare, Building2, Phone, Wallet,
} from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { language, toggleLanguage } = useLanguage();
  
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [userRole, setUserRole] = useState<string>("admin");
  const [userName, setUserName] = useState<string>("User");

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    // Read active RBAC role from storage
    const role = localStorage.getItem("user_role") || "admin";
    const name = localStorage.getItem("user_name") || "Admin";
    setUserRole(role.toLowerCase());
    setUserName(name);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_name");
    router.push("/login");
  };

  // Base All Navigation Groups
  const allNavigationGroups = [
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
        { name: language === "EN" ? "Educators" : "শিক্ষকবৃন্দ", href: "/dashboard/teachers", icon: GraduationCap },
        { name: language === "EN" ? "Curriculum" : "পাঠ্যক্রম", href: "/dashboard/academic", icon: BookOpen },
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

  // 🚀 RBAC Role Filtered Navigation Engine
  const getFilteredNavigation = () => {
    if (userRole === "teacher") {
      return [
        {
          title: language === "EN" ? "Academic Operations" : "একাডেমিক কার্যক্রম",
          items: [
            { name: language === "EN" ? "Overview" : "ওভারভিউ", href: "/dashboard", icon: LayoutDashboard },
            { name: language === "EN" ? "Daily Attendance" : "ডিজিটাল হাজিরা", href: "/dashboard/attendance", icon: Fingerprint },
            { name: language === "EN" ? "Results & Grading" : "ফলাফল ও মূল্যায়ন", href: "/dashboard/results", icon: Trophy },
            { name: language === "EN" ? "Question Papers" : "প্রশ্নপত্র প্রণয়ন", href: "/dashboard/exams", icon: BookOpen },
            { name: language === "EN" ? "Notice Board" : "বিজ্ঞপ্তি", href: "/dashboard/notices", icon: School },
            { name: language === "EN" ? "Guardian Directory" : "অভিভাবক যোগাযোগ", href: "/dashboard/guardians", icon: Phone },
          ]
        }
      ];
    }

    if (userRole === "guardian") {
      return [
        {
          title: language === "EN" ? "Parent Portal" : "অভিভাবক পোর্টাল",
          items: [
            { name: language === "EN" ? "Progress Card" : "সন্তানের ফলাফল", href: "/dashboard/results", icon: Trophy },
            { name: language === "EN" ? "Attendance Record" : "উপস্থিতি রেকর্ড", href: "/dashboard/attendance", icon: Fingerprint },
            { name: language === "EN" ? "School Notices" : "স্কুল নোটিশ", href: "/dashboard/notices", icon: School },
            { name: language === "EN" ? "Direct Help Desk" : "যোগাযোগ / ইনবক্স", href: "/dashboard/communication", icon: MessageSquare },
          ]
        }
      ];
    }

    // Admin / Principal gets everything
    return allNavigationGroups;
  };

  if (!mounted) return null;

  return (
    <div className="flex h-screen bg-[#f8f9fa] dark:bg-[#050505] text-gray-900 dark:text-gray-100 transition-colors duration-300 font-sans print:h-auto print:bg-white print:text-black">
      
      {/* Background Ambient (Hidden on Print) */}
      <div className="hidden dark:block fixed top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-600/10 blur-[150px] rounded-full pointer-events-none print:hidden" />
      <div className="hidden dark:block fixed bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-600/10 blur-[150px] rounded-full pointer-events-none print:hidden" />

      {/* Sidebar (Hidden on Print) */}
      <aside className={`${isCollapsed ? "w-20" : "w-64"} flex-shrink-0 transition-all duration-300 ease-in-out bg-white dark:bg-[#0f0f11] border-r border-gray-200 dark:border-white/[0.05] flex flex-col relative z-20 shadow-sm print:hidden`}>
        
        {/* Clickable Header Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-white/[0.05] shrink-0">
          <Link href="/dashboard" className="flex items-center gap-3 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity">
            <div className="p-2 bg-blue-50 dark:bg-white/5 rounded-xl border border-blue-100 dark:border-white/10 shadow-sm">
              <School className="text-blue-600 dark:text-purple-400 w-5 h-5 flex-shrink-0" />
            </div>
            {!isCollapsed && (
              <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white whitespace-nowrap">SchoolOS</h1>
            )}
          </Link>
        </div>

        {/* Command Menu Trigger */}
        {!isCollapsed && (
          <div className="px-4 pt-5 pb-2 shrink-0">
            <CommandMenu />
          </div>
        )}

        {/* 🚀 Grouped Navigation Links (Filtered by Role) */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto custom-scrollbar space-y-6">
          {getFilteredNavigation().map((group, idx) => (
            <div key={idx} className="space-y-1">
              {!isCollapsed && (
                <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {group.title}
                </div>
              )}
              {group.items.map((item) => {
                const isActive = pathname === item.href || (pathname.startsWith(`${item.href}/`) && item.href !== "/dashboard");
                const Icon = item.icon;
                return (
                  <Link key={item.name} href={item.href} title={isCollapsed ? item.name : ""}
                    className={`flex items-center px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                      isActive
                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 dark:bg-white/10 dark:text-white dark:border dark:border-white/10 dark:shadow-none"
                        : "text-white-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-gray-100"
                    }`}
                  >
                    <Icon className={`h-[18px] w-[18px] flex-shrink-0 ${isActive ? "text-white" : "text-white-400 group-hover:text-gray-600 dark:group-hover:text-gray-300"} ${!isCollapsed && "mr-3"}`} />
                    {!isCollapsed && <span className="text-sm font-medium whitespace-nowrap">{item.name}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom Actions */}
        <div className="p-3 border-t border-gray-200 dark:border-white/[0.05] bg-gray-50/50 dark:bg-black/20 shrink-0 space-y-2">
          <Link href="/dashboard/settings" title={isCollapsed ? "Settings" : ""}
            className={`flex items-center px-3 py-2 rounded-xl transition-all duration-200 group ${
              pathname === "/dashboard/settings"
                ? "bg-gray-200 text-gray-900 dark:bg-white/10 dark:text-white"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-gray-100"
            }`}
          >
            <SettingsIcon className={`h-[18px] w-[18px] flex-shrink-0 ${pathname === "/dashboard/settings" ? "text-gray-900 dark:text-white" : "text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300"} ${!isCollapsed && "mr-3"}`} />
            {!isCollapsed && <span className="text-sm font-medium whitespace-nowrap">{language === "EN" ? "Settings" : "সেটিংস"}</span>}
          </Link>
          
          <button onClick={handleLogout} title={isCollapsed ? "Sign Out" : ""}
            className="flex items-center w-full px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400/80 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-400 transition-colors group"
          >
            <LogOut className={`h-[18px] w-[18px] flex-shrink-0 ${!isCollapsed && "mr-3"} group-hover:scale-110 transition-transform`} />
            {!isCollapsed && <span className="whitespace-nowrap">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10 print:overflow-visible print:h-auto">
        
        {/* Top Header (Hidden on Print) */}
        <header className="h-16 flex items-center justify-between px-6 bg-white/80 dark:bg-[#0f0f11]/80 backdrop-blur-md border-b border-gray-200 dark:border-white/[0.05] z-10 shrink-0 print:hidden">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors border border-transparent dark:border-white/5">
              {isCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
            </button>
            <div className="hidden sm:block text-sm font-medium text-gray-500 dark:text-gray-400">
              {language === "EN" ? `Welcome back, ${userName} (${userRole})` : `স্বাগতম, ${userName} (${userRole})`}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={toggleLanguage} className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-gray-200 dark:border-white/10 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors bg-white dark:bg-black/40 text-gray-700 dark:text-gray-300 shadow-sm">
              <Globe size={14} className="text-blue-500 dark:text-purple-400" />
              {language === "EN" ? "বাংলা" : "English"}
            </button>
          </div>
        </header>

        {/* Scrollable Page Content (Clean View on Print) */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar print:p-0 print:m-0 print:overflow-visible">
          {children}
          <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        </main>
      </div>
    </div>
  );
}