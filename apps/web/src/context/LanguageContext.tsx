import React, { createContext, useContext, useState, useCallback } from 'react';
import { translations, languageNames } from '../i18n/translations';

export type Language = keyof typeof translations;

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  languages: Language[];
  languageNames: Record<string, string>;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  const t = useCallback(
    (key: string): string => {
      return translations[language]?.[key] ?? translations.en?.[key] ?? key;
    },
    [language],
  );

  const changeLanguage = (lang: Language) => {
    if (translations[lang]) {
      setLanguageState(lang);
    }
  };

  const value: LanguageContextValue = {
    language,
    setLanguage: changeLanguage,
    t,
    languages: Object.keys(translations) as Language[],
    languageNames,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
