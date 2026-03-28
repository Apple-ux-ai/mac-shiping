import { create } from 'zustand';

const STORAGE_KEY = 'app-language';

const normalizeLanguage = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    return 'zh_CN';
  }
  return value.trim();
};

export const useLanguageStore = create((set) => ({
  language: normalizeLanguage(localStorage.getItem(STORAGE_KEY) || 'zh_CN'),
  setLanguage: (nextLanguage) => {
    const language = normalizeLanguage(nextLanguage);
    localStorage.setItem(STORAGE_KEY, language);
    set({ language });
  },
  toggleLanguage: () => {
    set((state) => {
      const language = state.language === 'zh_CN' ? 'en' : 'zh_CN';
      localStorage.setItem(STORAGE_KEY, language);
      return { language };
    });
  },
}));
