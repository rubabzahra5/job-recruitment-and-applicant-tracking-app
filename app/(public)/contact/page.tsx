import type { Metadata } from "next";

import { Card } from "@/components/ui/Card";
import { ContactForm } from "../_components/ContactForm";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with the Job Recruitment And Applicant Tracking System team.",
};

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Contact us</h1>
      <p className="mt-2 text-slate-600">
        Questions about a vacancy, your account, or partnering with us? Send a
        message — we read and reply to every enquiry.
      </p>

      <Card className="mt-8 p-6">
        <ContactForm />
      </Card>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <p className="font-semibold text-slate-900">Job seekers</p>
          <p className="mt-1 text-sm text-slate-600">
            For help with applications, your profile, or job alerts, include
            the email address on your account so we can find you quickly.
          </p>
        </Card>
        <Card className="p-5">
          <p className="font-semibold text-slate-900">Employers</p>
          <p className="mt-1 text-sm text-slate-600">
            Want to post jobs at scale or verify your organization? Mention
            your company name and we&apos;ll route you to the right team.
          </p>
        </Card>
      </div>
    </main>
  );
}
