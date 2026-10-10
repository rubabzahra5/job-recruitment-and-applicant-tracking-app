import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui/Card";
import {
  getCategories,
  getLiveJobCounts,
  publicClient,
} from "../_lib/public-data";

export const metadata: Metadata = {
  title: "Job Categories",
  description: "Browse live job vacancies in Pakistan by category, with real-time opening counts.",
};

export default async function CategoriesPage() {
  const db = await publicClient();
  const [categories, counts] = await Promise.all([getCategories(db), getLiveJobCounts(db)]);
  const total = categories.reduce((sum, c) => sum + (counts.byCategory.get(c.id) ?? 0), 0);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Job categories</h1>
      <p className="mt-1 text-slate-600">
        {total.toLocaleString("en-PK")} live {total === 1 ? "vacancy" : "vacancies"} across {categories.length} categories.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => {
          const count = counts.byCategory.get(c.id) ?? 0;
          return (
            <Link key={c.slug} href={`/jobs?category=${c.slug}`}>
              <Card className="flex h-full items-center gap-4 p-5 transition-shadow hover:shadow-md">
                <span aria-hidden="true" className="text-3xl">{c.icon ?? "💼"}</span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{c.name}</p>
                  <p className="text-sm text-slate-500">
                    {count.toLocaleString("en-PK")} open role{count === 1 ? "" : "s"}
                  </p>
                </div>
                <span aria-hidden="true" className="ml-auto text-slate-300">→</span>
              </Card>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
