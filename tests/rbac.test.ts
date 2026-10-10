import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  AuthorizationError,
  getUserOrgRole,
  isSuperAdmin,
  requireOrgMembership,
  requireOrgRole,
  requireSuperAdmin,
} from "@/lib/rbac";

/**
 * RBAC logic tests with a mocked Supabase admin client.
 * The real lib/rbac.ts always reads user_roles + organization_memberships via
 * the service-role client; here we replace createAdminClient() with an
 * in-memory chainable fake so no database is needed.
 */

type Row = Record<string, unknown>;

// lib/rbac.ts imports "server-only", which refuses to load outside a server
// context (it throws under jsdom). Neutralize it for these unit tests — the
// module under test is still the real lib/rbac.ts.
vi.mock("server-only", () => ({}));

// vi.mock factories are hoisted above imports: the mutable admin holder must
// be created with vi.hoisted().
const mocks = vi.hoisted(() => ({ holder: { admin: null as unknown } }));
const holder = mocks.holder;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mocks.holder.admin,
}));

function makeAdmin(rows: Record<string, Row[]>) {
  return {
    from(table: string) {
      const tableRows = rows[table] ?? [];
      const filters: Array<(r: Row) => boolean> = [];
      const builder: Record<string, unknown> = {
        select(_cols: string) {
          return builder;
        },
        eq(col: string, val: unknown) {
          filters.push((r) => r[col] === val);
          return builder;
        },
        maybeSingle() {
          const found = tableRows.filter((r) => filters.every((f) => f(r)));
          return { data: found[0] ?? null, error: null };
        },
        single() {
          const found = tableRows.filter((r) => filters.every((f) => f(r)));
          return found[0]
            ? { data: found[0], error: null }
            : { data: null, error: { message: "No rows" } };
        },
        then(resolve: (v: unknown) => void) {
          resolve({
            data: tableRows.filter((r) => filters.every((f) => f(r))),
            error: null,
          });
        },
      };
      return builder;
    },
  };
}

const ORG = "org-1";

function seed(opts: {
  roles?: Array<{ role: string; org_id: string | null }>;
  activeMembership?: boolean;
}) {
  const roles = (opts.roles ?? []).map((r) => ({ ...r, user_id: "user-1" }));
  const memberships =
    opts.activeMembership === false
      ? []
      : [{ user_id: "user-1", org_id: ORG, is_active: true, id: "m-1" }];
  holder.admin = makeAdmin({ user_roles: roles, organization_memberships: memberships });
}

beforeEach(() => {
  holder.admin = null;
});

describe("requireOrgRole", () => {
  it("grants when the user holds an allowed role with an active membership", async () => {
    seed({ roles: [{ role: "recruiter", org_id: ORG }] });
    await expect(
      requireOrgRole("user-1", ORG, { atLeast: "recruiter" }),
    ).resolves.toBe("recruiter");
  });

  it("grants atLeast checks by rank (hr_manager satisfies atLeast recruiter)", async () => {
    seed({ roles: [{ role: "hr_manager", org_id: ORG }] });
    await expect(
      requireOrgRole("user-1", ORG, { atLeast: "recruiter" }),
    ).resolves.toBe("hr_manager");
  });

  it("denies when the role rank is too low", async () => {
    seed({ roles: [{ role: "employee", org_id: ORG }] });
    await expect(
      requireOrgRole("user-1", ORG, { atLeast: "recruiter" }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("denies list-based checks for unlisted roles", async () => {
    seed({ roles: [{ role: "hr_manager", org_id: ORG }] });
    await expect(
      requireOrgRole("user-1", ORG, ["org_admin"]),
    ).rejects.toThrow(/Insufficient role/);
    await expect(
      requireOrgRole("user-1", ORG, ["org_admin", "hr_manager"]),
    ).resolves.toBe("hr_manager");
  });

  it("denies when the membership is inactive (roles alone are not enough)", async () => {
    seed({ roles: [{ role: "org_admin", org_id: ORG }], activeMembership: false });
    await expect(requireOrgRole("user-1", ORG, ["org_admin"])).rejects.toThrow(
      /membership required/i,
    );
  });

  it("denies when there is no role grant at all", async () => {
    seed({});
    await expect(
      requireOrgRole("user-1", ORG, { atLeast: "employee" }),
    ).rejects.toThrow(/membership required/i);
  });

  it("lets super admins pass through without a membership", async () => {
    seed({ roles: [{ role: "super_admin", org_id: null }], activeMembership: false });
    await expect(
      requireOrgRole("user-1", ORG, { atLeast: "org_admin" }),
    ).resolves.toBe("org_admin");
  });
});

describe("getUserOrgRole", () => {
  it("returns null without an active membership even when a grant exists", async () => {
    seed({ roles: [{ role: "recruiter", org_id: ORG }], activeMembership: false });
    await expect(getUserOrgRole("user-1", ORG)).resolves.toBeNull();
  });

  it("picks the highest-ranked grant when several exist", async () => {
    seed({
      roles: [
        { role: "employee", org_id: ORG },
        { role: "recruiter", org_id: ORG },
      ],
    });
    await expect(getUserOrgRole("user-1", ORG)).resolves.toBe("recruiter");
  });

  it("ignores grants for other orgs", async () => {
    seed({ roles: [{ role: "org_admin", org_id: "org-2" }] });
    await expect(getUserOrgRole("user-1", ORG)).resolves.toBeNull();
  });

  it("ignores non-org (global) grants", async () => {
    seed({ roles: [{ role: "candidate", org_id: null }] });
    await expect(getUserOrgRole("user-1", ORG)).resolves.toBeNull();
  });
});

describe("super_admin checks", () => {
  it("recognizes a platform-wide super_admin grant (org_id null)", async () => {
    seed({ roles: [{ role: "super_admin", org_id: null }] });
    await expect(isSuperAdmin("user-1")).resolves.toBe(true);
    await expect(requireSuperAdmin("user-1")).resolves.toBeUndefined();
  });

  it("does not treat an org-scoped super_admin grant as platform admin", async () => {
    seed({ roles: [{ role: "super_admin", org_id: ORG }] });
    await expect(isSuperAdmin("user-1")).resolves.toBe(false);
    await expect(requireSuperAdmin("user-1")).rejects.toThrow(AuthorizationError);
  });

  it("denies ordinary users", async () => {
    seed({ roles: [{ role: "candidate", org_id: null }] });
    await expect(requireSuperAdmin("user-1")).rejects.toThrow(/Super-admin access required/);
  });
});

describe("requireOrgMembership", () => {
  it("passes with an active membership (any role)", async () => {
    seed({ roles: [{ role: "employee", org_id: ORG }] });
    await expect(requireOrgMembership("user-1", ORG)).resolves.toBeUndefined();
  });

  it("lets super admins through without membership", async () => {
    seed({ roles: [{ role: "super_admin", org_id: null }], activeMembership: false });
    await expect(requireOrgMembership("user-1", ORG)).resolves.toBeUndefined();
  });

  it("denies when the membership is inactive", async () => {
    seed({ roles: [{ role: "recruiter", org_id: ORG }], activeMembership: false });
    await expect(requireOrgMembership("user-1", ORG)).rejects.toThrow(AuthorizationError);
  });
});
