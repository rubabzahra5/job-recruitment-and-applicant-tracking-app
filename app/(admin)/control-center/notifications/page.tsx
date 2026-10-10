import type { Metadata } from "next";
import { Suspense } from "react";
import {
  AdminDeniedError,
  adminPageGuard,
  firstParam,
  getPagination,
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
import { Tabs } from "@/components/ui/Tabs";
import { isEmailConfigured } from "@/lib/env";
import { formatDateKarachi } from "@/lib/format";
import {
  DeleteTemplateButton,
  RetryDeliveryButton,
  TemplateDialog,
} from "./NotificationDialogs";

export const metadata: Metadata = { title: "Control Center — Notifications" };
export const dynamic = "force-dynamic";

const DELIVERY_TONES: Record<string, "neutral" | "info" | "success" | "warning" | "danger"> = {
  queued: "warning",
  sent: "success",
  failed: "danger",
  skipped: "neutral",
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  let admin;
  try {
    ({ admin } = await adminPageGuard("/control-center/notifications"));
  } catch (e) {
    if (e instanceof AdminDeniedError) return <AdminDenied />;
    throw e;
  }
  const { page, perPage, from, to } = getPagination(params, 20);
  const channel = firstParam(params.channel) ?? "";
  const status = firstParam(params.status) ?? "";
  const q = (firstParam(params.q) ?? "").trim();

  const [templatesRes, emailOk] = await Promise.all([
    admin.from("email_templates").select("id,key,subject,body,updated_at").order("key"),
    (async () => {
      try {
        return isEmailConfigured();
      } catch {
        return false;
      }
    })(),
  ]);

  let logsQuery = admin
    .from("notification_delivery_logs")
    .select("id,channel,status,attempted_at,provider_response,notification:notifications(title)", {
      count: "exact",
    })
    .order("attempted_at", { ascending: false });
  if (channel) logsQuery = logsQuery.eq("channel", channel);
  if (status) logsQuery = logsQuery.eq("status", status);
  const logsRes = await logsQuery.range(from, to);
  if (logsRes.error) throw new Error(`Failed to load delivery logs: ${logsRes.error.message}`);
  const logs = logsRes.data ?? [];
  const totalPages = Math.max(1, Math.ceil((logsRes.count ?? 0) / perPage));

  let notifQuery = admin
    .from("notifications")
    .select("id,type,title,body,is_read,created_at,user:profiles!notifications_user_id_fkey(email)", {
      count: "exact",
    })
    .order("created_at", { ascending: false });
  if (q) notifQuery = notifQuery.or(`title.ilike.%${q}%,type.ilike.%${q}%`);
  const notifsRes = await notifQuery.range(0, 19);

  const templates = templatesRes.data ?? [];
  const notifs = notifsRes.data ?? [];

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="mt-1 text-sm text-slate-600">
          Email templates, delivery logs and the in-app notification stream.
        </p>
      </div>

      {!emailOk && (
        <Alert tone="warning" title="Email unconfigured">
          RESEND_API_KEY / EMAIL_FROM_ADDRESS are missing. Delivery retries will be refused
          honestly (nothing will claim a send), and template edits are stored but unsendable.
        </Alert>
      )}

      <Tabs
        ariaLabel="Notification sections"
        tabs={[
          {
            id: "templates",
            label: `Email templates (${templates.length})`,
            content: (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Templates</CardTitle>
                    <TemplateDialog triggerLabel="New template" />
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>Key</TableHeaderCell>
                        <TableHeaderCell>Subject</TableHeaderCell>
                        <TableHeaderCell>Updated</TableHeaderCell>
                        <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {templates.map((t) => (
                        <TableRow key={t.id as string}>
                          <TableCell className="font-mono text-xs">{t.key as string}</TableCell>
                          <TableCell>{t.subject as string}</TableCell>
                          <TableCell className="whitespace-nowrap text-slate-500">
                            {formatDateKarachi(t.updated_at as string)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <TemplateDialog
                                triggerLabel="Edit"
                                initial={{
                                  id: t.id as string,
                                  key: t.key as string,
                                  subject: t.subject as string,
                                  body: t.body as string,
                                }}
                              />
                              <DeleteTemplateButton id={t.id as string} templateKey={t.key as string} />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ),
          },
          {
            id: "deliveries",
            label: "Delivery logs",
            content: (
              <div className="space-y-4">
                <Card>
                  <CardContent className="pt-4">
                    <Suspense>
                      <FilterBar
                        fields={[
                          {
                            key: "channel",
                            label: "Channel",
                            type: "select",
                            options: ["in_app", "email", "sms"].map((c) => ({ value: c, label: c })),
                          },
                          {
                            key: "status",
                            label: "Status",
                            type: "select",
                            options: ["queued", "sent", "failed", "skipped"].map((s) => ({ value: s, label: s })),
                          },
                        ]}
                      />
                    </Suspense>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Delivery attempts</CardTitle></CardHeader>
                  <CardContent>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableHeaderCell>Notification</TableHeaderCell>
                          <TableHeaderCell>Channel</TableHeaderCell>
                          <TableHeaderCell>Status</TableHeaderCell>
                          <TableHeaderCell>Attempted (PKT)</TableHeaderCell>
                          <TableHeaderCell>Provider response</TableHeaderCell>
                          <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {logs.map((l) => {
                          const n = l.notification as { title?: string } | null;
                          const st = l.status as string;
                          return (
                            <TableRow key={l.id as string}>
                              <TableCell>{n?.title ?? "—"}</TableCell>
                              <TableCell><Badge tone="neutral">{l.channel as string}</Badge></TableCell>
                              <TableCell>
                                <Badge tone={DELIVERY_TONES[st] ?? "neutral"}>{st}</Badge>
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-xs text-slate-500">
                                {formatDateKarachi(l.attempted_at as string)}
                              </TableCell>
                              <TableCell className="max-w-64 truncate font-mono text-[11px] text-slate-500" title={(l.provider_response as string) ?? ""}>
                                {(l.provider_response as string) ?? "—"}
                              </TableCell>
                              <TableCell>
                                {st === "failed" && <RetryDeliveryButton logId={l.id as string} />}
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
              </div>
            ),
          },
          {
            id: "inapp",
            label: "In-app notifications",
            content: (
              <Card>
                <CardHeader><CardTitle>In-app stream (latest 20)</CardTitle></CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <Suspense>
                      <FilterBar
                        fields={[{ key: "q", label: "Search title/type", type: "search", placeholder: "application…" }]}
                      />
                    </Suspense>
                  </div>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>Recipient</TableHeaderCell>
                        <TableHeaderCell>Type</TableHeaderCell>
                        <TableHeaderCell>Title</TableHeaderCell>
                        <TableHeaderCell>Read</TableHeaderCell>
                        <TableHeaderCell>Created</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {notifs.map((n) => {
                        const u = n.user as { email?: string } | null;
                        return (
                          <TableRow key={n.id as string}>
                            <TableCell className="text-xs">{u?.email ?? "—"}</TableCell>
                            <TableCell className="font-mono text-xs">{n.type as string}</TableCell>
                            <TableCell>{n.title as string}</TableCell>
                            <TableCell>
                              <Badge tone={n.is_read ? "neutral" : "info"}>
                                {n.is_read ? "read" : "unread"}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-slate-500">
                              {formatDateKarachi(n.created_at as string)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ),
          },
        ]}
      />
    </main>
  );
}
