/**
 * Hiring-pipeline stage-transition model.
 *
 * Data model (supabase/migrations/0006_config.sql):
 *   pipeline_stages(id, key, label, sort_order, is_terminal)
 *   pipeline_transitions(id, from_stage FK, to_stage FK, UNIQUE(from_stage, to_stage))
 *
 * Rules enforced here AND by the `validate_application_stage_transition`
 * trigger on `applications` (so direct SQL writes are safe too):
 * - A transition from→to is allowed only if a row exists in pipeline_transitions.
 * - No transitions OUT of a terminal stage (hired, rejected, withdrawn, offer_declined).
 * - Candidates may move their own application to `withdrawn` only.
 *
 * Later agents: load the transition list once per request with
 * `loadPipelineTransitions()` (or pass rows you already fetched) and validate
 * with `assertValidTransition()` before updating `applications.stage`.
 */

export interface PipelineStage {
  id: string;
  key: string;
  label: string;
  sort_order: number;
  is_terminal: boolean;
}

export interface PipelineTransition {
  from_stage: string;
  to_stage: string;
  from_key: string;
  to_key: string;
}

/** Minimal Supabase-like client surface needed to load the pipeline. */
export interface PipelineLoader {
  from(table: string): {
    select(columns: string): Promise<{ data: unknown; error: { message: string } | null }>;
  };
}

/** Fetch stages + transitions from the database. */
export async function loadPipeline(client: PipelineLoader): Promise<{
  stages: PipelineStage[];
  transitions: PipelineTransition[];
}> {
  const [stagesRes, transitionsRes] = await Promise.all([
    client.from("pipeline_stages").select("id,key,label,sort_order,is_terminal"),
    client.from("pipeline_transitions").select(
      "from_stage,to_stage,from:pipeline_stages!pipeline_transitions_from_stage_fkey(key),to:pipeline_stages!pipeline_transitions_to_stage_fkey(key)",
    ),
  ]);
  if (stagesRes.error) throw new Error(`Failed to load pipeline stages: ${stagesRes.error.message}`);
  if (transitionsRes.error) {
    throw new Error(`Failed to load pipeline transitions: ${transitionsRes.error.message}`);
  }
  const stages = (stagesRes.data ?? []) as PipelineStage[];
  const transitions = ((transitionsRes.data ?? []) as Array<{
    from_stage: string;
    to_stage: string;
    from: { key: string } | null;
    to: { key: string } | null;
  }>).map((t) => ({
    from_stage: t.from_stage,
    to_stage: t.to_stage,
    from_key: t.from?.key ?? "",
    to_key: t.to?.key ?? "",
  }));
  return { stages, transitions };
}

/** Stage keys a given stage may move to. */
export function allowedNextStages(
  fromKey: string,
  transitions: PipelineTransition[],
): string[] {
  return transitions.filter((t) => t.from_key === fromKey).map((t) => t.to_key);
}

export function isTerminalStage(key: string, stages: PipelineStage[]): boolean {
  return stages.some((s) => s.key === key && s.is_terminal);
}

/** Pure check: is from→to an allowed transition (and `from` not terminal)? */
export function isValidTransition(
  fromKey: string,
  toKey: string,
  stages: PipelineStage[],
  transitions: PipelineTransition[],
): boolean {
  if (fromKey === toKey) return true; // no-op updates are harmless
  if (isTerminalStage(fromKey, stages)) return false;
  return transitions.some((t) => t.from_key === fromKey && t.to_key === toKey);
}

export class InvalidTransitionError extends Error {
  constructor(fromKey: string, toKey: string) {
    super(`Invalid pipeline transition: "${fromKey}" → "${toKey}".`);
    this.name = "InvalidTransitionError";
  }
}

/** Throw InvalidTransitionError unless the move is allowed. */
export function assertValidTransition(
  fromKey: string,
  toKey: string,
  stages: PipelineStage[],
  transitions: PipelineTransition[],
): void {
  if (!isValidTransition(fromKey, toKey, stages, transitions)) {
    throw new InvalidTransitionError(fromKey, toKey);
  }
}
