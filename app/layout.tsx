import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Job Recruitment And Applicant Tracking System — Jobs & Hiring in Pakistan",
    template: "%s · Job Recruitment And Applicant Tracking System",
  },
  description:
    "Job Recruitment And Applicant Tracking System is a job recruitment and applicant tracking platform for Pakistan.",
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
