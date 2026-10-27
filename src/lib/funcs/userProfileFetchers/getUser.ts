import 'server-only';

import { getMainAccountProfile } from '@/lib/auth/account-service';

export async function getUser() {
  try {
    return await getMainAccountProfile();
  } catch {
    return undefined;
  }
}
