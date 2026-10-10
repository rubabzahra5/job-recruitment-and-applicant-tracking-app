import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getOrgContext, NoOrganizationError } from "../../_lib/org";
import { NoOrgState } from "../../_components/NoOrgState";
import { DepartmentManager } from "../../_components/DepartmentManager";
import { getDepartmentsPageData, createDepartment, renameDepartment, deleteDepartment } from "./actions";

export const metadata: Metadata = { title: "Departments" };

export default async function DepartmentsPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const sp = await searchParams;
  let ctx;
  try {
    ctx = await getOrgContext(sp.org ?? null);
  } catch (e) {
    if (e instanceof NoOrganizationError) return <NoOrgState />;
    throw e;
  }
  if (!["org_admin", "hr_manager"].includes(ctx.role)) {
    redirect(`/employer?org=${encodeURIComponent(ctx.orgId)}`);
  }

  const departments = await getDepartmentsPageData(ctx.orgId);

  return (
    <main>
      <h1 className="text-2xl font-bold">Departments</h1>
      <p className="mt-1 text-sm text-slate-500">
        Organize vacancies and team members. A department cannot be deleted while jobs or members reference it.
      </p>
      <div className="mt-4">
        <DepartmentManager
          departments={departments}
          createAction={createDepartment.bind(null, ctx.orgId)}
          renameAction={renameDepartment.bind(null, ctx.orgId)}
          deleteAction={deleteDepartment.bind(null, ctx.orgId)}
        />
      </div>
    </main>
  );
}
