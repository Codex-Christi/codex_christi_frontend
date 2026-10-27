import { shouldUseSecureCookie } from '@/lib/session/session-cookies';

type ExpiredCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
  maxAge: 0;
  expires: Date;
};
type CookieWriter = {
  getAll(): Array<{ name: string; value: string }>;
  set(name: string, value: string, options: ExpiredCookieOptions): unknown;
};

const budgets = { access: 8, proof: 3 } as const;

/** Keep the current cookie and newest request entries. Also account for grants issued earlier
 * in this response, so recovering several orders cannot exceed the same browser budget. */
export function enforceCheckoutCookieBudget(
  writer: CookieWriter,
  request: Request,
  currentName: string,
  kind: keyof typeof budgets,
) {
  const prefix = `checkout-${kind}-`;
  if (!currentName.startsWith(prefix)) throw new Error('Invalid checkout cookie family.');
  const existing = new Map<string, string>();
  for (const entry of (request.headers.get('cookie') ?? '').split(';')) {
    const separator = entry.indexOf('=');
    if (separator > 0) existing.set(entry.slice(0, separator).trim(), entry.slice(separator + 1));
  }
  for (const cookie of writer.getAll()) {
    if (cookie.value) existing.set(cookie.name, cookie.value);
    else existing.delete(cookie.name);
  }
  const others = [...existing.keys()].filter(
    (name) => name !== currentName && name.startsWith(prefix),
  );
  for (const name of others.slice(0, Math.max(0, others.length - budgets[kind] + 1))) {
    writer.set(name, '', {
      httpOnly: true,
      secure: shouldUseSecureCookie(request.headers),
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
      expires: new Date(0),
    });
  }
}
