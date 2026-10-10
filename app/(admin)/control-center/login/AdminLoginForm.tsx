"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { verifyAdminLogin } from "./actions";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

type FormValues = z.infer<typeof schema>;

/**
 * Dedicated Control Center sign-in.
 *
 * Credentials go through Supabase Auth (anon key, client-side). The session
 * is then verified SERVER-SIDE as a super_admin; anything else is signed out
 * and rejected with one generic message — no distinction between wrong
 * credentials and a non-admin account, and no org internals are exposed.
 */
export function AdminLoginForm() {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (signInError) {
      setFormError("Invalid email or password, or unauthorized account.");
      return;
    }
    const result = await verifyAdminLogin();
    if (result.ok) {
      router.push("/control-center");
      router.refresh();
    } else {
      setFormError("Invalid email or password, or unauthorized account.");
    }
  }

  return (
    <main className="mx-auto max-w-md py-16">
      <Card>
        <CardHeader>
          <CardTitle>Control Center sign in</CardTitle>
          <p className="mt-1 text-sm text-slate-600">
            Restricted to platform administrators.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField label="Email" htmlFor="email" required error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                invalid={!!errors.email}
                {...register("email")}
              />
            </FormField>
            <FormField
              label="Password"
              htmlFor="password"
              required
              error={errors.password?.message}
            >
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                invalid={!!errors.password}
                {...register("password")}
              />
            </FormField>
            {formError && <Alert tone="error">{formError}</Alert>}
            <Button type="submit" className="w-full" isLoading={isSubmitting}>
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
