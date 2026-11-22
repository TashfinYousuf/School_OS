"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Settings, Users, GraduationCap, Sparkles, Search, BookOpen, 
  UserPlus, Loader2, Bot, Wallet, Fingerprint, Trophy, School, ArrowRight
} from "lucide-react";

import {
  Command, CommandDialog, CommandEmpty, CommandGroup, 
  CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { fetchWithTenant } from "@/lib/api-client";

export function CommandMenu() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [response, setResponse] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [userRole, setUserRole] = React.useState<string>("student");
  const router = useRouter();

  // Ctrl+K / Cmd+K Shortcut
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  // Update role and reset state on dialog open/close
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const role = (localStorage.getItem("user_role") || "student").toLowerCase();
      setUserRole(role);
    }
    if (!open) {
      setTimeout(() => { 
        setQuery(""); 
        setResponse(""); 
        setLoading(false); 
      }, 250);
    }
  }, [open]);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  const handleExecuteAI = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setResponse("");

    try {
      const res = await fetchWithTenant("/api/v1/ai/grounded-query", {
        method: "POST",
        body: JSON.stringify({ query: searchQuery }),
      });

      if (res.ok) {
        const data = await res.json();
        setResponse(data.answer || data.response);
      } else {
        setResponse("Error communicating with EducationOS Copilot.");
      }
    } catch (error) {
      setResponse("System offline. Please verify backend connectivity.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Sidebar Trigger Button */}
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-500 hover:bg-gray-200 dark:hover:bg-white/5 transition-colors shadow-sm"
      >
        <div className="flex items-center gap-2">
          <Search size={14} />
          <span>Ask EducationOS Copilot...</span>
        </div>
        <kbd className="hidden sm:inline-flex px-1.5 py-0.5 rounded-md bg-white dark:bg-white/10 text-[10px] font-mono font-bold text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-white/10">
          ⌘K
        </kbd>
      </button>

      {/* Command Palette Modal */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command className="bg-white dark:bg-[#0f0f11] border dark:border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          
          {/* Input Bar */}
          <div className="flex items-center border-b border-gray-100 dark:border-white/10 px-3">
            <Sparkles className="mr-2 h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400 animate-pulse" />
            <CommandInput 
              placeholder="Ask anything or search" 
              value={query}
              onValueChange={setQuery}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && query.trim()) {
                  e.preventDefault();
                  handleExecuteAI(query);
                }
              }}
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-xs outline-none placeholder:text-gray-400 dark:text-white"
            />
            {query.trim() && !loading && (
              <button
                onClick={() => handleExecuteAI(query)}
                className="p-1.5 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 hover:opacity-80"
                title="Execute Query"
              >
                <ArrowRight size={14} />
              </button>
            )}
          </div>

          <CommandList className="max-h-[60vh] overflow-y-auto custom-scrollbar p-2">
            
            {/* 1. Loading State */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <Loader2 className="animate-spin mb-3 text-purple-600 dark:text-purple-400" size={28} />
                <p className="text-xs font-medium">Grounding with live campus database...</p>
              </div>
            )}

            {/* 2. Response State */}
            {!loading && response && (
              <div className="p-4 bg-purple-50/40 dark:bg-purple-500/5 rounded-2xl border border-purple-100 dark:border-purple-500/10 text-xs text-gray-800 dark:text-gray-200 leading-relaxed font-sans">
                <div className="flex items-center gap-1.5 mb-2.5 text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wider text-[10px]">
                  <Bot size={14} /> Live Campus Executive Briefing:
                </div>
                <div className="whitespace-pre-wrap">{response}</div>
              </div>
            )}

            {/* 3. Default Command Groups (Role-Scoped) */}
            {!loading && !response && (
              <>
                <CommandEmpty>No results. Press Enter to ask EducationOS Copilot.</CommandEmpty>
                
                {/* --- ADMIN EXPERIENCE --- */}
                {userRole === "admin" && (
                  <>
                    <CommandGroup heading="✨ Live AI Campus Queries">
                      <CommandItem 
                        className="cursor-pointer text-purple-700 dark:text-purple-400 data-[selected='true']:bg-purple-50 dark:data-[selected='true']:bg-purple-500/10 text-xs" 
                        onSelect={() => { 
                          setQuery("আজকের উপস্থিতির হার এবং অনুপস্থিত শিক্ষার্থীর সংখ্যা কত?"); 
                          handleExecuteAI("আজকের উপস্থিতির হার এবং অনুপস্থিত শিক্ষার্থীর সংখ্যা কত?"); 
                        }}
                      >
                        <Sparkles className="mr-2 h-3.5 w-3.5" />
                        <span>আজকের উপস্থিতির হার ও অনুপস্থিত শিক্ষার্থী</span>
                      </CommandItem>
                      <CommandItem 
                        className="cursor-pointer text-purple-700 dark:text-purple-400 data-[selected='true']:bg-purple-50 dark:data-[selected='true']:bg-purple-500/10 text-xs" 
                        onSelect={() => { 
                          setQuery("আজ সর্বমোট কত টাকা ফি আদায় হয়েছে?"); 
                          handleExecuteAI("আজ সর্বমোট কত টাকা ফি আদায় হয়েছে?"); 
                        }}
                      >
                        <Sparkles className="mr-2 h-3.5 w-3.5" />
                        <span>আজকের মোট ফি আদায় ও রাজস্ব সারাংশ</span>
                      </CommandItem>
                    </CommandGroup>
                    
                    <CommandSeparator className="bg-gray-100 dark:bg-white/10 my-1" />
                    
                    <CommandGroup heading="Quick Operations">
                      <CommandItem className="cursor-pointer text-xs dark:text-gray-400" onSelect={() => runCommand(() => router.push("/dashboard/students"))}>
                        <UserPlus className="mr-2 h-3.5 w-3.5 text-blue-500" />
                        <span>New Student Admission</span>
                      </CommandItem>
                      <CommandItem className="cursor-pointer text-xs dark:text-gray-400" onSelect={() => runCommand(() => router.push("/dashboard/finance"))}>
                        <Wallet className="mr-2 h-3.5 w-3.5 text-green-500" />
                        <span>Collect Student Tuition Fee</span>
                      </CommandItem>
                      <CommandItem className="cursor-pointer text-xs dark:text-gray-400" onSelect={() => runCommand(() => router.push("/dashboard/attendance"))}>
                        <Fingerprint className="mr-2 h-3.5 w-3.5 text-orange-500" />
                        <span>Take Daily Attendance</span>
                      </CommandItem>
                    </CommandGroup>

                    <CommandSeparator className="bg-gray-100 dark:bg-white/10 my-1" />

                    <CommandGroup heading="System Navigation">
                      <CommandItem className="cursor-pointer text-xs dark:text-gray-400" onSelect={() => runCommand(() => router.push("/dashboard/exams"))}>
                        <BookOpen className="mr-2 h-3.5 w-3.5" />
                        <span>Question Paper Generator</span>
                      </CommandItem>
                      <CommandItem className="cursor-pointer text-xs dark:text-gray-400" onSelect={() => runCommand(() => router.push("/dashboard/results"))}>
                        <Trophy className="mr-2 h-3.5 w-3.5" />
                        <span>Results & Grading Engine</span>
                      </CommandItem>
                      <CommandItem className="cursor-pointer text-xs dark:text-gray-400" onSelect={() => runCommand(() => router.push("/dashboard/notices"))}>
                        <School className="mr-2 h-3.5 w-3.5" />
                        <span>Notice Composer & Multi-Channel</span>
                      </CommandItem>
                      <CommandItem className="cursor-pointer text-xs dark:text-gray-400" onSelect={() => runCommand(() => router.push("/dashboard/teachers"))}>
                        <GraduationCap className="mr-2 h-3.5 w-3.5" />
                        <span>Faculty & Teachers</span>
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}

                {/* --- TEACHER EXPERIENCE --- */}
                {userRole === "teacher" && (
                  <>
                    <CommandGroup heading="✨ Live AI Classroom Queries">
                      <CommandItem 
                        className="cursor-pointer text-purple-700 dark:text-purple-400 data-[selected='true']:bg-purple-50 dark:data-[selected='true']:bg-purple-500/10 text-xs" 
                        onSelect={() => { 
                          setQuery("আমার ক্লাসের আজকের উপস্থিতি এবং অনুপস্থিতির তালিকা দেখাও"); 
                          handleExecuteAI("আমার ক্লাসের আজকের উপস্থিতি এবং অনুপস্থিতির তালিকা দেখাও"); 
                        }}
                      >
                        <Sparkles className="mr-2 h-3.5 w-3.5" />
                        <span>আমার শ্রেণির আজকের উপস্থিতি সারসংক্ষেপ</span>
                      </CommandItem>
                      <CommandItem 
                        className="cursor-pointer text-purple-700 dark:text-purple-400 data-[selected='true']:bg-purple-50 dark:data-[selected='true']:bg-purple-500/10 text-xs" 
                        onSelect={() => { 
                          setQuery("আজকে আমার কোন কোন ক্লাসে পাঠদান আছে?"); 
                          handleExecuteAI("আজকে আমার কোন কোন ক্লাসে পাঠদান আছে?"); 
                        }}
                      >
                        <Sparkles className="mr-2 h-3.5 w-3.5" />
                        <span>আজকের ক্লাসের সময়সূচি ও পাঠ পরিকল্পনা</span>
                      </CommandItem>
                    </CommandGroup>

                    <CommandSeparator className="bg-gray-100 dark:bg-white/10 my-1" />

                    <CommandGroup heading="Quick Operations">
                      <CommandItem className="cursor-pointer text-xs dark:text-gray-400" onSelect={() => runCommand(() => router.push("/dashboard/attendance"))}>
                        <Fingerprint className="mr-2 h-3.5 w-3.5 text-orange-500" />
                        <span>Take Class Attendance</span>
                      </CommandItem>
                      <CommandItem className="cursor-pointer text-xs dark:text-gray-400" onSelect={() => runCommand(() => router.push("/dashboard/exams"))}>
                        <BookOpen className="mr-2 h-3.5 w-3.5 text-blue-500" />
                        <span>Draft Exam Question Paper</span>
                      </CommandItem>
                      <CommandItem className="cursor-pointer text-xs dark:text-gray-400" onSelect={() => runCommand(() => router.push("/dashboard/results"))}>
                        <Trophy className="mr-2 h-3.5 w-3.5 text-green-500" />
                        <span>Enter Exam Marks & Grades</span>
                      </CommandItem>
                    </CommandGroup>

                    <CommandSeparator className="bg-gray-100 dark:bg-white/10 my-1" />

                    <CommandGroup heading="Teacher Navigation">
                      <CommandItem className="cursor-pointer text-xs dark:text-gray-400" onSelect={() => runCommand(() => router.push("/dashboard/academic"))}>
                        <BookOpen className="mr-2 h-3.5 w-3.5" />
                        <span>Timetable & Daily Routine</span>
                      </CommandItem>
                      <CommandItem className="cursor-pointer text-xs dark:text-gray-400" onSelect={() => runCommand(() => router.push("/dashboard/notices"))}>
                        <School className="mr-2 h-3.5 w-3.5" />
                        <span>Staff Bulletins & Circulars</span>
                      </CommandItem>
                      <CommandItem className="cursor-pointer text-xs dark:text-gray-400" onSelect={() => runCommand(() => router.push("/dashboard/guardians"))}>
                        <Users className="mr-2 h-3.5 w-3.5" />
                        <span>Guardian Phone Directory</span>
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}

                {/* --- STUDENT EXPERIENCE --- */}
                {userRole === "student" && (
                  <>
                    <CommandGroup heading="✨ AI Learning Queries">
                      <CommandItem 
                        className="cursor-pointer text-purple-700 dark:text-purple-400 data-[selected='true']:bg-purple-50 dark:data-[selected='true']:bg-purple-500/10 text-xs" 
                        onSelect={() => { 
                          setQuery("আমার পরবর্তী ক্লাস কখন এবং কোন বিষয়ে?"); 
                          handleExecuteAI("আমার পরবর্তী ক্লাস কখন এবং কোন বিষয়ে?"); 
                        }}
                      >
                        <Sparkles className="mr-2 h-3.5 w-3.5" />
                        <span>আমার পরবর্তী ক্লাস ও আজকের রুটিন</span>
                      </CommandItem>
                      <CommandItem 
                        className="cursor-pointer text-purple-700 dark:text-purple-400 data-[selected='true']:bg-purple-50 dark:data-[selected='true']:bg-purple-500/10 text-xs" 
                        onSelect={() => { 
                          setQuery("আজকের হোমওয়ার্ক এবং পাঠ্যক্রম কী?"); 
                          handleExecuteAI("আজকের হোমওয়ার্ক এবং পাঠ্যক্রম কী?"); 
                        }}
                      >
                        <Sparkles className="mr-2 h-3.5 w-3.5" />
                        <span>আজকের হোমওয়ার্ক ও পড়াশোনার প্রস্তুতি</span>
                      </CommandItem>
                    </CommandGroup>

                    <CommandSeparator className="bg-gray-100 dark:bg-white/10 my-1" />

                    <CommandGroup heading="Quick Learning Hub">
                      <CommandItem className="cursor-pointer text-xs dark:text-gray-400" onSelect={() => runCommand(() => router.push("/dashboard/learning"))}>
                        <Sparkles className="mr-2 h-3.5 w-3.5 text-purple-500" />
                        <span>AI Learning Studio & Flashcards</span>
                      </CommandItem>
                      <CommandItem className="cursor-pointer text-xs dark:text-gray-400" onSelect={() => runCommand(() => router.push("/dashboard/doubt-solver"))}>
                        <BookOpen className="mr-2 h-3.5 w-3.5 text-blue-500" />
                        <span>Socratic AI Doubt Solver</span>
                      </CommandItem>
                      <CommandItem className="cursor-pointer text-xs dark:text-gray-400" onSelect={() => runCommand(() => router.push("/dashboard/live-exams"))}>
                        <Trophy className="mr-2 h-3.5 w-3.5 text-amber-500" />
                        <span>Take Live Quiz / Practice Exam</span>
                      </CommandItem>
                    </CommandGroup>

                    <CommandSeparator className="bg-gray-100 dark:bg-white/10 my-1" />

                    <CommandGroup heading="Student Navigation">
                      <CommandItem className="cursor-pointer text-xs dark:text-gray-400" onSelect={() => runCommand(() => router.push("/dashboard/academic"))}>
                        <BookOpen className="mr-2 h-3.5 w-3.5" />
                        <span>My Class Timetable & Routine</span>
                      </CommandItem>
                      <CommandItem className="cursor-pointer text-xs dark:text-gray-400" onSelect={() => runCommand(() => router.push("/dashboard/attendance"))}>
                        <Fingerprint className="mr-2 h-3.5 w-3.5" />
                        <span>My Attendance Record</span>
                      </CommandItem>
                      <CommandItem className="cursor-pointer text-xs dark:text-gray-400" onSelect={() => runCommand(() => router.push("/dashboard/results"))}>
                        <Trophy className="mr-2 h-3.5 w-3.5" />
                        <span>My Marks & Progress Report</span>
                      </CommandItem>
                      <CommandItem className="cursor-pointer text-xs dark:text-gray-400" onSelect={() => runCommand(() => router.push("/dashboard/notices"))}>
                        <School className="mr-2 h-3.5 w-3.5" />
                        <span>School Circulars & Notices</span>
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}

                {/* --- GUARDIAN EXPERIENCE --- */}
                {userRole === "guardian" && (
                  <>
                    <CommandGroup heading="✨ Live Child Inquiries">
                      <CommandItem 
                        className="cursor-pointer text-purple-700 dark:text-purple-400 data-[selected='true']:bg-purple-50 dark:data-[selected='true']:bg-purple-500/10 text-xs" 
                        onSelect={() => { 
                          setQuery("আমার সন্তানের আজকের উপস্থিতি স্ট্যাটাস কী?"); 
                          handleExecuteAI("আমার সন্তানের আজকের উপস্থিতি স্ট্যাটাস কী?"); 
                        }}
                      >
                        <Sparkles className="mr-2 h-3.5 w-3.5" />
                        <span>সন্তানের আজকের বায়োমেট্রিক উপস্থিতি</span>
                      </CommandItem>
                      <CommandItem 
                        className="cursor-pointer text-purple-700 dark:text-purple-400 data-[selected='true']:bg-purple-50 dark:data-[selected='true']:bg-purple-500/10 text-xs" 
                        onSelect={() => { 
                          setQuery("চলতি মাসের স্কুলের মোট বকেয়া ফি কত?"); 
                          handleExecuteAI("চলতি মাসের স্কুলের মোট বকেয়া ফি কত?"); 
                        }}
                      >
                        <Sparkles className="mr-2 h-3.5 w-3.5" />
                        <span>চলতি মাসের বকেয়া ও টিউশন ফি রসিদ</span>
                      </CommandItem>
                    </CommandGroup>

                    <CommandSeparator className="bg-gray-100 dark:bg-white/10 my-1" />

                    <CommandGroup heading="Parent Quick Actions">
                      <CommandItem className="cursor-pointer text-xs dark:text-gray-400" onSelect={() => runCommand(() => router.push("/dashboard/attendance"))}>
                        <Fingerprint className="mr-2 h-3.5 w-3.5 text-blue-500" />
                        <span>Child Attendance History</span>
                      </CommandItem>
                      <CommandItem className="cursor-pointer text-xs dark:text-gray-400" onSelect={() => runCommand(() => router.push("/dashboard/results"))}>
                        <Trophy className="mr-2 h-3.5 w-3.5 text-green-500" />
                        <span>Terminal Progress Card & Grades</span>
                      </CommandItem>
                      <CommandItem className="cursor-pointer text-xs dark:text-gray-400" onSelect={() => runCommand(() => router.push("/dashboard/finance"))}>
                        <Wallet className="mr-2 h-3.5 w-3.5 text-amber-500" />
                        <span>Payment Receipts & Due List</span>
                      </CommandItem>
                    </CommandGroup>

                    <CommandSeparator className="bg-gray-100 dark:bg-white/10 my-1" />

                    <CommandGroup heading="Parent Navigation">
                      <CommandItem className="cursor-pointer text-xs dark:text-gray-400" onSelect={() => runCommand(() => router.push("/dashboard/academic"))}>
                        <BookOpen className="mr-2 h-3.5 w-3.5" />
                        <span>Child Weekly Class Routine</span>
                      </CommandItem>
                      <CommandItem className="cursor-pointer text-xs dark:text-gray-400" onSelect={() => runCommand(() => router.push("/dashboard/notices"))}>
                        <School className="mr-2 h-3.5 w-3.5" />
                        <span>School Circulars & Holiday Notices</span>
                      </CommandItem>
                      <CommandItem className="cursor-pointer text-xs dark:text-gray-400" onSelect={() => runCommand(() => router.push("/dashboard/communication"))}>
                        <Users className="mr-2 h-3.5 w-3.5" />
                        <span>Parent Help Desk & Inquiries</span>
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}