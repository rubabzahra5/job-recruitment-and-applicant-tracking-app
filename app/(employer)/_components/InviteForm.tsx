"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/ui/FormField";
import { Alert } from "@/components/ui/Alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { InviteInput, InviteResult } from "../employer/team/actions";

const formSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  role: z.string().min(1, "Select a role."),
  departmentId: z.string(),
  expiresInDays: z.string().min(1),
});

type FormValues = z.infer<typeof formSchema>;

interface InviteFormProps {
  departments: { id: string; name: string }[];
  invitableRoles: string[];
  inviteAction: (input: InviteInput) => Promise<InviteResult>;
}

/** Invite form: email + role + department; shows the invite link to share manually. */
export function InviteForm({ departments, invitableRoles, inviteAction }: InviteFormProps) {
  const [result, setResult] = React.useState<InviteResult | null>(null);
  const [working, setWorking] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", role: "recruiter", departmentId: "", expiresInDays: "7" },
  });

  const onSubmit = async (values: FormValues) => {
    setWorking(true);
    setResult(null);
    const res = await inviteAction({
      email: values.email,
      role: values.role as InviteInput["role"],
      departmentId: values.departmentId || null,
      expiresInDays: Math.max(1, Math.min(30, Number(values.expiresInDays) || 7)),
    });
    setWorking(false);
    setResult(res);
    if (res.ok) reset();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite a team member</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2" noValidate>
          {result && !result.ok && (
            <div className="md:col-span-2">
              <Alert tone="error" title="Could not send the invitation">{result.error}</Alert>
            </div>
          )}
          {result?.ok && (
            <div className="md:col-span-2">
              <Alert tone="success" title="Invitation created">
                {result.emailSent
                  ? "The invitation email was sent."
                  : `Email is not configured (${result.emailReason ?? "no provider"}) — share this link manually:`}
                {result.inviteUrl && !result.emailSent && (
                  <span className="mt-1 block break-all font-mono text-xs">{result.inviteUrl}</span>
                )}
              </Alert>
            </div>
          )}
          <FormField label="Email" htmlFor="invite-email" required error={errors.email?.message}>
            <Input type="email" {...register("email")} placeholder="colleague@example.com" invalid={!!errors.email} />
          </FormField>
          <FormField label="Role" htmlFor="invite-role" required error={errors.role?.message}>
            <Select {...register("role")}>
              {invitableRoles.map((r) => (
                <option key={r} value={r}>{r.replace("_", " ")}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Department" htmlFor="invite-dept">
            <Select {...register("departmentId")}>
              <option value="">No department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Expires in (days)" htmlFor="invite-expiry" hint="1–30 days">
            <Input type="number" min={1} max={30} {...register("expiresInDays")} />
          </FormField>
          <div className="md:col-span-2">
            <Button type="submit" isLoading={working}>
              Send invitation
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
