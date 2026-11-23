import 'server-only';
import { getPublicRuntimeConfig } from '../../../../scripts/runtime-config.mjs';

export const dynamic = 'force-dynamic';

export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    // Reading the environment inside this request keeps the Docker image independent
    // of deployment configuration, including legacy NEXT_PUBLIC_* assignments.
    return Response.json(getPublicRuntimeConfig(process.env), { headers });
  } catch {
    // Do not log or return validation details: runtime values may be confidential.
    return Response.json({ status: 'unavailable' }, { status: 503, headers });
  }
}
