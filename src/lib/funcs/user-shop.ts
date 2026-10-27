import 'server-only';

import { getShopAccountProfile } from '@/lib/auth/account-service';

export async function fetchUserShopProfile() {
  try {
    return await getShopAccountProfile();
  } catch {
    return null;
  }
}
