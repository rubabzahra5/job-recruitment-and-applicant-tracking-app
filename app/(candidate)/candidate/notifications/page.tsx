import type { Metadata } from "next";
import { requireCandidate } from "@/app/(candidate)/_lib/candidate-guard";
import { isEmailConfigured } from "@/lib/env";
import { NotificationCenter } from "./_components/NotificationCenter";
import { listNotifications, getPreferences } from "./_actions";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  await requireCandidate();
  const [items, prefs] = await Promise.all([listNotifications(), getPreferences()]);
  // Honest channel status: never claim email works when it isn't configured.
  let emailConfigured = false;
  try {
    emailConfigured = isEmailConfigured();
  } catch {
    emailConfigured = false;
  }

  return (
    <main>
      <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
      <p className="mt-1 text-sm text-slate-600">
        Application updates, interview invites and job alerts.
      </p>
      <div className="mt-6">
        <NotificationCenter items={items} prefs={prefs} emailConfigured={emailConfigured} />
      </div>
    </main>
  );
}
