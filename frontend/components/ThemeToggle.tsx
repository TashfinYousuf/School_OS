"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Laptop } from "lucide-react";
import { useLanguage } from "@/components/providers";

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { language } = useLanguage();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className="w-9 h-8 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black/40"
        aria-hidden="true"
      />
    );
  }

  const cycleTheme = () => {
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  };

  const getLabel = () => {
    if (theme === "light") {
      return language === "EN" ? "Light" : "লাইট";
    }
    if (theme === "dark") {
      return language === "EN" ? "Dark" : "ডার্ক";
    }
    return language === "EN" ? "System" : "সিস্টেম";
  };

  const renderIcon = () => {
    if (theme === "system") {
      return <Laptop size={14} className="text-blue-500 dark:text-purple-400" />;
    }
    if (resolvedTheme === "dark") {
      return <Moon size={14} className="text-purple-400" />;
    }
    return <Sun size={14} className="text-amber-500" />;
  };

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={`Toggle Theme (Current: ${theme})`}
      title={`Theme: ${getLabel()} (Click to toggle)`}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors bg-white dark:bg-black/40 text-gray-700 dark:text-gray-400 shadow-sm"
    >
      {renderIcon()}
      <span className="hidden md:inline text-[11px] font-medium">{getLabel()}</span>
    </button>
  );
}

