const PG_PROTOCOLS = new Set(['postgres:', 'postgresql:']);
const SSL_MODE_ALIASES_WARNED_BY_PG = new Set(['prefer', 'require', 'verify-ca']);

export function normalizePostgresSslMode(connectionString: string) {
  try {
    const url = new URL(connectionString);
    if (!PG_PROTOCOLS.has(url.protocol)) return connectionString;

    const sslMode = url.searchParams.get('sslmode')?.toLowerCase();
    if (!sslMode || !SSL_MODE_ALIASES_WARNED_BY_PG.has(sslMode)) return connectionString;

    url.searchParams.set('sslmode', 'verify-full');
    return url.toString();
  } catch {
    return connectionString;
  }
}
