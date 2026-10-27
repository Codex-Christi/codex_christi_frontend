import { createHash } from 'node:crypto';

const buckets = new Map<string, { count: number; expires: number }>();

export function allowAuthAttempt(
  scope: string,
  identity: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
) {
  const key = createHash('sha256').update(`${scope}:${identity}`).digest('hex');
  for (const [id, value] of buckets) if (value.expires <= now) buckets.delete(id);
  let bucket = buckets.get(key);
  if (!bucket) {
    if (buckets.size >= 5000) return false;
    bucket = { count: 0, expires: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  return bucket.count <= limit;
}
