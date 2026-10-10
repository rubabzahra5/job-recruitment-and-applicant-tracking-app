"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { assignRole, initiatePasswordReset } from "../actions";

const schema = z.object({
  role: z.enum(["super_admin", "org_admin", "hr_manager", "recruiter", "hiring_manager", "employee", "candidate"]),
  orgId: z.string().optional(),
  confirmation: z.string().optional(),
});

export function AssignRoleDialog({
  targetUserId,
  orgs,
}: {
  targetUserId: string;
  orgs: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { role: "recruiter" },
  });
  const role = watch("role");
  const needsOrg = role !== "super_admin" && role !== "candidate";

  async function onSubmit(values: z.infer<typeof schema>) {
    setError(null);
    const result = await assignRole(targetUserId, {
      role: values.role,
      orgId: needsOrg && values.orgId ? values.orgId : undefined,
      confirmation: values.confirmation,
    });
    if (result.ok) {
      reset();
      setOpen(false);
      router.refresh();
    } else {
      setError(result.error ?? "Failed to assign role.");
    }
  }

  return (
    <>
      <Button type="button" variant="primary" size="sm" onClick={() => setOpen(true)}>
        Assign role
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Assign role">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Role" htmlFor="assign-role" required error={errors.role?.message}>
            <Select id="assign-role" {...register("role")}>
              <option value="super_admin">Super admin (platform-wide)</option>
              <option value="org_admin">Org admin</option>
              <option value="hr_manager">HR manager</option>
              <option value="recruiter">Recruiter</option>
              <option value="hiring_manager">Hiring manager</option>
              <option value="employee">Employee</option>
              <option value="candidate">Candidate (platform-wide)</option>
            </Select>
          </FormField>
          {needsOrg && (
            <FormField
              label="Organization"
              htmlFor="assign-org"
              required
              error={errors.orgId?.message}
              hint="The user must have an active membership in this organization."
            >
              <Select id="assign-org" {...register("orgId")}>
                <option value="">Select…</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </Select>
            </FormField>
          )}
          {role === "super_admin" && (
            <FormField
              label="Type GRANT SUPER ADMIN to confirm"
              htmlFor="assign-confirm"
              required
              hint="Only an existing super admin can grant this. It is platform-wide."
            >
              <Input id="assign-confirm" placeholder="GRANT SUPER ADMIN" {...register("confirmation")} />
            </FormField>
          )}
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting}>Assign</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

/** Password reset button that surfaces the Supabase recovery link honestly. */
export function PasswordResetButton({ targetUserId }: { targetUserId: string }) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [link, setLink] = React.useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await initiatePasswordReset({ targetUserId });
      if (res.ok) setLink(res.link ?? null);
      else setError(res.error ?? "Failed to initiate password reset.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to initiate password reset.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => { setError(null); setLink(null); setOpen(true); }}>
        Initiate password reset
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Password reset">
        {link ? (
          <div className="space-y-4">
            <Alert tone="success" title="Recovery link generated">
              This is the real Supabase recovery link. Deliver it to the user manually — no
              email was sent automatically.
            </Alert>
            <p className="break-all rounded bg-slate-100 p-3 font-mono text-xs">{link}</p>
            <div className="flex justify-end">
              <Button type="button" onClick={() => setOpen(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              Generate a Supabase recovery link for this account? The link will be shown to you
              for manual delivery.
            </p>
            {error && <div className="mt-3"><Alert tone="error">{error}</Alert></div>}
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
              <Button type="button" onClick={run} isLoading={busy}>Generate link</Button>
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}
