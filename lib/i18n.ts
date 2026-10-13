/**
 * Internationalization foundation (Phase 1: Urdu/RTL).
 *
 * Currently supports English (default) with the infrastructure for Urdu.
 * Full Urdu translations are a roadmap item; this module provides:
 * - Locale definitions with RTL flags
 * - Cookie-based locale persistence
 * - Direction helpers for layout
 *
 * Usage:
 *   import { getLocale, isRTL } from "@/lib/i18n";
 *   const locale = await getLocale(); // 'en' | 'ur'
 *   const dir = isRTL(locale) ? 'rtl' : 'ltr';
 */

export const LOCALES = ["en", "ur"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  ur: "اردو (Urdu)",
};

export const RTL_LOCALES: Set<Locale> = new Set(["ur"]);

export function isRTL(locale: Locale): boolean {
  return RTL_LOCALES.has(locale);
}

export function isValidLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export const LOCALE_COOKIE = "tb-locale";
export const DEFAULT_LOCALE: Locale = "en";
