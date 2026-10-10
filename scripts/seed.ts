/**
 * Development seed data — FICTIONAL dataset only.
 *
 * Usage:
 *   SEED_CONFIRM=yes npm run seed
 *
 * The script refuses to run unless SEED_CONFIRM is exactly "yes".
 * It never runs automatically (no postinstall hook, no build-time import).
 * All seeded organizations are suffixed "(Fictional — Seed Data)" so they are
 * unmistakable, and inserts are idempotent via upserts on slug.
 */
import { createClient } from "@supabase/supabase-js";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

interface SeedJob {
  slug: string;
  title: string;
  description: string;
  skills: string[];
  employment_type: string;
  workplace: string;
  salary_min: number;
  salary_max: number;
  city: string;
  category: string;
}

const SEED_JOBS: SeedJob[] = [
  {
    slug: "fictional-senior-frontend-developer",
    title: "Senior Frontend Developer",
    description:
      "Fictional seed job. Build responsive web interfaces for a fictional product team in Lahore.",
    skills: ["React", "TypeScript", "Tailwind CSS"],
    employment_type: "full_time",
    workplace: "hybrid",
    salary_min: 250000,
    salary_max: 400000,
    city: "Lahore",
    category: "Software Development",
  },
  {
    slug: "fictional-junior-accountant",
    title: "Junior Accountant",
    description:
      "Fictional seed job. Handle bookkeeping and monthly reconciliations for a fictional trading company.",
    skills: ["Bookkeeping", "Excel", "QuickBooks"],
    employment_type: "full_time",
    workplace: "on_site",
    salary_min: 60000,
    salary_max: 90000,
    city: "Karachi",
    category: "Accounting",
  },
  {
    slug: "fictional-digital-marketing-executive",
    title: "Digital Marketing Executive",
    description:
      "Fictional seed job. Run paid and organic campaigns for a fictional e-commerce brand.",
    skills: ["SEO", "Meta Ads", "Content Writing"],
    employment_type: "full_time",
    workplace: "remote",
    salary_min: 120000,
    salary_max: 180000,
    city: "Islamabad",
    category: "Marketing",
  },
];

async function main(): Promise<void> {
  if (process.env.SEED_CONFIRM !== "yes") {
    console.error('Refusing to seed: set SEED_CONFIRM=yes to confirm you want fictional dev data.');
    process.exit(1);
  }

  const admin = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // One fictional org (upsert on slug).
  const orgSlug = "fictional-acme-seed";
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .upsert(
      {
        name: "Acme Fictional Pvt. Ltd. (Fictional — Seed Data)",
        slug: orgSlug,
        about: "Fictional organization used only for local development seed data.",
        industry: "Technology",
        verification_status: "verified",
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();
  if (orgError || !org) throw new Error(`Failed to seed org: ${orgError?.message}`);

  const { data: locations } = await admin.from("locations").select("id, city");
  const { data: categories } = await admin.from("job_categories").select("id, name");
  const locationByCity = new Map((locations ?? []).map((l) => [l.city, l.id]));
  const categoryByName = new Map((categories ?? []).map((c) => [c.name, c.id]));

  for (const job of SEED_JOBS) {
    const { error } = await admin.from("jobs").upsert(
      {
        org_id: org.id,
        title: job.title,
        slug: job.slug,
        description: job.description,
        skills: job.skills,
        employment_type: job.employment_type,
        workplace: job.workplace,
        salary_min: job.salary_min,
        salary_max: job.salary_max,
        salary_disclosed: true,
        currency: "PKR",
        status: "published",
        published_at: new Date().toISOString(),
        location_id: locationByCity.get(job.city) ?? null,
        category_id: categoryByName.get(job.category) ?? null,
      },
      { onConflict: "slug" },
    );
    if (error) throw new Error(`Failed to seed job ${job.slug}: ${error.message}`);
    console.log(`seeded job: ${job.slug}`);
  }

  console.log("\nSeed complete. All data is fictional and marked accordingly.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
