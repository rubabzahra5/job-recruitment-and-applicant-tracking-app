import { NextResponse } from "next/server";
import { adminContext, applyDateRange, parseDateRange } from "@/app/(admin)/_components/admin-server";
import { exportScopedCsv, type CsvColumn } from "@/lib/csv";
import { writeAudit } from "@/lib/audit";
import { AuthorizationError } from "@/lib/rbac";
import { formatDateKarachi } from "@/lib/format";

const MAX_ROWS = 5000;

type AdminClient = Awaited<ReturnType<typeof adminContext>>["admin"];

interface ExportSpec<T> {
  columns: CsvColumn<T>[];
  fetch: (admin: AdminClient) => Promise<T[]>;
  filename: string;
}

function userSpec(): ExportSpec<Record<string, unknown>> {
  return {
    filename: "users",
    columns: [
      { header: "id", value: (r) => r.id },
      { header: "email", value: (r) => r.email },
      { header: "display_name", value: (r) => r.display_name },
      { header: "is_active", value: (r) => r.is_active },
      { header: "roles", value: (r) => r.roles },
      { header: "organizations", value: (r) => r.orgs },
      { header: "created_at", value: (r) => r.created_at },
    ],
    fetch: async (admin) => {
      const [profiles, roles, memberships] = await Promise.all([
        admin.from("profiles").select("id,email,display_name,is_active,created_at").order("created_at"),
        admin.from("user_roles").select("user_id,role,org_id"),
        admin.from("organization_memberships").select("user_id,org:organizations(name)"),
      ]);
      const roleMap = new Map<string, string[]>();
      for (const r of roles.data ?? []) {
        const list = roleMap.get(r.user_id as string) ?? [];
        list.push(r.role as string);
        roleMap.set(r.user_id as string, list);
      }
      const orgMap = new Map<string, string[]>();
      for (const m of memberships.data ?? []) {
        const list = orgMap.get(m.user_id as string) ?? [];
        const org = m.org as { name?: string } | null;
        if (org?.name) list.push(org.name);
        orgMap.set(m.user_id as string, list);
      }
      return (profiles.data ?? []).map((p) => ({
        id: p.id,
        email: p.email,
        display_name: p.display_name,
        is_active: p.is_active,
        roles: (roleMap.get(p.id as string) ?? []).join("; "),
        orgs: [...new Set(orgMap.get(p.id as string) ?? [])].join("; "),
        created_at: p.created_at,
      }));
    },
  };
}

function orgSpec(range: { from: string | null; to: string | null }): ExportSpec<Record<string, unknown>> {
  return {
    filename: "organizations",
    columns: [
      { header: "id", value: (r) => r.id },
      { header: "name", value: (r) => r.name },
      { header: "slug", value: (r) => r.slug },
      { header: "verification_status", value: (r) => r.verification_status },
      { header: "account_status", value: (r) => r.account_status },
      { header: "industry", value: (r) => r.industry },
      { header: "contact_email", value: (r) => r.contact_email },
      { header: "created_at", value: (r) => r.created_at },
    ],
    fetch: async (admin) => {
      const q = applyDateRange(
        admin.from("organizations").select("id,name,slug,verification_status,account_status,industry,contact_email,created_at").order("created_at"),
        range,
      );
      const { data } = await q;
      return (data ?? []) as Record<string, unknown>[];
    },
  };
}

function jobSpec(range: { from: string | null; to: string | null }): ExportSpec<Record<string, unknown>> {
  return {
    filename: "jobs",
    columns: [
      { header: "id", value: (r) => r.id },
      { header: "title", value: (r) => r.title },
      { header: "organization", value: (r) => r.organization },
      { header: "category", value: (r) => r.category },
      { header: "location", value: (r) => r.location },
      { header: "status", value: (r) => r.status },
      { header: "employment_type", value: (r) => r.employment_type },
      { header: "workplace", value: (r) => r.workplace },
      { header: "applications", value: (r) => r.applications },
      { header: "published_at", value: (r) => r.published_at },
      { header: "created_at", value: (r) => r.created_at },
    ],
    fetch: async (admin) => {
      const q = applyDateRange(
        admin
          .from("jobs")
          .select(
            "id,title,status,employment_type,workplace,published_at,created_at," +
              "org:organizations(name),cat:job_categories(name),loc:locations(city,province)",
          )
          .order("created_at"),
        range,
      );
      const { data } = await q;
      const jobs = (data ?? []) as Array<Record<string, unknown>>;
      const appCounts = new Map<string, number>();
      if (jobs.length > 0) {
        const { data: apps } = await admin
          .from("applications")
          .select("job_id")
          .in("job_id", jobs.map((j) => j.id as string));
        for (const a of apps ?? []) {
          const id = a.job_id as string;
          appCounts.set(id, (appCounts.get(id) ?? 0) + 1);
        }
      }
      return jobs.map((j) => {
        const org = j.org as { name?: string } | null;
        const cat = j.cat as { name?: string } | null;
        const loc = j.loc as { city?: string; province?: string } | null;
        return {
          ...j,
          organization: org?.name ?? "",
          category: cat?.name ?? "",
          location: loc ? `${loc.city}, ${loc.province}` : "",
          applications: appCounts.get(j.id as string) ?? 0,
        };
      });
    },
  };
}

function applicationSpec(range: { from: string | null; to: string | null }): ExportSpec<Record<string, unknown>> {
  return {
    filename: "applications",
    columns: [
      { header: "id", value: (r) => r.id },
      { header: "candidate_email", value: (r) => r.candidate_email },
      { header: "job_title", value: (r) => r.job_title },
      { header: "organization", value: (r) => r.organization },
      { header: "stage", value: (r) => r.stage },
      { header: "submitted_at", value: (r) => r.submitted_at },
    ],
    fetch: async (admin) => {
      const q = applyDateRange(
        admin
          .from("applications")
          .select(
            "id,stage,submitted_at,profile:profiles!applications_user_id_fkey(email)," +
              "job:jobs(title),org:organizations(name)",
          )
          .order("submitted_at"),
        range,
      );
      const { data } = await q;
      return ((data ?? []) as Array<Record<string, unknown>>).map((a) => {
        const profile = a.profile as { email?: string } | null;
        const job = a.job as { title?: string } | null;
        const org = a.org as { name?: string } | null;
        return {
          id: a.id,
          candidate_email: profile?.email ?? "",
          job_title: job?.title ?? "",
          organization: org?.name ?? "",
          stage: a.stage,
          submitted_at: a.submitted_at,
        };
      });
    },
  };
}

function summarySpec(range: { from: string | null; to: string | null }): ExportSpec<Record<string, unknown>> {
  return {
    filename: "summary",
    columns: [
      { header: "metric", value: (r) => r.metric },
      { header: "value", value: (r) => r.value },
    ],
    fetch: async (admin) => {
      const [orgs, profiles, jobs, apps, interviews, offers, hires, candidates] = await Promise.all([
        applyDateRange(admin.from("organizations").select("id,verification_status,account_status"), range),
        applyDateRange(admin.from("profiles").select("id,is_active"), range),
        applyDateRange(admin.from("jobs").select("id,status"), range),
        applyDateRange(admin.from("applications").select("id,stage"), range),
        admin.from("interviews").select("id,status"),
        admin.from("offers").select("id,status"),
        admin.from("hiring_records").select("id"),
        applyDateRange(admin.from("candidate_profiles").select("id"), range),
      ]);
      const orgRows = (orgs.data ?? []) as Array<{ verification_status: string; account_status: string }>;
      const profileRows = (profiles.data ?? []) as Array<{ is_active: boolean }>;
      const jobRows = (jobs.data ?? []) as Array<{ status: string }>;
      const appRows = (apps.data ?? []) as Array<{ stage: string }>;
      const interviewRows = (interviews.data ?? []) as Array<{ status: string }>;
      const offerRows = (offers.data ?? []) as Array<{ status: string }>;
      const rows: Array<{ metric: string; value: number }> = [
        { metric: "organizations", value: orgRows.length },
        { metric: "organizations_pending_verification", value: orgRows.filter((o) => o.verification_status === "pending").length },
        { metric: "organizations_suspended", value: orgRows.filter((o) => o.account_status === "suspended").length },
        { metric: "profiles", value: profileRows.length },
        { metric: "profiles_active", value: profileRows.filter((p) => p.is_active).length },
        { metric: "profiles_suspended", value: profileRows.filter((p) => !p.is_active).length },
        { metric: "candidates", value: (candidates.data ?? []).length },
        { metric: "jobs", value: jobRows.length },
        { metric: "jobs_published", value: jobRows.filter((j) => j.status === "published").length },
        { metric: "jobs_draft", value: jobRows.filter((j) => j.status === "draft").length },
        { metric: "jobs_pending_review", value: jobRows.filter((j) => j.status === "pending_review").length },
        { metric: "applications", value: appRows.length },
        { metric: "interviews", value: interviewRows.length },
        { metric: "interviews_scheduled", value: interviewRows.filter((i) => i.status === "scheduled").length },
        { metric: "offers", value: offerRows.length },
        { metric: "offers_pending_approval", value: offerRows.filter((o) => o.status === "pending_approval").length },
        { metric: "hires", value: (hires.data ?? []).length },
      ];
      const stageCounts = new Map<string, number>();
      for (const a of appRows) stageCounts.set(a.stage, (stageCounts.get(a.stage) ?? 0) + 1);
      for (const [stage, count] of [...stageCounts.entries()].sort()) {
        rows.push({ metric: `applications_stage_${stage}`, value: count });
      }
      return rows;
    },
  };
}

/**
 * GET /control-center/export?kind=summary|users|orgs|jobs|applications&from=&to=
 *
 * Authorized server-side (super_admin, verified fresh per request). Every
 * export is bounded (max 5000 rows) and written to audit_logs.
 */
export async function GET(request: Request) {
  let ctx;
  try {
    ctx = await adminContext();
  } catch (e) {
    if (e instanceof AuthorizationError) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }
    if (e instanceof Error && /authentication required/i.test(e.message)) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    return NextResponse.json({ error: "Export failed." }, { status: 500 });
  }
  const { user, admin } = ctx;
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const range = parseDateRange({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });

  const specs: Record<string, () => ExportSpec<Record<string, unknown>>> = {
    summary: () => summarySpec(range),
    users: userSpec,
    orgs: () => orgSpec(range),
    jobs: () => jobSpec(range),
    applications: () => applicationSpec(range),
  };
  const build = specs[kind ?? ""];
  if (!build) {
    return NextResponse.json(
      { error: "Unknown export kind. Use summary, users, orgs, jobs or applications." },
      { status: 400 },
    );
  }

  try {
    const spec = build();
    const rows = await spec.fetch(admin);
    const csv = exportScopedCsv(rows, spec.columns, {
      maxRows: MAX_ROWS,
      scope: `control-center export ${kind}`,
    });
    await writeAudit({
      actorUserId: user.id,
      action: "report.exported",
      entityType: "report",
      entityId: null,
      metadata: { kind, rowCount: rows.length, from: range.from, to: range.to },
    });
    const stamp = formatDateKarachi(new Date(), {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).replace(/[/\s,]/g, "-");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="hirepakistan-${spec.filename}-${stamp}.csv"`,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Export failed." },
      { status: 500 },
    );
  }
}
