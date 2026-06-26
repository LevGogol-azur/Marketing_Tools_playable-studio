// Narrow an unknown thrown value to a human-readable message.
// Under `strict`, a `catch` binding is `unknown`, so this keeps call sites
// type-safe without resorting to `any` or suppression directives.
export function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
