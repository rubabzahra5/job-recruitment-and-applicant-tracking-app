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
import { requestPasswordReset } from "../forgot-password/actions";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

type FormValues = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    const result = await requestPasswordReset(values);
    if (!result.ok) {
      // Only validation errors reach here; show inline.
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <Alert tone="success" title="Check your inbox">
        If an account exists for that email address, we&apos;ve sent a
        password-reset link. It expires soon, so please use it promptly.
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <FormField label="Email address" htmlFor="fp-email" required error={errors.email?.message}>
        <Input
          {...register("email")}
          type="email"
          invalid={!!errors.email}
          autoComplete="email"
          placeholder="you@example.com"
        />
      </FormField>
      <Button type="submit" isLoading={isSubmitting} className="w-full">
        Send reset link
      </Button>
      <p className="text-center text-sm text-slate-600">
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          Back to login
        </Link>
      </p>
    </form>
  );
}
