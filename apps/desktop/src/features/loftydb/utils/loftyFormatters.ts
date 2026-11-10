/**
 * Shared formatting and LoftyDB document helpers used across LoftyDB Studio & Graph views.
 */

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Converts a Unix nanosecond string or valid ISO date/time into a nanosecond query parameter.
 */
export function resolveAsOfNanoseconds(rawInput: string): string | undefined {
  const raw = rawInput.trim();
  if (!raw) return undefined;
  if (/^\d{13,}$/.test(raw)) return raw;
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) {
    throw new Error('AS OF must be a Unix nanosecond timestamp or valid ISO date/time.');
  }
  return (BigInt(ms) * 1_000_000n).toString();
}

/**
 * Clones a LoftyDB document while omitting large vector embeddings and optional internal metadata keys.
 */
export function stripDocumentMeta<T extends Record<string, unknown>>(
  doc: T,
  extraKeys: string[] = []
): Record<string, unknown> {
  const clean: Record<string, unknown> = { ...doc };
  delete clean._vector;
  for (const key of extraKeys) {
    delete clean[key];
  }
  return clean;
}
