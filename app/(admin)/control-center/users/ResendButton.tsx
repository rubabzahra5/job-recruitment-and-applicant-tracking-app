"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { resendInvitation } from "./actions";

/** Resend button that surfaces the regenerated token for manual delivery. */
export function ResendInvitationButton({
  invitationId,
  email,
}: {
  invitationId: string;
  email: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [token, setToken] = React.useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await resendInvitation({ invitationId });
      if (res.ok) {
        setToken(res.token ?? null);
        router.refresh();
      } else {
        setError(res.error ?? "Resend failed.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Resend failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => { setError(null); setToken(null); setOpen(true); }}>
        Resend
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Resend invitation">
        {token ? (
          <div className="space-y-4">
            <Alert tone="success" title="Invitation renewed">
              Token regenerated, expiry extended by 7 days. Deliver this token to {email} manually —
              no email was sent automatically.
            </Alert>
            <p className="break-all rounded bg-slate-100 p-3 font-mono text-xs">{token}</p>
            <div className="flex justify-end">
              <Button type="button" onClick={() => setOpen(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              Regenerate the token and extend expiry by 7 days for {email}?
            </p>
            {error && <div className="mt-3"><Alert tone="error">{error}</Alert></div>}
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="button" onClick={confirm} isLoading={busy}>
                Resend
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}
