"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { resetPasswordAction } from "../reset-password/actions";

const schema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters.").max(128),
    confirmPassword: z.string().min(1, "Please confirm your new password."),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

type FormValues = z.infer<typeof schema>;

export function ResetPasswordForm({ code }: { code: string }) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    // redirect() inside the action throws on success — no return needed.
    const result = await resetPasswordAction({ code, password: values.password });
    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          setError(field as keyof FormValues, { type: "server", message });
        }
      }
      setServerError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {serverError && (
        <Alert tone="error" title="Couldn't reset password">
          {serverError}
        </Alert>
      )}
      <FormField label="New password" htmlFor="rp-password" required error={errors.password?.message} hint="At least 8 characters.">
        <Input {...register("password")} type="password" invalid={!!errors.password} autoComplete="new-password" placeholder="••••••••" />
      </FormField>
      <FormField label="Confirm new password" htmlFor="rp-confirm" required error={errors.confirmPassword?.message}>
        <Input {...register("confirmPassword")} type="password" invalid={!!errors.confirmPassword} autoComplete="new-password" placeholder="••••••••" />
      </FormField>
      <Button type="submit" isLoading={isSubmitting} className="w-full">
        Set new password
      </Button>
    </form>
  );
}
