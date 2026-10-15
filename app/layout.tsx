import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { DEFAULT_LOCALE, isRTL, isValidLocale, LOCALE_COOKIE } from "@/lib/i18n";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "TalentBridge — Jobs & Hiring in Pakistan",
    template: "%s · TalentBridge",
  },
  description:
    "TalentBridge is a job recruitment and applicant tracking platform for Pakistan.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Phase 3 (Urdu/RTL): read locale from cookie, set dir accordingly.
  // Defaults to English (ltr); Urdu sets dir="rtl" when translations land.
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isValidLocale(raw) ? raw : DEFAULT_LOCALE;
  const dir = isRTL(locale) ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} className={inter.variable}>
      <body className="min-h-screen bg-white font-sans text-slate-900 antialiased tabular-nums">
        {children}
      </body>
    </html>
  );
}
