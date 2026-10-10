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
import { addOrgMember } from "../actions";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  role: z.enum(["org_admin", "hr_manager", "recruiter", "hiring_manager", "employee"]),
  title: z.string().trim().max(120).optional(),
});

export function AddMemberDialog({ orgId, orgName }: { orgId: string; orgName: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { role: "recruiter" },
  });

  async function onSubmit(values: z.infer<typeof schema>) {
    setError(null);
    const result = await addOrgMember(orgId, values);
    if (result.ok) {
      reset();
      setOpen(false);
      router.refresh();
    } else {
      setError(result.error ?? "Failed to add member.");
    }
  }

  return (
    <>
      <Button type="button" variant="primary" size="sm" onClick={() => setOpen(true)}>
        Add member
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Add member — ${orgName}`}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            label="User email"
            htmlFor="member-email"
            required
            error={errors.email?.message}
            hint="The user must already have a HirePakistan account."
          >
            <Input id="member-email" type="email" invalid={!!errors.email} {...register("email")} />
          </FormField>
          <FormField label="Role" htmlFor="member-role" required error={errors.role?.message}>
            <Select id="member-role" {...register("role")}>
              <option value="org_admin">Org admin</option>
              <option value="hr_manager">HR manager</option>
              <option value="recruiter">Recruiter</option>
              <option value="hiring_manager">Hiring manager</option>
              <option value="employee">Employee</option>
            </Select>
          </FormField>
          <FormField label="Title" htmlFor="member-title" error={errors.title?.message}>
            <Input id="member-title" placeholder="e.g. Talent Acquisition Lead" {...register("title")} />
          </FormField>
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Add member
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
