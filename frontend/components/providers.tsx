"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { createContext, useContext, useState, useEffect } from "react";
import { InstitutionProvider } from "@/lib/institution";
import { Language, resolveTranslation } from "@/lib/i18n";

export type { Language };

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("EN");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("educationos_locale") as Language | null;
      if (stored === "EN" || stored === "BN") {
        setLanguageState(stored);
      }
    } catch {
      // Ignore during SSR
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem("educationos_locale", lang);
    } catch {
      // Ignore in private storage
    }
  };

  const toggleLanguage = () => {
    const nextLang = language === "EN" ? "BN" : "EN";
    setLanguage(nextLang);
  };

  const t = (key: string): string => {
    return resolveTranslation(key, language);
  };

  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      <LanguageContext.Provider value={{ language, toggleLanguage, setLanguage, t }}>
        <InstitutionProvider>
          {children}
        </InstitutionProvider>
      </LanguageContext.Provider>
    </NextThemesProvider>
  );
}
