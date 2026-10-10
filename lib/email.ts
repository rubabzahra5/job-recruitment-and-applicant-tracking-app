import "server-only";

import { getEnv, isEmailConfigured } from "@/lib/env";

export interface EmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export type EmailResult =
  | { sent: true; providerId: string }
  | { sent: false; reason: "email_unconfigured" | "provider_error"; detail?: string };

/**
 * Email provider interface. Implementations other than Resend can be added
 * later without changing callers.
 */
export interface EmailProvider {
  readonly name: string;
  send(input: EmailInput): Promise<EmailResult>;
}

/** Minimal Resend implementation over their REST API (no extra dependency). */
class ResendProvider implements EmailProvider {
  readonly name = "resend";

  async send(input: EmailInput): Promise<EmailResult> {
    const env = getEnv();
    const apiKey = env.RESEND_API_KEY;
    const from = env.EMAIL_FROM_ADDRESS;
    if (!apiKey || !from) {
      return { sent: false, reason: "email_unconfigured" };
    }
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return { sent: false, reason: "provider_error", detail: detail.slice(0, 500) };
      }
      const payload = (await res.json()) as { id?: string };
      return { sent: true, providerId: payload.id ?? "unknown" };
    } catch (err) {
      return {
        sent: false,
        reason: "provider_error",
        detail: err instanceof Error ? err.message : "network error",
      };
    }
  }
}

const resendProvider = new ResendProvider();

/**
 * Resolve the configured provider, or null when email is not configured.
 * Callers MUST handle the null case and must NEVER claim a send succeeded
 * when no provider is configured.
 */
export function getEmailProvider(): EmailProvider | null {
  return isEmailConfigured() ? resendProvider : null;
}

/**
 * Send an email if a provider is configured.
 * Returns { sent: false, reason: 'email_unconfigured' } when RESEND_API_KEY or
 * EMAIL_FROM_ADDRESS is missing — no send is attempted and none is claimed.
 */
export async function sendEmail(input: EmailInput): Promise<EmailResult> {
  const provider = getEmailProvider();
  if (!provider) {
    return { sent: false, reason: "email_unconfigured" };
  }
  return provider.send(input);
}
