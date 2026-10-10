"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ui/Dialog";
import type { ActionResult, OrgRole } from "../_lib/org";
import type { InviteResult } from "../employer/team/actions";

interface MemberActionsProps {
  userId: string;
  currentRole: OrgRole | null;
  isSelf: boolean;
  invitableRoles: string[];
  changeRoleAction: (userId: string, role: OrgRole) => Promise<ActionResult>;
  removeAction: (userId: string) => Promise<ActionResult>;
}

/** Per-member actions: change role (org_admin only, rendered by the page) and remove. */
export function MemberActions({ userId, currentRole, isSelf, invitableRoles, changeRoleAction, removeAction }: MemberActionsProps) {
  const [role, setRole] = React.useState<OrgRole>(currentRole ?? "employee");
  const [working, setWorking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = React.useState(false);

  const changeRole = async () => {
    setWorking(true);
    setError(null);
    const res = await changeRoleAction(userId, role as OrgRole);
    setWorking(false);
    if (!res.ok) setError(res.error);
    else window.location.reload();
  };

  const remove = async () => {
    setWorking(true);
    const res = await removeAction(userId);
    setWorking(false);
    setConfirmRemove(false);
    if (!res.ok) setError(res.error);
    else window.location.reload();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!isSelf && (
        <>
          <Select value={role} onChange={(e) => setRole(e.target.value as OrgRole)} aria-label="Member role" className="w-40">
            {invitableRoles.map((r) => (
              <option key={r} value={r}>{r.replace("_", " ")}</option>
            ))}
          </Select>
          <Button size="sm" variant="outline" disabled={role === currentRole} isLoading={working} onClick={changeRole}>
            Update role
          </Button>
          <Button size="sm" variant="danger" onClick={() => setConfirmRemove(true)}>
            Remove
          </Button>
        </>
      )}
      {error && <p className="w-full text-xs text-red-600" role="alert">{error}</p>}
      <ConfirmDialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={remove}
        title="Remove team member"
        message="Deactivate this member's access to the organization? They will no longer be able to sign in to the employer portal for this org."
        confirmLabel="Remove"
        danger
        isConfirming={working}
      />
    </div>
  );
}

interface InvitationActionsProps {
  invitationId: string;
  resendAction: (invitationId: string) => Promise<InviteResult>;
  revokeAction: (invitationId: string) => Promise<ActionResult>;
}

/** Resend / revoke for pending invitations, with honest email reporting. */
export function InvitationActions({ invitationId, resendAction, revokeAction }: InvitationActionsProps) {
  const [working, setWorking] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = React.useState(false);

  const resend = async () => {
    setWorking(true);
    setError(null);
    setMessage(null);
    const res = await resendAction(invitationId);
    setWorking(false);
    if (!res.ok) setError(res.error);
    else {
      setMessage(
        res.emailSent
          ? "Invitation resent by email."
          : `Email not configured (${res.emailReason ?? "no provider"}). Share manually: ${res.inviteUrl ?? ""}`,
      );
      window.location.reload();
    }
  };

  const revoke = async () => {
    setWorking(true);
    const res = await revokeAction(invitationId);
    setWorking(false);
    setConfirmRevoke(false);
    if (!res.ok) setError(res.error);
    else window.location.reload();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" onClick={resend} isLoading={working}>
        Resend
      </Button>
      <Button size="sm" variant="danger" onClick={() => setConfirmRevoke(true)}>
        Revoke
      </Button>
      {message && <p className="w-full text-xs text-emerald-700" role="status">{message}</p>}
      {error && <p className="w-full text-xs text-red-600" role="alert">{error}</p>}
      <ConfirmDialog
        open={confirmRevoke}
        onClose={() => setConfirmRevoke(false)}
        onConfirm={revoke}
        title="Revoke invitation"
        message="Revoke this invitation? The link will stop working."
        confirmLabel="Revoke"
        danger
        isConfirming={working}
      />
    </div>
  );
}
