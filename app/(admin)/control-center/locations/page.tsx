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
import { DeleteLocationButton, LocationDialog } from "./LocationDialogs";

export const metadata: Metadata = { title: "Control Center — Locations" };
export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  let admin;
  try {
    ({ admin } = await adminPageGuard("/control-center/locations"));
  } catch (e) {
    if (e instanceof AdminDeniedError) return <AdminDenied />;
    throw e;
  }
  const { data, error } = await admin
    .from("locations")
    .select("id,city,province,country")
    .order("province")
    .order("city");
  if (error) throw new Error(`Failed to load locations: ${error.message}`);
  const rows = data ?? [];

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Locations</h1>
          <p className="mt-1 text-sm text-slate-600">
            {rows.length} locations. City + province must be unique; provinces are limited to
            Pakistan&apos;s provinces/territories by the database CHECK.
          </p>
        </div>
        <LocationDialog triggerLabel="New location" />
      </div>

      <Card>
        <CardHeader><CardTitle>All locations</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>City</TableHeaderCell>
                <TableHeaderCell>Province / territory</TableHeaderCell>
                <TableHeaderCell>Country</TableHeaderCell>
                <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((l) => (
                <TableRow key={l.id as string}>
                  <TableCell className="font-medium">{l.city as string}</TableCell>
                  <TableCell>{l.province as string}</TableCell>
                  <TableCell>{l.country as string}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <LocationDialog
                        triggerLabel="Edit"
                        initial={{
                          id: l.id as string,
                          city: l.city as string,
                          province: l.province as string,
                          country: l.country as string,
                        }}
                      />
                      <DeleteLocationButton
                        id={l.id as string}
                        label={`${l.city as string}, ${l.province as string}`}
                      />
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
