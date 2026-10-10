"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { registerAction } from "../register/actions";

const schema = z
  .object({
    name: z.string().trim().min(2, "Please enter your full name.").max(100),
    email: z.string().trim().email("Enter a valid email address.").max(255),
    password: z.string().min(8, "Password must be at least 8 characters.").max(128),
    confirmPassword: z.string().min(1, "Please confirm your password."),
    accountType: z.enum(["candidate", "employer"]),
    phone: z.string().trim().max(32).optional(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

type FormValues = z.infer<typeof schema>;

export function RegisterForm({
  defaultType,
  next,
}: {
  defaultType: "candidate" | "employer";
  next?: string;
}) {
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { accountType: defaultType },
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    // redirect() inside the action throws on success — no return needed.
    const result = await registerAction({ ...values, next });
    if (result.ok) {
      setPendingEmail(values.email);
      return;
    }
    if (result.fieldErrors) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        setError(field as keyof FormValues, { type: "server", message });
      }
    }
    setServerError(result.error);
  }

  if (pendingEmail) {
    return (
      <Alert tone="success" title="Check your inbox">
        <p>
          We&apos;ve created your account for <strong>{pendingEmail}</strong>.
          Please check your email for the verification link to activate it,
          then log in.
        </p>
        <p className="mt-2">
          <Link href="/login" className="font-semibold underline">
            Go to login
          </Link>
        </p>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {serverError && (
        <Alert tone="error" title="Registration failed">
          {serverError}
        </Alert>
      )}
      <FormField label="Full name" htmlFor="reg-name" required error={errors.name?.message}>
        <Input {...register("name")} invalid={!!errors.name} autoComplete="name" placeholder="Ali Raza" />
      </FormField>
      <FormField label="Email address" htmlFor="reg-email" required error={errors.email?.message}>
        <Input {...register("email")} type="email" invalid={!!errors.email} autoComplete="email" placeholder="you@example.com" />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Password" htmlFor="reg-password" required error={errors.password?.message} hint="At least 8 characters.">
          <Input {...register("password")} type="password" invalid={!!errors.password} autoComplete="new-password" placeholder="••••••••" />
        </FormField>
        <FormField label="Confirm password" htmlFor="reg-confirm" required error={errors.confirmPassword?.message}>
          <Input {...register("confirmPassword")} type="password" invalid={!!errors.confirmPassword} autoComplete="new-password" placeholder="••••••••" />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="I am a" htmlFor="reg-type" required error={errors.accountType?.message}>
          <Select {...register("accountType")} invalid={!!errors.accountType}>
            <option value="candidate">Job seeker</option>
            <option value="employer">Employer</option>
          </Select>
        </FormField>
        <FormField
          label="Phone (optional)"
          htmlFor="reg-phone"
          error={errors.phone?.message}
          hint="Pakistani mobile, e.g. 03001234567."
        >
          <Input {...register("phone")} invalid={!!errors.phone} autoComplete="tel" placeholder="03001234567" />
        </FormField>
      </div>
      <Button type="submit" isLoading={isSubmitting} className="w-full">
        Create account
      </Button>
      <p className="text-center text-xs text-slate-500">
        By registering you agree to our{" "}
        <Link href="/terms" className="font-medium text-brand-700 hover:underline">Terms of Use</Link>{" "}
        and{" "}
        <Link href="/privacy" className="font-medium text-brand-700 hover:underline">Privacy Policy</Link>.
      </p>
      <p className="text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
