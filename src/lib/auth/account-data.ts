import { z } from 'zod';
import type { UserProfileDataInterface } from '../types/user-profile/main-user-profile';
import type { IUserShopProfile } from '../types/user-shop-interface';

const optionalText = z.string().nullable().optional();
const profile = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  first_name: optionalText,
  last_name: optionalText,
  profile_pic: optionalText,
  username: optionalText,
  city: optionalText,
  state: optionalText,
  country: optionalText,
  address: optionalText,
  bio: optionalText,
  date_of_birth: optionalText,
  age: z.number().nullable().optional(),
  currency: optionalText,
  mobile_phone: optionalText,
  date_created: optionalText,
  date_updated: optionalText,
  gender: optionalText,
  website: optionalText,
});

const profileEnvelope = z.object({ success: z.literal(true), data: profile });

export function readProfileData(payload: unknown, userID: string): UserProfileDataInterface {
  const result = profileEnvelope.parse(payload).data;
  if (result.id !== userID) throw new Error('Profile identity mismatch.');
  return Object.fromEntries(
    Object.entries(result).filter(([, value]) => value !== null),
  ) as UserProfileDataInterface;
}

const shopProfileEnvelope = z.object({
  success: z.literal(true),
  status: z.number(),
  message: z.string(),
  data: z.object({
    first_name: z.string(),
    last_name: z.string(),
    bio: z
      .string()
      .nullable()
      .transform((v) => v ?? ''),
    profile_pic: z
      .string()
      .nullable()
      .transform((v) => v ?? ''),
    username: z.string(),
    shipping_address: z.string().nullable(),
    shipping_city: z.string().nullable(),
    shipping_state: z.string().nullable(),
    shipping_country: z.string().nullable(),
  }),
});

export function readShopProfileData(payload: unknown): IUserShopProfile {
  return shopProfileEnvelope.parse(payload);
}
