import { z } from 'zod';
import { MAX_PROFILE_PIC_SIZE } from '../auth/profile-limits';
import { emailSchema } from './auth-fields';

const text = (max: number) => z.string().trim().min(1).max(max).optional();

export const profileTextUpdateSchema = z
  .object({
    email: emailSchema.optional(),
    first_name: text(50),
    last_name: text(50),
    username: text(255),
    city: text(100),
    state: text(100),
    country: text(100),
    address: text(255),
    bio: text(1000),
    date_of_birth: z.iso.date().optional(),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/)
      .optional(),
    mobile_phone: z
      .string()
      .trim()
      .regex(/^\+[1-9]\d{1,14}$/)
      .optional(),
    gender: z.enum(['male', 'female']).optional(),
    website: z.string().trim().url().max(2048).optional(),
  })
  .strict();

export const profilePhotoSchema = z
  .instanceof(File)
  .refine(
    (file) =>
      file.size > 0 &&
      file.size <= MAX_PROFILE_PIC_SIZE &&
      /\.(?:jpe?g|png)$/i.test(file.name) &&
      ['image/jpeg', 'image/png'].includes(file.type),
    'Profile photo must be JPG or PNG, at most 900 KiB.',
  );
