"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { submitContactMessage } from "../contact/actions";

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(100),
  email: z.string().trim().email("Enter a valid email address.").max(255),
  subject: z.string().trim().min(3, "Subject is too short.").max(150),
  message: z.string().trim().min(10, "Message must be at least 10 characters.").max(5000),
});

type FormValues = z.infer<typeof schema>;

export function ContactForm() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const result = await submitContactMessage(values);
    if (result.ok) {
      setSent(true);
      return;
    }
    if (result.fieldErrors) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        setError(field as keyof FormValues, { type: "server", message });
      }
    }
    setServerError(result.error);
  }

  if (sent) {
    return (
      <Alert tone="success" title="Message sent">
        Thank you — your message is on its way. Our team reads every enquiry
        and will reply to the email address you provided.
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {serverError && (
        <Alert tone="error" title="Something went wrong">
          {serverError}
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Your name" htmlFor="contact-name" required error={errors.name?.message}>
          <Input {...register("name")} invalid={!!errors.name} autoComplete="name" placeholder="Ali Raza" />
        </FormField>
        <FormField label="Email address" htmlFor="contact-email" required error={errors.email?.message}>
          <Input {...register("email")} invalid={!!errors.email} autoComplete="email" placeholder="you@example.com" />
        </FormField>
      </div>
      <FormField label="Subject" htmlFor="contact-subject" required error={errors.subject?.message}>
        <Input {...register("subject")} invalid={!!errors.subject} placeholder="How can we help?" />
      </FormField>
      <FormField
        label="Message"
        htmlFor="contact-message"
        required
        error={errors.message?.message}
        hint="Tell us what's on your mind — the more detail, the better we can help."
      >
        <Textarea {...register("message")} invalid={!!errors.message} rows={6} />
      </FormField>
      <Button type="submit" isLoading={isSubmitting}>
        Send message
      </Button>
    </form>
  );
}
