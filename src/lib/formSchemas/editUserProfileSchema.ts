import { profileTextUpdateSchema, profilePhotoSchema } from './profile-fields';

export const PatchUserProfileSchema = profileTextUpdateSchema
  .extend({
    profile_pic: profilePhotoSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Make a change before saving.');
