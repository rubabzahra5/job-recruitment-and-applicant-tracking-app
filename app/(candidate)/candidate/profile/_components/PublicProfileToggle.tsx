"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import { Alert } from "@/components/ui/Alert";
import { setProfilePublic } from "../_actions";

/**
 * Opt-in switch for the candidate's public profile page (/people/[id]).
 *
 * Default is OFF: the profile stays private until the candidate turns this
 * on. When `setupPending` is true (migration 0015 not applied yet) the
 * switch is disabled with an explanation instead of failing on click.
 */
export function PublicProfileToggle({
  userId,
  initialPublic,
  setupPending = false,
}: {
  userId: string;
  initialPublic: boolean;
  setupPending?: boolean;
}) {
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    const next = !isPublic;
    setError(null);
    startTransition(async () => {
      const res = await setProfilePublic(next);
      if (res.ok) {
        setIsPublic(next);
      } else {
        setError(res.error ?? "Could not update your public profile setting.");
      }
    });
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-600">
            When this is on, anyone can view your public profile page — your name,
            headline, summary, skills, experience and education, plus your feed
            posts. Your email, phone number and CV file are <strong>never</strong>{" "}
            shown publicly.
          </p>
          {setupPending ? (
            <p className="mt-2 text-sm text-amber-700">
              Public profiles are still being set up — the switch will work soon.
            </p>
          ) : isPublic ? (
            <p className="mt-2 text-sm">
              Your page is live:{" "}
              <Link href={`/people/${userId}`} className="font-medium text-brand-700 hover:underline">
                View my public page →
              </Link>
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              Your profile is currently private — only employers you apply to can see it.
            </p>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isPublic}
          aria-label="Public profile"
          onClick={toggle}
          disabled={isPending || setupPending}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
            isPublic ? "bg-brand-600" : "bg-slate-300"
          }`}
        >
          <span
            aria-hidden="true"
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
              isPublic ? "left-[1.375rem]" : "left-0.5"
            }`}
          />
        </button>
      </div>
      {error && (
        <Alert tone="error" className="mt-3">
          {error}
        </Alert>
      )}
    </div>
  );
}
