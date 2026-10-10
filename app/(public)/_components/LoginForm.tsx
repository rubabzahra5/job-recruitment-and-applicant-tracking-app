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
import { loginAction } from "../login/actions";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm({ next }: { next?: string }) {
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
    const result = await loginAction({ ...values, next });
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
        <Alert tone="error" title="Sign-in failed">
          {serverError}
        </Alert>
      )}
      <FormField label="Email address" htmlFor="login-email" required error={errors.email?.message}>
        <Input
          {...register("email")}
          id="login-email"
          type="email"
          invalid={!!errors.email}
          autoComplete="email"
          placeholder="you@example.com"
        />
      </FormField>
      <FormField label="Password" htmlFor="login-password" required error={errors.password?.message}>
        <Input
          {...register("password")}
          id="login-password"
          type="password"
          invalid={!!errors.password}
          autoComplete="current-password"
          placeholder="••••••••"
        />
      </FormField>
      <div className="flex items-center justify-between">
        <Link href="/forgot-password" className="text-sm font-medium text-brand-700 hover:underline">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" isLoading={isSubmitting} className="w-full">
        Log in
      </Button>
      <p className="text-center text-sm text-slate-600">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-semibold text-brand-700 hover:underline">
          Register free
        </Link>
      </p>
    </form>
  );
}
