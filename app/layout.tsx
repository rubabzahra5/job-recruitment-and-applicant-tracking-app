import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "HirePakistan — Jobs & Hiring in Pakistan",
    template: "%s · HirePakistan",
  },
  description:
    "HirePakistan is a job recruitment and applicant tracking platform for Pakistan.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
