"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Settings, Users, GraduationCap, Sparkles, Search, BookOpen, UserPlus, Loader2, Bot
} from "lucide-react";

import {
  Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";

export function CommandMenu() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [response, setResponse] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();

  // Ctrl+K Shortcut
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Reset state when closed
  React.useEffect(() => {
    if (!open) {
      setTimeout(() => { setQuery(""); setResponse(""); setLoading(false); }, 300);
    }
  }, [open]);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setResponse("");

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/api/v1/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query: searchQuery }),
      });

      if (res.ok) {
        const data = await res.json();
        setResponse(data.response);
      } else {
        setResponse("Error connecting to SchoolOS Digital Brain.");
      }
    } catch (error) {
      setResponse("System offline. Check API connections.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Sidebar Search Trigger Button (Matches the Dark Theme Sidebar) */}
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-500 hover:bg-gray-200 dark:hover:bg-white/5 transition-colors shadow-sm"
      >
        <div className="flex items-center gap-2">
          <Search size={16} />
          <span>Ask SchoolOS...</span>
        </div>
        <kbd className="hidden sm:inline-flex px-1.5 py-0.5 rounded-md bg-white dark:bg-white/10 text-[10px] font-mono font-bold text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-white/10">
          ⌘K
        </kbd>
      </button>

      {/* The Command Palette Modal */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command className="bg-white dark:bg-[#0f0f11] border dark:border-white/10 rounded-xl overflow-hidden">
          
          {/* Input Area */}
          <div className="flex items-center border-b border-gray-100 dark:border-white/10 px-3">
            <Sparkles className="mr-2 h-4 w-4 shrink-0 text-purple-500 opacity-50 animate-pulse" />
            <CommandInput 
              placeholder="Type a command or ask AI... (Press Enter)" 
              value={query}
              onValueChange={setQuery}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && query.trim()) {
                  handleSearch(query);
                }
              }}
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-gray-500 dark:text-white"
            />
          </div>

          <CommandList className="max-h-[60vh] overflow-y-auto custom-scrollbar">
            
            {/* 1. Loading State */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Loader2 className="animate-spin mb-4 text-purple-500" size={32} />
                <p className="text-sm">Processing with Gemini 2.5 Flash...</p>
              </div>
            )}

            {/* 2. Response State */}
            {!loading && response && (
              <div className="p-6 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                <div className="flex items-center gap-2 mb-4 text-purple-600 dark:text-purple-400 font-semibold uppercase tracking-wide text-xs">
                  <Bot size={16} /> SchoolOS Digital Brain
                </div>
                <div className="whitespace-pre-wrap">{response}</div>
              </div>
            )}

            {/* 3. Default Menus (Visible only when not loading/responding) */}
            {!loading && !response && (
              <>
                <CommandEmpty>No results found. Press Enter to ask AI.</CommandEmpty>
                
                <CommandGroup heading="✨ AI Assistant Prompts">
                  <CommandItem 
                    className="cursor-pointer text-purple-700 dark:text-purple-400 data-[selected='true']:bg-purple-50 dark:data-[selected='true']:bg-purple-500/10 data-[selected='true']:text-purple-800 dark:data-[selected='true']:text-purple-300" 
                    onSelect={() => { setQuery("Generate class routine"); handleSearch("Generate class routine"); }}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    <span>Generate class routine (AI)</span>
                  </CommandItem>
                  <CommandItem 
                    className="cursor-pointer text-purple-700 dark:text-purple-400 data-[selected='true']:bg-purple-50 dark:data-[selected='true']:bg-purple-500/10 data-[selected='true']:text-purple-800 dark:data-[selected='true']:text-purple-300" 
                    onSelect={() => { setQuery("Draft parent notifications"); handleSearch("Draft parent notifications"); }}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    <span>Draft parent notifications</span>
                  </CommandItem>
                </CommandGroup>
                
                <CommandSeparator className="bg-gray-100 dark:bg-white/10" />
                
                <CommandGroup heading="Quick Actions">
                  <CommandItem className="cursor-pointer dark:text-gray-300 dark:data-[selected='true']:bg-white/5" onSelect={() => runCommand(() => router.push("/dashboard/students"))}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    <span>Admit New Student</span>
                  </CommandItem>
                </CommandGroup>

                <CommandSeparator className="bg-gray-100 dark:bg-white/10" />

                <CommandGroup heading="Navigation">
                  <CommandItem className="cursor-pointer dark:text-gray-300 dark:data-[selected='true']:bg-white/5" onSelect={() => runCommand(() => router.push("/dashboard/students"))}>
                    <Users className="mr-2 h-4 w-4" />
                    <span>Students Database</span>
                  </CommandItem>
                  <CommandItem className="cursor-pointer dark:text-gray-300 dark:data-[selected='true']:bg-white/5" onSelect={() => runCommand(() => router.push("/dashboard/teachers"))}>
                    <GraduationCap className="mr-2 h-4 w-4" />
                    <span>Teachers Staff</span>
                  </CommandItem>
                  <CommandItem className="cursor-pointer dark:text-gray-300 dark:data-[selected='true']:bg-white/5" onSelect={() => runCommand(() => router.push("/dashboard/academic"))}>
                    <BookOpen className="mr-2 h-4 w-4" />
                    <span>Academic Settings</span>
                  </CommandItem>
                  <CommandItem className="cursor-pointer dark:text-gray-300 dark:data-[selected='true']:bg-white/5" onSelect={() => runCommand(() => router.push("/dashboard/settings"))}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>System Settings</span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}