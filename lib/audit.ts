import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export interface AuditEvent {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  orgId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Append an entry to the immutable audit log.
 *
 * audit_logs is INSERT-only (no UPDATE/DELETE policies exist for anyone).
 * Always call from trusted server code after the action has succeeded.
 */
export async function writeAudit(event: AuditEvent): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("audit_logs").insert({
    actor_user_id: event.actorUserId,
    action: event.action,
    entity_type: event.entityType,
    entity_id: event.entityId,
    org_id: event.orgId ?? null,
    metadata: event.metadata ?? {},
  });
  if (error) {
    // Audit failures must be loud — never silently drop them.
    throw new Error(`Failed to write audit log: ${error.message}`);
  }
}
