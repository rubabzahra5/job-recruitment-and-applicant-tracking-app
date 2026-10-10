import type { Metadata } from "next";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getOrgContext, NoOrganizationError } from "../../_lib/org";
import { NoOrgState } from "../../_components/NoOrgState";
import { OrgProfileForm, OrgLogoUpload } from "../../_components/OrgProfileForm";
import { getOrgProfile, updateOrgProfile, uploadOrgLogo } from "./actions";

export const metadata: Metadata = { title: "Organization profile" };

export default async function OrgProfilePage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const sp = await searchParams;
  let ctx;
  try {
    ctx = await getOrgContext(sp.org ?? null);
  } catch (e) {
    if (e instanceof NoOrganizationError) return <NoOrgState />;
    throw e;
  }
  const canEdit = ctx.role === "org_admin";
  const profile = await getOrgProfile(ctx.orgId);

  return (
    <main>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Organization profile</h1>
        <Badge tone={profile.verificationStatus === "verified" ? "success" : "neutral"}>
          {profile.verificationStatus}
        </Badge>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Logo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {profile.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.logoUrl} alt={`${profile.name} logo`} className="h-16 w-16 rounded border border-slate-200 object-contain" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded border border-dashed border-slate-300 text-xs text-slate-400">
                No logo
              </div>
            )}
            {canEdit && <OrgLogoUpload uploadAction={uploadOrgLogo.bind(null, ctx.orgId)} />}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          {canEdit ? (
            <OrgProfileForm initial={profile} saveAction={updateOrgProfile.bind(null, ctx.orgId)} />
          ) : (
            <dl className="grid gap-x-6 gap-y-2 text-sm md:grid-cols-2">
              <div><dt className="text-slate-500">Name</dt><dd className="font-medium">{profile.name}</dd></div>
              <div><dt className="text-slate-500">Industry</dt><dd className="font-medium">{profile.industry ?? "—"}</dd></div>
              <div className="md:col-span-2"><dt className="text-slate-500">About</dt><dd className="whitespace-pre-wrap">{profile.about ?? "—"}</dd></div>
              <div><dt className="text-slate-500">Website</dt><dd className="font-medium">{profile.website ?? "—"}</dd></div>
              <div><dt className="text-slate-500">Company size</dt><dd className="font-medium">{profile.sizeRange ?? "—"}</dd></div>
              <div><dt className="text-slate-500">Contact email</dt><dd className="font-medium">{profile.contactEmail ?? "—"}</dd></div>
              <div><dt className="text-slate-500">Contact phone</dt><dd className="font-medium">{profile.contactPhone ?? "—"}</dd></div>
              <div className="md:col-span-2"><dt className="text-slate-500">Office locations</dt><dd className="font-medium">{profile.locations.join(", ") || "—"}</dd></div>
            </dl>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
