"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import type { ActionResult, OrgRole } from "../_lib/org";
import type { OfferActionResult } from "../employer/offers/actions";

interface OfferActionsProps {
  offerId: string;
  orgId: string;
  status: string;
  role: OrgRole;
  isCreator: boolean;
  expired: boolean;
  submitAction: (offerId: string) => Promise<ActionResult>;
  approveAction: (offerId: string, note?: string) => Promise<ActionResult>;
  rejectApprovalAction: (offerId: string, note: string) => Promise<ActionResult>;
  sendAction: (offerId: string) => Promise<OfferActionResult>;
  decisionAction: (offerId: string, decision: "accepted" | "declined") => Promise<ActionResult>;
  withdrawAction: (offerId: string, reason: string) => Promise<ActionResult>;
  expireAction: (offerId: string) => Promise<ActionResult>;
  hireAction: (offerId: string, notes?: string) => Promise<ActionResult>;
  editHref: string | null;
}

/** Status-aware offer actions with confirmations and honest send reporting. */
export function OfferActions(props: OfferActionsProps) {
  const { offerId, status, role } = props;
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [working, setWorking] = React.useState(false);
  const [confirm, setConfirm] = React.useState<null | { kind: string; title: string; message: string; label: string }>(null);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [withdrawOpen, setWithdrawOpen] = React.useState(false);
  const [hireOpen, setHireOpen] = React.useState(false);
  const [note, setNote] = React.useState("");

  const canApprove = ["org_admin", "hr_manager"].includes(role) && !props.isCreator;

  const run = async (fn: () => Promise<ActionResult | OfferActionResult>, after?: () => void) => {
    setWorking(true);
    setError(null);
    setInfo(null);
    const res = await fn();
    setWorking(false);
    if (!res.ok) {
      setError(res.error);
    } else {
      const email = (res as OfferActionResult).email;
      if (email) {
        setInfo(
          email.sent
            ? "Offer sent. The candidate was notified in-app and by email."
            : `Offer sent. Candidate notified in-app; email not sent (${email.reason === "email_unconfigured" ? "email is not configured" : email.reason ?? "unknown reason"}).`,
        );
      }
      if (after) after();
      else setTimeout(() => window.location.reload(), email ? 2500 : 300);
    }
  };

  const buttons: React.ReactNode[] = [];
  if (status === "draft") {
    buttons.push(
      <Button key="submit" size="sm" variant="primary" onClick={() => setConfirm({ kind: "submit", title: "Submit for approval", message: "Submit this offer for approval by an org admin or HR manager?", label: "Submit" })}>
        Submit for approval
      </Button>,
    );
    buttons.push(
      <Button key="send" size="sm" variant="outline" onClick={() => setConfirm({ kind: "send", title: "Send offer", message: "Send this offer to the candidate? The application will move to Offer Pending.", label: "Send offer" })}>
        Send offer
      </Button>,
    );
    if (props.editHref) {
      buttons.push(
        <Link key="edit" href={props.editHref}>
          <Button size="sm" variant="outline">Edit</Button>
        </Link>,
      );
    }
  }
  if (status === "pending_approval" && canApprove) {
    buttons.push(
      <Button key="approve" size="sm" variant="primary" onClick={() => setConfirm({ kind: "approve", title: "Approve offer", message: "Approve this offer? It will be ready to send.", label: "Approve" })}>
        Approve
      </Button>,
    );
    buttons.push(
      <Button key="reject" size="sm" variant="danger" onClick={() => { setNote(""); setRejectOpen(true); }}>
        Reject
      </Button>,
    );
  }
  if (status === "sent") {
    buttons.push(
      <Button key="accept" size="sm" variant="primary" onClick={() => setConfirm({ kind: "accepted", title: "Record acceptance", message: "Record that the candidate accepted the offer?", label: "Mark accepted" })}>
        Mark accepted
      </Button>,
    );
    buttons.push(
      <Button key="decline" size="sm" variant="outline" onClick={() => setConfirm({ kind: "declined", title: "Record decline", message: "Record that the candidate declined the offer?", label: "Mark declined" })}>
        Mark declined
      </Button>,
    );
    if (props.expired) {
      buttons.push(
        <Button key="expire" size="sm" variant="ghost" onClick={() => setConfirm({ kind: "expire", title: "Expire offer", message: "Mark this offer as expired?", label: "Mark expired" })}>
          Mark expired
        </Button>,
      );
    }
  }
  if (status === "accepted") {
    buttons.push(
      <Button key="hire" size="sm" variant="primary" onClick={() => { setNote(""); setHireOpen(true); }}>
        Mark hired
      </Button>,
    );
  }
  if (["draft", "pending_approval", "sent"].includes(status)) {
    buttons.push(
      <Button key="withdraw" size="sm" variant="danger" onClick={() => { setNote(""); setWithdrawOpen(true); }}>
        Withdraw
      </Button>,
    );
  }

  const execConfirm = () => {
    const kind = confirm?.kind;
    setConfirm(null);
    if (kind === "submit") void run(() => props.submitAction(offerId));
    else if (kind === "send") void run(() => props.sendAction(offerId));
    else if (kind === "approve") void run(() => props.approveAction(offerId));
    else if (kind === "accepted" || kind === "declined") void run(() => props.decisionAction(offerId, kind));
    else if (kind === "expire") void run(() => props.expireAction(offerId));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {buttons}
      {error && <p className="w-full text-xs text-red-600" role="alert">{error}</p>}
      {info && <p className="w-full text-xs text-emerald-700" role="status">{info}</p>}

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={execConfirm}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        confirmLabel={confirm?.label ?? "Confirm"}
        isConfirming={working}
      />

      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject offer approval" description="The offer returns to draft with your note. A note is required.">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} aria-label="Rejection note" placeholder="Why is this offer rejected?" />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
          <Button variant="danger" disabled={!note.trim()} isLoading={working} onClick={() => run(() => props.rejectApprovalAction(offerId, note.trim()), () => setRejectOpen(false))}>
            Reject
          </Button>
        </div>
      </Dialog>

      <Dialog open={withdrawOpen} onClose={() => setWithdrawOpen(false)} title="Withdraw offer" description="A reason is required and will be shared with the candidate.">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} aria-label="Withdrawal reason" placeholder="Reason for withdrawal…" />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setWithdrawOpen(false)}>Cancel</Button>
          <Button variant="danger" disabled={!note.trim()} isLoading={working} onClick={() => run(() => props.withdrawAction(offerId, note.trim()), () => setWithdrawOpen(false))}>
            Withdraw offer
          </Button>
        </div>
      </Dialog>

      <Dialog open={hireOpen} onClose={() => setHireOpen(false)} title="Mark as hired" description="Creates the hiring record and moves the application to Hired.">
        <Input value={note} onChange={(e) => setNote(e.target.value)} aria-label="Hiring notes (optional)" placeholder="Notes (optional)" />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setHireOpen(false)}>Cancel</Button>
          <Button isLoading={working} onClick={() => run(() => props.hireAction(offerId, note.trim() || undefined), () => setHireOpen(false))}>
            Mark hired
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
