import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Find Jobs in Pakistan",
  description: "Browse jobs across Pakistan and apply in minutes.",
};

export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-4xl font-bold tracking-tight">
        Find your next job in Pakistan
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-slate-600">
        HirePakistan connects job seekers with employers across the country —
        from Karachi to Khyber. The public job board is coming soon.
      </p>
    </main>
  );
}
