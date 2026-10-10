import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui/Card";
import {
  PROVINCES,
  getLiveJobCounts,
  getLocations,
  publicClient,
} from "../_lib/public-data";

export const metadata: Metadata = {
  title: "Jobs by Location",
  description: "Browse live job vacancies across Pakistan's cities, provinces, and territories.",
};

export default async function LocationsPage() {
  const db = await publicClient();
  const [locations, counts] = await Promise.all([getLocations(db), getLiveJobCounts(db)]);

  const byProvince = new Map<string, typeof locations>();
  for (const l of locations) {
    const list = byProvince.get(l.province) ?? [];
    list.push(l);
    byProvince.set(l.province, list);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Jobs by location</h1>
      <p className="mt-1 text-slate-600">
        Live vacancies across Pakistan — pick a city, or filter by province in{" "}
        <Link href="/jobs" className="font-semibold text-brand-700 hover:underline">job search</Link>.
      </p>

      {PROVINCES.map((province) => {
        const locs = byProvince.get(province) ?? [];
        if (locs.length === 0) return null;
        const provinceTotal = locs.reduce((s, l) => s + (counts.byLocation.get(l.id) ?? 0), 0);
        return (
          <section key={province} className="mt-8" aria-label={province}>
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-bold text-slate-900">{province}</h2>
              <Link
                href={`/jobs?province=${encodeURIComponent(province)}`}
                className="text-sm font-semibold text-brand-700 hover:underline"
              >
                {provinceTotal.toLocaleString("en-PK")} jobs →
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {locs.map((l) => {
                const count = counts.byLocation.get(l.id) ?? 0;
                return (
                  <Link key={l.id} href={`/jobs?city=${l.id}`}>
                    <Card className="h-full p-4 transition-shadow hover:shadow-md">
                      <p className="font-semibold text-slate-900">{l.city}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {count.toLocaleString("en-PK")} open role{count === 1 ? "" : "s"}
                      </p>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </main>
  );
}
