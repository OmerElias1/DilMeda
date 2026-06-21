import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, Lang, TKey } from '@/constants/i18n';

const STORAGE_KEY = '@dilmeda_language';

type LanguageContextType = {
  lang: Lang;
  setLang: (l: Lang) => Promise<void>;
  t: (key: TKey) => string;
};

const LanguageContext = createContext<LanguageContextType>({
  lang: 'en',
  setLang: async () => {},
  t: (key) => translations.en[key],
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  // Load saved language on startup
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'en' || saved === 'am') setLangState(saved);
    });
  }, []);

  const setLang = useCallback(async (l: Lang) => {
    setLangState(l);
    await AsyncStorage.setItem(STORAGE_KEY, l);
  }, []);

  const t = useCallback((key: TKey): string => {
    return translations[lang][key] ?? translations.en[key];
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
