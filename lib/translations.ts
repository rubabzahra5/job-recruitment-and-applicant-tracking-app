import type { Locale } from "./i18n";

/**
 * Urdu translations for key public UI strings (Phase 3: Pakistan-first).
 * 
 * These are manual translations (no API). Covers the most visible
 * public-facing strings: navigation, homepage hero, job listings, buttons.
 * 
 * Note: This is a starting point. Full site translation is an ongoing task.
 * To use: import { t } from "@/lib/translations"; t(locale, "nav.jobs")
 */

const STRINGS: Record<string, { en: string; ur: string }> = {
  // Navigation
  "nav.jobs": { en: "Jobs", ur: "ملازمتیں" },
  "nav.companies": { en: "Companies", ur: "کمپنیاں" },
  "nav.whyFree": { en: "Why Free", ur: "مفت کیوں" },
  "nav.login": { en: "Log in", ur: "لاگ ان" },
  "nav.signup": { en: "Sign up", ur: "سائن اپ" },
  
  // Homepage hero
  "home.hero.title": { en: "Find your next job in Pakistan", ur: "پاکستان میں اپنی اگلی ملازمت تلاش کریں" },
  "home.hero.subtitle": { en: "Free for everyone. No fees, no commissions, no pay-to-apply.", ur: "سب کے لیے مفت۔ کوئی فیس نہیں، کوئی کمیشن نہیں، درخواست دینے کی کوئی قیمت نہیں۔" },
  "home.hero.searchPlaceholder": { en: "Job title, company, or keyword…", ur: "ملازمت کا عنوان، کمپنی، یا کلیدی لفظ…" },
  "home.hero.searchButton": { en: "Search jobs", ur: "ملازمتیں تلاش کریں" },
  
  // Job listings
  "jobs.browse": { en: "Browse jobs", ur: "ملازمتیں دیکھیں" },
  "jobs.apply": { en: "Apply now", ur: "ابھی درخواست دیں" },
  "jobs.salaryNotDisclosed": { en: "Salary not disclosed", ur: "تنخواہ ظاہر نہیں کی گئی" },
  "jobs.applyBy": { en: "Apply by", ur: "آخری تاریخ" },
  "jobs.respondsTo": { en: "Responds to", ur: "جواب دیتا ہے" },
  "jobs.ofApplications": { en: "of applications", ur: "درخواستوں کا" },
  "jobs.verified": { en: "Verified", ur: "تصدیق شدہ" },
  "jobs.remote": { en: "Remote", ur: "دور دراز" },
  
  // Common
  "common.loading": { en: "Loading…", ur: "لوڈ ہو رہا ہے…" },
  "common.save": { en: "Save", ur: "محفوظ کریں" },
  "common.cancel": { en: "Cancel", ur: "منسوخ کریں" },
  "common.search": { en: "Search", ur: "تلاش کریں" },
  "common.viewAll": { en: "View all", ur: "سب دیکھیں" },
};

export function t(locale: Locale, key: string): string {
  const entry = STRINGS[key];
  if (!entry) return key; // fallback to key if not translated
  return locale === "ur" ? entry.ur : entry.en;
}

export function getAvailableKeys(): string[] {
  return Object.keys(STRINGS);
}
