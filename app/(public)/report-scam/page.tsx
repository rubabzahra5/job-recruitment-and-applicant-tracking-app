import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ScamReportForm } from "../_components/ScamReportForm";

export const metadata: Metadata = {
  title: "Report a Scam Job",
  description:
    "Report a suspected scam job on TalentBridge — money-asking, fake vacancies, impersonation or phishing. No account needed.",
};

const RED_FLAGS = [
  "Any request for money — fees, deposits or “training charges”",
  "Bank details, card PINs or OTP codes requested before an offer",
  "Pressure to move to a personal WhatsApp or Telegram account",
  "Pay that sounds too good for vague work",
];

export default function ReportScamPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="text-center">
        <Badge tone="warning">Trust &amp; safety</Badge>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900">
          Report a scam job
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-slate-600">
          TalentBridge is free for candidates — always. A real employer here
          will <strong>never</strong> ask you for money, a deposit, or your
          bank or OTP details. If one did, tell us and we will act. Read the
          full{" "}
          <Link href="/scam-policy" className="font-semibold text-brand-700 hover:underline">
            scam policy
          </Link>{" "}
          for the rules and consequences.
        </p>
      </div>

      <Card className="mt-8 p-6">
        <ScamReportForm />
      </Card>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <p className="font-semibold text-slate-900">Red flags</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
            {RED_FLAGS.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <p className="font-semibold text-slate-900">What happens next</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
            <li>We aim to acknowledge your report within 2 business days.</li>
            <li>Initial review within 5 business days; urgent cases first.</li>
            <li>Scam jobs are removed; organisations can be warned, suspended or terminated.</li>
            <li>Already sent money? Contact your bank or payment provider immediately, keep the messages, and still report here.</li>
          </ul>
        </Card>
      </div>
    </main>
  );
}
