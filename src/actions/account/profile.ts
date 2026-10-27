'use server';

import { type AccountResult } from '@/lib/auth/errors';
import { accountActionFailure } from '@/lib/auth/account-diagnostics';
import { profileUpdateForm, shippingAddressPayload } from '@/lib/auth/account-validation';
import { readShopProfileData } from '@/lib/auth/account-data';
import {
  getMainAccountProfile,
  getShopAccountProfile,
  requestAccountData,
  readCurrentProfileData,
} from '@/lib/auth/account-service';
import type { UserProfileDataInterface } from '@/lib/types/user-profile/main-user-profile';
import type { IUserShopProfile } from '@/lib/types/user-shop-interface';

export async function readMyProfile(): Promise<AccountResult<UserProfileDataInterface>> {
  try {
    return { success: true, data: await getMainAccountProfile({ writable: true }) };
  } catch (error) {
    return accountActionFailure('read-profile', error);
  }
}
export async function readMyShopProfile(): Promise<AccountResult<IUserShopProfile>> {
  try {
    return { success: true, data: await getShopAccountProfile({ writable: true }) };
  } catch (error) {
    return accountActionFailure('read-shop-profile', error);
  }
}
export async function updateMyProfile(
  input: FormData,
): Promise<AccountResult<UserProfileDataInterface>> {
  let body: FormData;
  try {
    body = await profileUpdateForm(input);
  } catch {
    return {
      success: false,
      code: 'invalid_input',
      error: 'Check the profile fields. Photos must be JPG or PNG and at most 900 KiB.',
    };
  }
  try {
    return {
      success: true,
      data: await requestAccountData(
        '/account/my-profile-update',
        readCurrentProfileData,
        { method: 'PATCH', body },
        { writable: true, retryUnauthorized: true },
      ),
    };
  } catch (error) {
    return accountActionFailure('update-profile', error);
  }
}
export async function updateMyShippingAddress(
  input: unknown,
): Promise<AccountResult<IUserShopProfile>> {
  let address;
  try {
    address = shippingAddressPayload(input);
  } catch {
    return {
      success: false,
      code: 'invalid_input',
      error: 'Check the address and choose a valid country.',
    };
  }
  try {
    return {
      success: true,
      data: await requestAccountData(
        '/shop/shop-profile-update',
        readShopProfileData,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(address),
        },
        { writable: true, retryUnauthorized: true },
      ),
    };
  } catch (error) {
    return accountActionFailure('update-shipping-address', error);
  }
}
