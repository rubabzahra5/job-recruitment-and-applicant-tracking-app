"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Alert } from "@/components/ui/Alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatDateKarachi } from "@/lib/format";
import {
  updateDisplayName,
  changeEmail,
  changePassword,
  type AccountInfo,
} from "../_actions";

const displayNameSchema = z.object({
  display_name: z.string().trim().min(2, "Enter a display name.").max(80),
});

export function DisplayNameForm({ initial }: { initial: string }) {
  const [saved, setSaved] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof displayNameSchema>>({
    resolver: zodResolver(displayNameSchema),
    defaultValues: { display_name: initial },
  });

  async function onSubmit(data: z.infer<typeof displayNameSchema>) {
    setSaved(false);
    setTopError(null);
    const result = await updateDisplayName(data);
    if (result.ok) setSaved(true);
    else setTopError(result.error ?? "Failed to save.");
  }

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
      {topError && <Alert tone="error" className="mb-4">{topError}</Alert>}
      {saved && <Alert tone="success" className="mb-4">Display name updated.</Alert>}
      <FormField label="Display name" htmlFor="display-name" error={errors.display_name?.message}>
        <Input id="display-name" {...register("display_name")} invalid={!!errors.display_name} />
      </FormField>
      <div className="mt-4">
        <Button type="submit" isLoading={isSubmitting}>Save</Button>
      </div>
    </form>
  );
}

const emailSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(255),
});

export function EmailForm({ currentEmail }: { currentEmail: string | null }) {
  const [sent, setSent] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: currentEmail ?? "" },
  });

  async function onSubmit(data: z.infer<typeof emailSchema>) {
    setSent(false);
    setTopError(null);
    const result = await changeEmail(data);
    if (result.ok) setSent(true);
    else setTopError(result.error ?? "Failed to change email.");
  }

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
      {topError && <Alert tone="error" className="mb-4">{topError}</Alert>}
      {sent && (
        <Alert tone="success" className="mb-4" title="Confirmation sent">
          We&apos;ve sent a confirmation link to the new address. Your email changes
          only after you click it.
        </Alert>
      )}
      <FormField
        label="Email address"
        htmlFor="email"
        error={errors.email?.message}
        hint="Changing your email sends a confirmation link to the new address."
      >
        <Input id="email" {...register("email")} type="email" invalid={!!errors.email} />
      </FormField>
      <div className="mt-4">
        <Button type="submit" isLoading={isSubmitting}>Change email</Button>
      </div>
    </form>
  );
}

const passwordSchema = z
  .object({
    new_password: z.string().min(8, "Password must be at least 8 characters.").max(128),
    confirm_password: z.string(),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    message: "Passwords don't match.",
    path: ["confirm_password"],
  });

export function PasswordForm() {
  const [saved, setSaved] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { new_password: "", confirm_password: "" },
  });

  async function onSubmit(data: z.infer<typeof passwordSchema>) {
    setSaved(false);
    setTopError(null);
    const result = await changePassword(data);
    if (result.ok) {
      setSaved(true);
      reset();
    } else {
      setTopError(result.error ?? "Failed to change password.");
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
      {topError && <Alert tone="error" className="mb-4">{topError}</Alert>}
      {saved && <Alert tone="success" className="mb-4">Password changed.</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="New password" htmlFor="new-password" error={errors.new_password?.message}>
          <Input
            id="new-password"
            {...register("new_password")}
            type="password"
            autoComplete="new-password"
            invalid={!!errors.new_password}
          />
        </FormField>
        <FormField label="Confirm new password" htmlFor="confirm-password" error={errors.confirm_password?.message}>
          <Input
            id="confirm-password"
            {...register("confirm_password")}
            type="password"
            autoComplete="new-password"
            invalid={!!errors.confirm_password}
          />
        </FormField>
      </div>
      <div className="mt-4">
        <Button type="submit" isLoading={isSubmitting}>Change password</Button>
      </div>
    </form>
  );
}

export function SessionCard({ info }: { info: AccountInfo }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Session & account</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Account ID</dt>
            <dd className="break-all font-mono text-xs">{info.userId}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Email</dt>
            <dd className="font-medium">{info.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Account created</dt>
            <dd className="font-medium">
              {formatDateKarachi(info.createdAt, { day: "numeric", month: "short", year: "numeric" })}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Last sign-in</dt>
            <dd className="font-medium">{formatDateKarachi(info.lastSignInAt)}</dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <Link href="/candidate/notifications" className="font-medium text-brand-700 hover:underline">
            Notification preferences →
          </Link>
          <Link href="/candidate/privacy" className="font-medium text-brand-700 hover:underline">
            Privacy & data →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
