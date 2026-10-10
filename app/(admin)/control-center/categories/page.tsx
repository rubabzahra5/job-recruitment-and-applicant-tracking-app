import type { Metadata } from "next";
import { AdminDeniedError, adminPageGuard } from "@/app/(admin)/_components/admin-server";
import { AdminDenied } from "@/app/(admin)/_components/AdminDenied";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";
import { CategoryDialog, DeleteCategoryButton } from "./CategoryDialogs";

export const metadata: Metadata = { title: "Control Center — Categories" };
export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  let admin;
  try {
    ({ admin } = await adminPageGuard("/control-center/categories"));
  } catch (e) {
    if (e instanceof AdminDeniedError) return <AdminDenied />;
    throw e;
  }
  const { data, error } = await admin
    .from("job_categories")
    .select("id,name,slug,icon")
    .order("name");
  if (error) throw new Error(`Failed to load categories: ${error.message}`);
  const rows = data ?? [];

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Job categories</h1>
          <p className="mt-1 text-sm text-slate-600">
            {rows.length} categories. Names and slugs must be unique.
          </p>
        </div>
        <CategoryDialog triggerLabel="New category" />
      </div>

      <Card>
        <CardHeader><CardTitle>All categories</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Slug</TableHeaderCell>
                <TableHeaderCell>Icon</TableHeaderCell>
                <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id as string}>
                  <TableCell className="font-medium">{c.name as string}</TableCell>
                  <TableCell className="font-mono text-xs">{c.slug as string}</TableCell>
                  <TableCell>{(c.icon as string) ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <CategoryDialog
                        triggerLabel="Edit"
                        initial={{
                          id: c.id as string,
                          name: c.name as string,
                          slug: c.slug as string,
                          icon: (c.icon as string) ?? null,
                        }}
                      />
                      <DeleteCategoryButton id={c.id as string} name={c.name as string} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
