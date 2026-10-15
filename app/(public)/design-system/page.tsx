import type { Metadata } from "next";
import {
  Bell,
  Bookmark,
  Briefcase,
  Calculator,
  Clock3,
  GraduationCap,
  Headset,
  Laptop,
  MapPin,
  Banknote,
  Search,
  ShieldCheck,
  Stethoscope,
  Truck,
  Users,
} from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusPill } from "@/components/ui/StatusPill";
import { BridgeDivider, WaveDivider } from "@/components/ui/dividers";
import { CITY_LANDMARKS } from "@/components/ui/CityLandmarks";
import {
  EmptySearchIllustration,
  NoApplicationsIllustration,
  NoSavedJobsIllustration,
  NotFound404Illustration,
  ServerError500Illustration,
  SuccessCheckIllustration,
} from "@/components/ui/StateIllustrations";
import {
  ApplyIllustration,
  CreateProfileIllustration,
  GetHiredIllustration,
} from "@/components/ui/HowItWorks";
import {
  BridgeIllustration,
  DocumentCheckIllustration,
  GrowthChartIllustration,
  NoFeeIllustration,
  PakistanMapPin,
  ShieldCheckIllustration,
} from "@/components/ui/Illustrations";

export const metadata: Metadata = {
  title: "Design System",
  description: "TalentBridge visual asset library and design-system preview.",
};

const PALETTE = [
  { name: "Navy 900", hex: "#0a2f5c", text: "text-white", note: "Headings on light, bg on dark" },
  { name: "Brand 700", hex: "#0b4f9f", text: "text-white", note: "Primary buttons" },
  { name: "Brand 600", hex: "#0f62c4", text: "text-white", note: "Links, accents (AA on white)" },
  { name: "Brand 100", hex: "#d9eaff", text: "text-slate-900", note: "Tinted surfaces" },
  { name: "Brand 50", hex: "#eef6ff", text: "text-slate-900", note: "Subtle backgrounds" },
  { name: "Teal", hex: "#2dd4bf", text: "text-slate-900", note: "Secondary accent, glows" },
  { name: "Amber (warm accent)", hex: "#f59e0b", text: "text-slate-900", note: "Highlights only — sparingly" },
  { name: "Slate 900", hex: "#0f172a", text: "text-white", note: "Body text (AAA)" },
  { name: "Slate 500", hex: "#64748b", text: "text-white", note: "Secondary text (AA large)" },
  { name: "Emerald", hex: "#10b981", text: "text-white", note: "Success / verified" },
  { name: "Rose", hex: "#f43f5e", text: "text-white", note: "Danger / rejected" },
];

const ICON_GALLERY = [
  { icon: Briefcase, label: "Jobs" },
  { icon: MapPin, label: "Location" },
  { icon: Banknote, label: "Salary" },
  { icon: GraduationCap, label: "Education" },
  { icon: Stethoscope, label: "Healthcare" },
  { icon: Laptop, label: "IT" },
  { icon: Calculator, label: "Finance" },
  { icon: Truck, label: "Logistics" },
  { icon: Headset, label: "Support" },
  { icon: Users, label: "Team" },
  { icon: ShieldCheck, label: "Verified" },
  { icon: Bookmark, label: "Saved" },
  { icon: Clock3, label: "Time" },
  { icon: Bell, label: "Alerts" },
  { icon: Search, label: "Search" },
];

function Section({ id, title, blurb, children }: { id: string; title: string; blurb?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="mx-auto max-w-6xl px-4 py-12">
      <h2 id={`${id}-h`} className="text-2xl font-bold tracking-tight text-slate-900">
        {title}
      </h2>
      {blurb && <p className="mt-1 max-w-2xl text-sm text-slate-600">{blurb}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function DesignSystemPage() {
  return (
    <main className="bg-white">
      {/* Hero */}
      <div className="relative overflow-hidden bg-[#0e2a47]">
        <div aria-hidden="true" className="blob-teal pointer-events-none absolute -top-24 end-0 h-96 w-96" />
        <div aria-hidden="true" className="blob-blue pointer-events-none absolute -bottom-24 start-0 h-96 w-96" />
        <div className="relative mx-auto max-w-6xl px-4 py-16">
          <p className="reveal text-xs font-semibold uppercase tracking-widest text-teal-300">
            TalentBridge · Visual asset library
          </p>
          <h1 className="reveal mt-2 text-4xl font-extrabold tracking-tight text-white" style={{ "--d": "80ms" } as React.CSSProperties}>
            Design System
          </h1>
          <p className="reveal mt-3 max-w-2xl text-slate-300" style={{ "--d": "160ms" } as React.CSSProperties}>
            Every color, icon, illustration, pattern, and component in one place.
            Bridge arc is the signature motif; navy + blue + teal with one warm
            amber accent. Lucide icons only — no emoji.
          </p>
        </div>
        <BridgeDivider className="relative text-white" />
      </div>

      {/* Palette */}
      <Section id="palette" title="Palette" blurb="Brand scale plus semantic tones. All body text/background pairs target WCAG AA (4.5:1).">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {PALETTE.map((c) => (
            <div key={c.name} className="overflow-hidden rounded-xl border border-slate-200">
              <div className={`flex h-20 items-end p-3 ${c.text}`} style={{ backgroundColor: c.hex }}>
                <span className="font-mono text-xs">{c.hex}</span>
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">{c.note}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <WaveDivider className="text-slate-50" />
      <div className="bg-slate-50">
        {/* Typography */}
        <Section id="type" title="Typography" blurb="One family, clear scale, tabular numbers for money and stats. Urdu fallback (Noto Nastaliq) can slot in later without layout breaks.">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <p className="text-4xl font-extrabold tracking-tight text-slate-900">Display — Find work that moves Pakistan forward</p>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Heading 1 — Applications</h1>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Heading 2 — Pipeline board</h2>
              <h3 className="text-lg font-semibold text-slate-900">Heading 3 — Candidate details</h3>
              <p className="max-w-[65ch] text-base leading-relaxed text-slate-700">
                Body — Live vacancies from verified employers across the country. Measure capped at 65ch for comfortable reading.
              </p>
              <p className="text-sm text-slate-600">Small — secondary labels and helper text.</p>
              <p className="text-xs text-slate-500">Caption — timestamps, hints, metadata.</p>
              <p className="text-2xl font-bold tabular-nums text-slate-900">Rs 1,00,000 · 11-Oct-2026, 04:30 pm · 1,248</p>
              <p className="text-xs text-slate-500">Tabular numbers keep money, dates, and counts perfectly aligned in tables.</p>
            </CardContent>
          </Card>
        </Section>
      </div>
      <WaveDivider className="rotate-180 text-slate-50" />

      {/* Icon tiles */}
      <Section id="icons" title="Icon tiles" blurb="Lucide only, 1.75px stroke, rounded caps, inside a soft tinted tile. One set, one weight, everywhere.">
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
          {ICON_GALLERY.map(({ icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4">
              <IconTile icon={icon} tone="blue" label={label} />
              <span className="text-xs text-slate-600">{label}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm font-medium text-slate-700">Tones</p>
        <div className="mt-2 flex flex-wrap gap-3">
          {(["blue", "teal", "amber", "emerald", "rose", "slate", "navy"] as const).map((tone) => (
            <span key={tone} className="flex items-center gap-2 text-xs text-slate-600">
              <IconTile icon={Briefcase} tone={tone} size="xs" />
              {tone}
            </span>
          ))}
        </div>
      </Section>

      {/* City landmarks */}
      <Section id="cities" title="City landmarks" blurb="Minimalist line-art silhouettes (stroke, currentColor) for Locations page and city chips.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Object.entries(CITY_LANDMARKS).map(([slug, Cmp]) => (
            <div key={slug} className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <Cmp className="mx-auto h-14 w-auto text-brand-700" />
              <p className="mt-2 text-xs font-medium capitalize text-slate-700">{slug}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* State illustrations */}
      <Section id="states" title="Empty · Success · Error" blurb="Recolorable flat illustrations in brand colors. Bridge motif where it fits.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {[
            { C: EmptySearchIllustration, label: "Empty search" },
            { C: NoApplicationsIllustration, label: "No applications" },
            { C: NoSavedJobsIllustration, label: "No saved jobs" },
            { C: SuccessCheckIllustration, label: "Success" },
            { C: NotFound404Illustration, label: "404 — bridge under construction" },
            { C: ServerError500Illustration, label: "500 — friendly error" },
          ].map(({ C, label }) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
              <C className="mx-auto h-28 w-28" />
              <p className="mt-3 text-xs font-medium text-slate-700">{label}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* How it works */}
      <Section id="how" title="How it works" blurb="Three-step illustrations for onboarding and landing sections.">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { C: CreateProfileIllustration, step: "1", label: "Create your profile" },
            { C: ApplyIllustration, step: "2", label: "Apply in minutes" },
            { C: GetHiredIllustration, step: "3", label: "Get hired" },
          ].map(({ C, step, label }) => (
            <div key={step} className="card-lift rounded-xl border border-slate-200 bg-white p-6 text-center">
              <C className="mx-auto h-28 w-28" />
              <p className="mt-3 text-xs font-bold uppercase tracking-widest text-brand-600">Step {step}</p>
              <p className="mt-1 font-semibold text-slate-900">{label}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Brand illustrations */}
      <Section id="brand" title="Brand illustrations" blurb="Existing motif library — bridge arc thread across hero, features, and trust sections.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[
            { C: BridgeIllustration, label: "Bridge (hero)" },
            { C: ShieldCheckIllustration, label: "No ghost jobs" },
            { C: NoFeeIllustration, label: "Free means free" },
            { C: PakistanMapPin, label: "Pakistan-first" },
            { C: DocumentCheckIllustration, label: "Verified docs" },
            { C: GrowthChartIllustration, label: "Growth" },
          ].map(({ C, label }) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-6 text-center">
              <C className="mx-auto h-24 w-24" />
              <p className="mt-3 text-xs font-medium text-slate-700">{label}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Patterns & dividers */}
      <Section id="patterns" title="Patterns & dividers" blurb="All SVG/CSS — zero image files. Blobs sit behind content; Islamic pattern stays at ~5% opacity.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6">
            <div aria-hidden="true" className="blob-teal pointer-events-none absolute -top-10 -end-10 h-48 w-48" />
            <div aria-hidden="true" className="blob-blue pointer-events-none absolute -bottom-10 -start-10 h-48 w-48" />
            <p className="relative text-sm font-semibold text-slate-900">Gradient blobs</p>
            <p className="relative mt-1 text-xs text-slate-500">.blob-teal · .blob-blue · .blob-amber — blurred radial washes for hero/decorative areas.</p>
          </div>
          <div className="pattern-islamic rounded-xl border border-slate-200 bg-white p-6">
            <p className="text-sm font-semibold text-slate-900">Islamic geometric pattern</p>
            <p className="mt-1 text-xs text-slate-500">.pattern-islamic (light) / .pattern-islamic-dark — 8-point star at 5% opacity.</p>
          </div>
          <div className="bg-dots-dark rounded-xl border border-slate-200 bg-white p-6">
            <p className="text-sm font-semibold text-slate-900">Dot grid</p>
            <p className="mt-1 text-xs text-slate-500">.bg-dots-dark (light) / .bg-dots (dark) — 22px radial dot grid.</p>
          </div>
          <div className="bg-diagonal rounded-xl border border-slate-200 bg-white p-6">
            <p className="text-sm font-semibold text-slate-900">Diagonal texture</p>
            <p className="mt-1 text-xs text-slate-500">.bg-diagonal — subtle repeating diagonal for light sections.</p>
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <div className="bg-[#0e2a47] px-6 pt-8 text-white">
            <p className="text-sm font-semibold">BridgeDivider</p>
            <p className="text-xs text-slate-300">Signature arc divider — place between sections, flip prop reverses it.</p>
          </div>
          <BridgeDivider className="bg-[#0e2a47] text-teal-300" />
          <div className="bg-white px-6 py-4">
            <p className="text-sm font-semibold text-slate-900">WaveDivider</p>
            <p className="text-xs text-slate-500">Curved transition; fill matches the section below.</p>
          </div>
          <WaveDivider className="bg-white text-slate-100" />
        </div>
      </Section>

      {/* Avatars */}
      <Section id="avatars" title="Avatars" blurb="Deterministic per name — solid (default) or gradient. Same person, same colors, everywhere.">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-6 pt-6">
            <div className="flex items-center gap-3">
              <Avatar name="Hira Shahid" size="lg" />
              <Avatar name="Danish Iqbal" size="lg" />
              <Avatar name="Sana Malik" size="lg" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Solid (default)</p>
                <p className="text-xs text-slate-500">Stable bg color from name hash</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Avatar name="Hira Shahid" size="lg" variant="gradient" />
              <Avatar name="Danish Iqbal" size="lg" variant="gradient" />
              <Avatar name="Sana Malik" size="lg" variant="gradient" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Gradient</p>
                <p className="text-xs text-slate-500">Deterministic two-tone pair</p>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <Avatar name="Ali Rehman" size="xs" />
              <Avatar name="Ali Rehman" size="sm" />
              <Avatar name="Ali Rehman" size="md" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Sizes</p>
                <p className="text-xs text-slate-500">xs · sm · md · lg</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* Status pills + badges */}
      <Section id="status" title="Status pills & badges" blurb="Soft fill + solid dot. Emerald = verified/hired, amber = pending, rose = rejected, blue = info, slate = neutral.">
        <Card>
          <CardContent className="flex flex-wrap gap-3 pt-6">
            <StatusPill tone="emerald">Verified</StatusPill>
            <StatusPill tone="emerald" dotPulse>Hired</StatusPill>
            <StatusPill tone="amber">Screening</StatusPill>
            <StatusPill tone="amber" dotPulse>Interview scheduled</StatusPill>
            <StatusPill tone="rose">Rejected</StatusPill>
            <StatusPill tone="blue">Applied</StatusPill>
            <StatusPill tone="teal">Offer sent</StatusPill>
            <StatusPill tone="slate">Draft</StatusPill>
          </CardContent>
        </Card>
        <div className="mt-4 flex flex-wrap gap-3">
          <Badge tone="success">active</Badge>
          <Badge tone="info">candidate</Badge>
          <Badge tone="warning">possible duplicate</Badge>
          <Badge tone="danger">super_admin</Badge>
          <Badge tone="neutral">suspended</Badge>
        </div>
      </Section>

      {/* Buttons & inputs */}
      <Section id="controls" title="Buttons & inputs" blurb="One button language: 5 variants, 3 sizes, loading state. 44px touch targets on interactive controls.">
        <Card>
          <CardContent className="space-y-6 pt-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
              <Button isLoading>Loading</Button>
              <Button disabled>Disabled</Button>
            </div>
            <div className="grid max-w-xl gap-3">
              <Input placeholder="Job title, skill, or company" aria-label="Example input" />
              <Select aria-label="Example select" defaultValue="">
                <option value="" disabled>Choose a city</option>
                <option>Karachi</option>
                <option>Lahore</option>
                <option>Islamabad</option>
              </Select>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* Cards */}
      <Section id="cards" title="Cards" blurb=".card-lift for hover elevation; consistent 16px radius and layered shadow.">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="card-lift">
            <CardHeader>
              <CardTitle>Standard card</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">Hover to feel the lift. Used for categories, employers, dashboard panels.</p>
            </CardContent>
          </Card>
          <Card className="card-lift">
            <CardHeader>
              <div className="flex items-center gap-3">
                <IconTile icon={ShieldCheck} tone="emerald" size="sm" />
                <CardTitle>Icon-led card</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">IconTile + title pattern for feature and KPI cards.</p>
            </CardContent>
          </Card>
          <div className="pattern-islamic rounded-2xl border border-slate-200 bg-white p-6">
            <p className="font-semibold text-slate-900">Patterned panel</p>
            <p className="mt-1 text-sm text-slate-600">Faint geometric texture for trust/feature bands.</p>
          </div>
        </div>
      </Section>

      {/* Motion */}
      <Section id="motion" title="Motion" blurb="150–250ms ease-out. .reveal staggers entrances via --d delay; honors prefers-reduced-motion.">
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="reveal rounded-xl border border-slate-200 bg-white p-6 text-center"
              style={{ "--d": `${i * 120}ms` } as React.CSSProperties}
            >
              <p className="text-sm font-semibold text-slate-900">Reveal card {i + 1}</p>
              <p className="mt-1 text-xs text-slate-500">Slides up with {i * 120}ms stagger</p>
            </div>
          ))}
        </div>
      </Section>

      <footer className="border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-8 text-center">
          <p className="text-xs text-slate-500">
            TalentBridge design system · navy #0a2f5c · blue #0f62c4 · teal #2dd4bf · amber accent #f59e0b ·
            Lucide icons only · bridge-arc motif
          </p>
        </div>
      </footer>
    </main>
  );
}
