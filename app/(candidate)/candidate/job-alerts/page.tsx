import type { Metadata } from "next";
import Link from "next/link";
import { requireCandidate, getLocations } from "@/app/(candidate)/_lib/candidate-guard";
import { AlertManager, type AlertDefaults } from "./_components/AlertManager";
import { listAlerts, listCategories } from "./_actions";
import { EMPLOYMENT_TYPES } from "./_lib/employment-types";

export const metadata: Metadata = { title: "Job Alerts" };

interface PageProps {
  searchParams: Promise<{
    from_search?: string;
    keyword?: string;
    city?: string;
    category?: string;
    employment_type?: string;
  }>;
}

/**
 * Deep-link target for "create alert from current search" on /jobs:
 * /candidate/job-alerts?from_search=1&keyword=…&city=…&category=<slug|name>&employment_type=…
 * Matching params prefill the new-alert form.
 */
export default async function JobAlertsPage({ searchParams }: PageProps) {
  await requireCandidate();
  const params = await searchParams;
  const [alerts, categories, locations] = await Promise.all([
    listAlerts(),
    listCategories(),
    getLocations(),
  ]);

  let prefill: AlertDefaults | null = null;
  if (params.from_search === "1") {
    const categoryParam = (params.category ?? "").trim().toLowerCase();
    const matchedCategory = categoryParam
      ? categories.find(
          (c) =>
            c.slug.toLowerCase() === categoryParam ||
            c.name.toLowerCase() === categoryParam,
        )
      : undefined;
    const employmentType = (params.employment_type ?? "").trim();
    const matchedType = (
      (EMPLOYMENT_TYPES as readonly string[]).includes(employmentType)
        ? employmentType
        : ""
    ) as AlertDefaults["employment_type"];
    const city = (params.city ?? "").trim();
    const matchedCity = city
      ? (locations.find((l) => l.city.toLowerCase() === city.toLowerCase())?.city ?? "")
      : "";
    const keyword = (params.keyword ?? "").trim();
    prefill = {
      name: [keyword, matchedCity, matchedCategory?.name].filter(Boolean).join(" · ") || "My job alert",
      keyword,
      city: matchedCity,
      category_id: matchedCategory?.id ?? "",
      employment_type: matchedType,
    };
  }

  return (
    <main>
      <h1 className="text-2xl font-bold tracking-tight">Job alerts</h1>
      <p className="mt-1 text-sm text-slate-600">
        Get notified when new jobs match your criteria. You can also create an
        alert straight from a search on the{" "}
        <Link href="/jobs" className="font-medium text-brand-700 hover:underline">
          job board
        </Link>
        .
      </p>
      <div className="mt-6">
        <AlertManager
          alerts={alerts}
          categories={categories}
          locations={locations}
          prefill={prefill}
        />
      </div>
    </main>
  );
}
