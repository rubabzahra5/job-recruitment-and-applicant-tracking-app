import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TalentBridge — Jobs & Hiring in Pakistan",
    template: "%s · TalentBridge",
  },
  description:
    "TalentBridge is a job recruitment and applicant tracking platform for Pakistan.",
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
