/**
 * 语言管理 Store
 * 管理当前语言状态和切换
 */

import type { Language, Translations } from '../i18n/translations';
import { translations } from '../i18n/translations';

type Listener = () => void;

class LanguageStore {
  private currentLanguage: Language = 'zh'; // 默认中文
  private readonly listeners = new Set<Listener>();

  constructor() {
    // 从 localStorage 读取用户偏好
    const saved = localStorage.getItem('language');
    if (saved === 'zh' || saved === 'en') {
      this.currentLanguage = saved;
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }

  getLanguage(): Language {
    return this.currentLanguage;
  }

  setLanguage(lang: Language): void {
    if (this.currentLanguage !== lang) {
      this.currentLanguage = lang;
      localStorage.setItem('language', lang);
      this.emit();
    }
  }

  toggleLanguage(): void {
    this.setLanguage(this.currentLanguage === 'zh' ? 'en' : 'zh');
  }

  t(): Translations {
    return translations[this.currentLanguage];
  }
}

export const languageStore = new LanguageStore();

// 全局访问
(globalThis as any).languageStore = languageStore;
