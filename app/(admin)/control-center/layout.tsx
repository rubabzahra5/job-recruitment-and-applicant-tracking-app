import { AdminShell } from "@/app/(admin)/_components/AdminShell";

/**
 * Admin route group (/control-center/*).
 *
 * Rendered chrome: a dark, visually distinct sidebar nav (all 17 sections),
 * hidden on /control-center/login.
 *
 * Security: middleware redirects unauthenticated visitors, but authorization
 * happens SERVER-SIDE in every page, server action and route handler via
 * adminContext() / adminPageGuard() (lib/rbac.ts requireSuperAdmin against
 * user_roles, verified fresh on each request). Middleware is redirect-only.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
