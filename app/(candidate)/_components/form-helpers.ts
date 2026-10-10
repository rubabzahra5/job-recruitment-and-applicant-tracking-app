import type { FieldValues, Path, Resolver, UseFormSetError } from "react-hook-form";
import { zodResolver as baseZodResolver } from "@hookform/resolvers/zod";

export interface ActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * zodResolver typed with the schema's OUTPUT type.
 *
 * Schemas using z.preprocess (e.g. empty-string → undefined for optional
 * numbers) have an input type containing `unknown`, which doesn't match the
 * form's value type. At runtime the resolver validates the raw form values
 * and handleSubmit receives the parsed output, so casting to the output type
 * is sound.
 */
export function zodOutputResolver<TFieldValues extends FieldValues>(
  schema: { _zod: { output: TFieldValues; input: unknown } },
): Resolver<TFieldValues> {
  // @hookform/resolvers' zod4 overloads type the resolver with the schema's
  // INPUT type; cast through unknown so callers get the OUTPUT type instead.
  const make = baseZodResolver as unknown as (
    s: unknown,
  ) => Resolver<TFieldValues>;
  return make(schema);
}

/**
 * Flatten a ZodError into { fieldPath: firstMessage } using the issues list
 * directly (robust across zod 3/4 flatten() typing differences).
 */
export function zodFieldErrors(err: import("zod").ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/**
 * Apply a server-action result to a react-hook-form instance:
 * server-side field errors become field errors, the rest becomes a top-level
 * alert message. Returns true when the action succeeded.
 */
export function handleActionResult<T extends FieldValues>(
  result: ActionResult,
  setError: UseFormSetError<T>,
  setTopError: (msg: string | null) => void,
): boolean {
  if (result.ok) {
    setTopError(null);
    return true;
  }
  setTopError(result.error ?? "Something went wrong. Please try again.");
  if (result.fieldErrors) {
    for (const [field, message] of Object.entries(result.fieldErrors)) {
      setError(field as Path<T>, { type: "server", message });
    }
  }
  return false;
}
