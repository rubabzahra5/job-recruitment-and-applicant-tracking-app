import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { formatDateOnlyKarachi } from "@/lib/format";
import { getOrgContext, NoOrganizationError } from "../../../_lib/org";
import { NoOrgState } from "../../../_components/NoOrgState";
import { EmployeeSubNav } from "../../../_components/EmployeeSubNav";
import { EmployeeDocDownload } from "../../../_components/EmployeeForms";
import { getEmployeeDocuments, getEmployeeDocumentUrl, requireEmployeePortal } from "../actions";

export const metadata: Metadata = { title: "My documents" };

export default async function EmployeeDocumentsPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const sp = await searchParams;
  let ctx;
  try {
    ctx = await getOrgContext(sp.org ?? null);
  } catch (e) {
    if (e instanceof NoOrganizationError) return <NoOrgState />;
    throw e;
  }
  await requireEmployeePortal(ctx.orgId);
  const docs = await getEmployeeDocuments(ctx.orgId);

  return (
    <main>
      <h1 className="text-2xl font-bold">My documents</h1>
      <p className="mt-1 text-sm text-slate-500">Documents you have uploaded to Job Recruitment And Applicant Tracking System (e.g. your CV).</p>
      <div className="mt-4">
        <EmployeeSubNav orgId={ctx.orgId} current="/documents" />
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Uploaded documents</CardTitle>
        </CardHeader>
        <CardContent>
          {docs.length === 0 ? (
            <EmptyState title="No documents" description="You haven't uploaded any documents yet." />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>File</TableHeaderCell>
                  <TableHeaderCell>Type</TableHeaderCell>
                  <TableHeaderCell>Size</TableHeaderCell>
                  <TableHeaderCell>Uploaded</TableHeaderCell>
                  <TableHeaderCell>Download</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {docs.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.fileName}</TableCell>
                    <TableCell>{d.kind}</TableCell>
                    <TableCell>{Math.round(d.sizeBytes / 1024)} KB</TableCell>
                    <TableCell>{formatDateOnlyKarachi(d.createdAt)}</TableCell>
                    <TableCell>
                      <EmployeeDocDownload documentId={d.id} getUrl={getEmployeeDocumentUrl.bind(null, ctx.orgId)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
