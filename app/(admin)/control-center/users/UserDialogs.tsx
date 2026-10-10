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
import { createInvitation, provisionUser } from "./actions";

export interface OrgOption {
  id: string;
  name: string;
}

const inviteSchema = z.object({
  orgId: z.string().uuid("Select an organization."),
  email: z.string().trim().email("Enter a valid email address."),
  role: z.enum(["org_admin", "hr_manager", "recruiter", "hiring_manager", "employee"]),
});

export function InviteDialog({ orgs }: { orgs: OrgOption[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [token, setToken] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: "recruiter" },
  });

  async function onSubmit(values: z.infer<typeof inviteSchema>) {
    setError(null);
    setToken(null);
    const result = await createInvitation(values);
    if (result.ok) {
      setToken(result.token ?? null);
      reset();
      router.refresh();
    } else {
      setError(result.error ?? "Failed to create invitation.");
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => { setOpen(true); setToken(null); }}>
        Invite user
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Invite org user">
        {token ? (
          <div className="space-y-4">
            <Alert tone="success" title="Invitation created">
              Share this invite token with the user (valid 7 days). Email sending is not
              automatic — deliver it manually.
            </Alert>
            <p className="break-all rounded bg-slate-100 p-3 font-mono text-xs">{token}</p>
            <div className="flex justify-end">
              <Button type="button" onClick={() => setOpen(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField label="Email" htmlFor="invite-email" required error={errors.email?.message}>
              <Input id="invite-email" type="email" invalid={!!errors.email} {...register("email")} />
            </FormField>
            <FormField label="Organization" htmlFor="invite-org" required error={errors.orgId?.message}>
              <Select id="invite-org" {...register("orgId")}>
                <option value="">Select…</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Role" htmlFor="invite-role" required error={errors.role?.message}>
              <Select id="invite-role" {...register("role")}>
                <option value="org_admin">Org admin</option>
                <option value="hr_manager">HR manager</option>
                <option value="recruiter">Recruiter</option>
                <option value="hiring_manager">Hiring manager</option>
                <option value="employee">Employee</option>
              </Select>
            </FormField>
            {error && <Alert tone="error">{error}</Alert>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" isLoading={isSubmitting}>Create invitation</Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}

const provisionSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  displayName: z.string().trim().min(2, "Display name is required.").max(120),
  role: z.enum(["candidate", "super_admin"]),
  confirmation: z.string().optional(),
});

export function ProvisionDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [link, setLink] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof provisionSchema>>({
    resolver: zodResolver(provisionSchema),
    defaultValues: { role: "candidate" },
  });
  const role = watch("role");

  async function onSubmit(values: z.infer<typeof provisionSchema>) {
    setError(null);
    setLink(null);
    const result = await provisionUser(values);
    if (result.ok) {
      setLink(result.link ?? null);
      reset();
      router.refresh();
    } else {
      setError(result.error ?? "Failed to provision user.");
    }
  }

  return (
    <>
      <Button type="button" variant="primary" size="sm" onClick={() => { setOpen(true); setLink(null); }}>
        Provision user
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Provision user directly">
        {link ? (
          <div className="space-y-4">
            <Alert tone="success" title="Account created">
              Share this one-time recovery link so the user can set their password. No email was
              sent automatically.
            </Alert>
            <p className="break-all rounded bg-slate-100 p-3 font-mono text-xs">{link}</p>
            <div className="flex justify-end">
              <Button type="button" onClick={() => setOpen(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField label="Email" htmlFor="prov-email" required error={errors.email?.message}>
              <Input id="prov-email" type="email" invalid={!!errors.email} {...register("email")} />
            </FormField>
            <FormField label="Display name" htmlFor="prov-name" required error={errors.displayName?.message}>
              <Input id="prov-name" invalid={!!errors.displayName} {...register("displayName")} />
            </FormField>
            <FormField label="Role" htmlFor="prov-role" required error={errors.role?.message}>
              <Select id="prov-role" {...register("role")}>
                <option value="candidate">Candidate</option>
                <option value="super_admin">Super admin</option>
              </Select>
            </FormField>
            {role === "super_admin" && (
              <FormField
                label="Type GRANT SUPER ADMIN to confirm"
                htmlFor="prov-confirm"
                required
                error={errors.confirmation?.message}
                hint="Super-admin grants are platform-wide and irreversible except by another super admin."
              >
                <Input id="prov-confirm" {...register("confirmation")} placeholder="GRANT SUPER ADMIN" />
              </FormField>
            )}
            {error && <Alert tone="error">{error}</Alert>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" isLoading={isSubmitting}>Provision</Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
