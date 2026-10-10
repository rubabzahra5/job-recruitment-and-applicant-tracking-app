import type { Metadata } from "next";
import { Suspense } from "react";
import {
  AdminDeniedError,
  adminPageGuard,
  firstParam,
  getPagination,
  mask,
} from "@/app/(admin)/_components/admin-server";
import { AdminDenied } from "@/app/(admin)/_components/AdminDenied";
import { FilterBar, PaginationNav } from "@/app/(admin)/_components/filters";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";
import { formatDateOnlyKarachi } from "@/lib/format";
import { PrivacyRequestDialog, RevealCandidateButton } from "./CandidateDialogs";

export const metadata: Metadata = { title: "Control Center — Candidates" };
export const dynamic = "force-dynamic";

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  let admin;
  try {
    ({ admin } = await adminPageGuard("/control-center/candidates"));
  } catch (e) {
    if (e instanceof AdminDeniedError) return <AdminDenied />;
    throw e;
  }
  const { page, perPage, from, to } = getPagination(params);
  const search = (firstParam(params.q) ?? "").trim();
  const searchable = firstParam(params.searchable) ?? "";

  let query = admin
    .from("candidate_profiles")
    .select("user_id,headline,city,province,is_searchable,created_at", { count: "exact" })
    .order("created_at", { ascending: false });
  if (search) query = query.or(`headline.ilike.%${search}%,city.ilike.%${search}%`);
  if (searchable === "yes") query = query.eq("is_searchable", true);
  if (searchable === "no") query = query.eq("is_searchable", false);
  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error(`Failed to load candidates: ${error.message}`);
  const candidates = data ?? [];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / perPage));

  const userIds = candidates.map((c) => c.user_id as string);
  const [appCountsRes, requestsRes] = await Promise.all([
    userIds.length > 0
      ? admin.from("applications").select("user_id").in("user_id", userIds)
      : Promise.resolve({ data: [] as never[] }),
    admin
      .from("privacy_requests")
      .select("id,type,status,created_at,detail,profile:profiles!privacy_requests_user_id_fkey(email)")
      .in("status", ["pending", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const appCounts = new Map<string, number>();
  for (const a of (appCountsRes.data ?? []) as Array<{ user_id: string }>) {
    appCounts.set(a.user_id, (appCounts.get(a.user_id) ?? 0) + 1);
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Candidates — privacy-guarded browser</h1>
        <p className="mt-1 text-sm text-slate-600">
          {count ?? 0} profiles. PII is masked by default; every reveal is audit-logged.
        </p>
      </div>

      <Alert tone="info">
        Candidate data is private by default (is_searchable=false). This browser shows only
        non-identifying columns. Use “Reveal PII” for a specific candidate — the disclosure is
        written to audit_logs as candidate_pii_revealed.
      </Alert>

      <Card>
        <CardContent className="pt-4">
          <Suspense>
            <FilterBar
              fields={[
                { key: "q", label: "Search headline/city", type: "search", placeholder: "Lahore…" },
                {
                  key: "searchable",
                  label: "Searchable",
                  type: "select",
                  options: [
                    { value: "yes", label: "Searchable" },
                    { value: "no", label: "Private" },
                  ],
                },
              ]}
            />
          </Suspense>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Candidate profiles</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Candidate</TableHeaderCell>
                <TableHeaderCell>Headline</TableHeaderCell>
                <TableHeaderCell>Location</TableHeaderCell>
                <TableHeaderCell>Searchable</TableHeaderCell>
                <TableHeaderCell>Applications</TableHeaderCell>
                <TableHeaderCell>Joined</TableHeaderCell>
                <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {candidates.map((c) => {
                const uid = c.user_id as string;
                return (
                  <TableRow key={uid}>
                    <TableCell className="font-mono text-xs text-slate-500">
                      {mask(uid, 8)}
                    </TableCell>
                    <TableCell>{(c.headline as string) ?? "—"}</TableCell>
                    <TableCell>{[c.city, c.province].filter(Boolean).join(", ") || "—"}</TableCell>
                    <TableCell>
                      <Badge tone={c.is_searchable ? "success" : "neutral"}>
                        {c.is_searchable ? "yes" : "private"}
                      </Badge>
                    </TableCell>
                    <TableCell>{appCounts.get(uid) ?? 0}</TableCell>
                    <TableCell className="whitespace-nowrap text-slate-500">
                      {formatDateOnlyKarachi(c.created_at as string)}
                    </TableCell>
                    <TableCell>
                      <RevealCandidateButton candidateUserId={uid} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Suspense>
            <PaginationNav page={page} totalPages={totalPages} />
          </Suspense>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Privacy requests — retention queue</CardTitle></CardHeader>
        <CardContent>
          {(requestsRes.data ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">No open privacy requests.</p>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Requester</TableHeaderCell>
                  <TableHeaderCell>Type</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Opened</TableHeaderCell>
                  <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(requestsRes.data ?? []).map((r) => {
                  const profile = r.profile as { email?: string } | null;
                  return (
                    <TableRow key={r.id as string}>
                      <TableCell className="text-xs">{mask(profile?.email ?? null, 3)}</TableCell>
                      <TableCell><Badge tone="info">{r.type as string}</Badge></TableCell>
                      <TableCell>{r.status as string}</TableCell>
                      <TableCell className="whitespace-nowrap text-slate-500">
                        {formatDateOnlyKarachi(r.created_at as string)}
                      </TableCell>
                      <TableCell>
                        <PrivacyRequestDialog
                          requestId={r.id as string}
                          type={r.type as string}
                          email={profile?.email ?? "unknown"}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Requester emails are masked here too — reveal the candidate profile above if you need
            to contact them (logged).
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
