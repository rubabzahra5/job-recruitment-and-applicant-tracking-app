/**
 * One-time super-admin bootstrap. SERVER-ONLY.
 *
 * Usage:
 *   BOOTSTRAP_ADMIN_EMAIL=owner@example.com npm run bootstrap-admin
 *   BOOTSTRAP_ADMIN_EMAIL=owner@example.com npm run bootstrap-admin -- --force
 *
 * What it does:
 *   1. Reads BOOTSTRAP_ADMIN_EMAIL (required).
 *   2. Refuses if a super_admin already exists — unless --force is passed AND
 *      the operator re-types the email as confirmation.
 *   3. Asks the operator to type the target email to confirm.
 *   4. Looks up the auth user by email and grants user_roles(super_admin, org_id NULL).
 *   5. Prints instructions to disable/remove this script afterwards.
 *
 * There is intentionally NO public super-admin registration page.
 */
import readline from "node:readline";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function findUserByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<{ id: string; email: string } | null> {
  // supabase-js has no getUserByEmail; page through listUsers (fine for bootstrap).
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Failed to list users: ${error.message}`);
    const match = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (match?.email) return { id: match.id, email: match.email };
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function main(): Promise<void> {
  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const targetEmail = requiredEnv("BOOTSTRAP_ADMIN_EMAIL");
  const force = process.argv.includes("--force");

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Refuse if a super_admin already exists (unless --force + typed confirmation).
  const { data: existing, error: existingError } = await admin
    .from("user_roles")
    .select("id")
    .eq("role", "super_admin")
    .is("org_id", null)
    .limit(1);
  if (existingError) throw new Error(`Failed to check existing admins: ${existingError.message}`);
  if (existing && existing.length > 0 && !force) {
    console.error(
      "A super_admin already exists. Re-run with --force (and typed confirmation) " +
        "only if you know exactly what you are doing.",
    );
    process.exit(1);
  }

  const typed = await ask(
    `Type the admin email to confirm (${targetEmail}): `,
  );
  if (typed.toLowerCase() !== targetEmail.toLowerCase()) {
    console.error("Confirmation did not match. Aborting — nothing was changed.");
    process.exit(1);
  }
  if (force) {
    const typedForce = await ask("Type CONFIRM-FORCE to override the existing super_admin check: ");
    if (typedForce !== "CONFIRM-FORCE") {
      console.error("Force confirmation did not match. Aborting — nothing was changed.");
      process.exit(1);
    }
  }

  const user = await findUserByEmail(admin, targetEmail);
  if (!user) {
    console.error(
      `No auth user found with email ${targetEmail}. The user must sign up first, then re-run this script.`,
    );
    process.exit(1);
  }

  const { error: grantError } = await admin.from("user_roles").upsert(
    { user_id: user.id, org_id: null, role: "super_admin" },
    { onConflict: "user_id,role,org_id" },
  );
  // NOTE: the unique index uses coalesce(org_id, zero-uuid); upsert conflict
  // target on the plain columns may not match the expression index. Fall back
  // to insert-with-ignore on conflict if the upsert errors on the target.
  if (grantError) {
    const { error: insertError } = await admin
      .from("user_roles")
      .insert({ user_id: user.id, org_id: null, role: "super_admin" });
    if (insertError && !insertError.message.includes("duplicate")) {
      throw new Error(`Failed to grant super_admin: ${insertError.message}`);
    }
  }

  console.log(`\nGranted super_admin to ${user.email} (${user.id}).`);
  console.log(
    "\nNEXT STEPS (do these now):\n" +
      "  1. Sign in with that account and verify /control-center access.\n" +
      "  2. Disable this script: unset BOOTSTRAP_ADMIN_EMAIL and either delete\n" +
      "     scripts/bootstrap-admin.ts or remove the \"bootstrap-admin\" npm script.\n" +
      "  3. Never create a public registration page for super admins.",
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
