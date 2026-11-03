/**
 * True when a DB error is a Postgres unique violation (SQLSTATE 23505).
 *
 * drizzle-orm wraps driver errors in DrizzleQueryError ("Failed query: …") with the pg error
 * on `.cause`, so checking `error.code` / `error.message` alone misses real duplicates.
 * Note: inside a transaction a unique violation aborts it — prefer ON CONFLICT there.
 */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    const e = current as { code?: unknown; message?: unknown; cause?: unknown };
    if (e.code === '23505') return true;
    if (typeof e.message === 'string' && /duplicate key value violates unique constraint/i.test(e.message)) {
      return true;
    }
    current = e.cause;
  }
  return false;
}
