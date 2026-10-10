import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { formatDateKarachi } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { getInvitation, acceptInvitation, invitationRedirect } from "./actions";

export const metadata: Metadata = { title: "Accept invitation" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await getInvitation(token);

  if (invitation.status === "invalid") {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <Alert tone="error" title="Invalid invitation">
          This invitation link is not valid. Ask the sender for a new one.
        </Alert>
      </main>
    );
  }

  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  if (invitation.status === "expired") {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <Alert tone="warning" title="Invitation expired">
          This invitation expired on {formatDateKarachi(invitation.expiresAt)}. Ask an organization admin to send a new one.
        </Alert>
      </main>
    );
  }

  if (invitation.status === "revoked") {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <Alert tone="warning" title="Invitation revoked">
          This invitation was revoked by the organization.
        </Alert>
      </main>
    );
  }

  if (invitation.status === "accepted" || invitation.alreadyMember) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Already a member</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              You are already a member of {invitation.orgName}.
            </p>
            <form action={invitationRedirect.bind(null, token)} className="mt-4">
              <Button type="submit">Go to employer portal</Button>
            </form>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Join {invitation.orgName}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            You&apos;ve been invited to join <span className="font-medium text-slate-900">{invitation.orgName}</span> as:
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Badge tone="info">{invitation.role.replace("_", " ")}</Badge>
            {invitation.departmentName && <span className="text-sm text-slate-500">{invitation.departmentName}</span>}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Signed in as {user.email}. This invitation expires {formatDateKarachi(invitation.expiresAt)} and can only
            be accepted by the invited email address.
          </p>
          <form
            action={async () => {
              "use server";
              const result = await acceptInvitation(token);
              if (!result.ok) throw new Error(result.error);
              await invitationRedirect(token);
            }}
            className="mt-6"
          >
            <Button type="submit" size="lg" className="w-full">
              Accept invitation
            </Button>
          </form>
          <p className="mt-3 text-center text-xs text-slate-500">
            <Link href="/" className="hover:underline">Decline and go home</Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
