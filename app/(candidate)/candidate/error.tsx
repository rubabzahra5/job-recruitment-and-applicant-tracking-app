"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

/**
 * Candidate portal error boundary.
 * AuthorizationError (e.g. a user with only org roles reaching candidate
 * pages) renders as an access-denied card instead of a stack trace.
 */
export default function CandidateError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const denied = error.name === "AuthorizationError";

  return (
    <main className="mx-auto max-w-lg py-12">
      <Card>
        <CardContent className="py-8 text-center">
          <h1 className="text-xl font-bold text-slate-900">
            {denied ? "Access denied" : "Something went wrong"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {denied
              ? "This area is for job seekers. Your account does not have the candidate role — if you are an employer, use your employer portal instead."
              : "An unexpected error occurred. Please try again."}
          </p>
          {!denied && error.digest && (
            <p className="mt-2 text-xs text-slate-400">Reference: {error.digest}</p>
          )}
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="outline" onClick={() => reset()}>
              Try again
            </Button>
            <Link href={denied ? "/login" : "/candidate"}>
              <Button variant="primary">{denied ? "Back to sign in" : "Back to dashboard"}</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
