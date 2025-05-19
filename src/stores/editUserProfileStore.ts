// EditUserProfileStore.ts
import { create } from 'zustand';
import { UserProfileDataInterface } from '@/lib/types/user-profile/main-user-profile';
import { getUpdatedKeys } from '@/lib/utils/getUpdatedObjKeys';
import { useUserMainProfileStore } from './userMainProfileStore';
import { PatchUserProfileSchema } from '@/lib/formSchemas/editUserProfileSchema';
import { ZodError } from 'zod';

// Types
type UserEditProfileStoreType = {
  userEditData: UserProfileDataInterface | null;
  setUserEditData: (userEditData: UserProfileDataInterface | null) => void;
  fieldErrors: Record<string, string> | null;
  setFieldErrors: (fieldErrors: Record<string, string> | null) => void;
  //   validateUserEditData: (currentEditData: Partial<UserProfileDataInterface>) =>
  //     | {
  //         success: true;
  //         data: UserProfileDataInterface;
  //       }
  //     | { success: false; errors: Record<string, string> };
};

// Store for user edit profile data
export const useEditUserMainProfileStore = create<UserEditProfileStoreType>(
  (set, get) => ({
    userEditData: null,
    fieldErrors: null,
    // Set the user edit data
    setUserEditData: (userEditProfileState: UserProfileDataInterface | null) =>
      set((state) => ({
        ...state,
        userEditData: userEditProfileState,
        fieldErrors: null,
      })),
    setFieldErrors: (fieldErrors: Record<string, string> | null) =>
      set((state) => ({ ...state, fieldErrors: fieldErrors })),

    // Clear the user edit data
    cleaEditData: () => set({ userEditData: null, fieldErrors: null }),
  })
);

export const validateUserEditData = (
  currentEditData: Partial<UserProfileDataInterface>
) => {
  const result = PatchUserProfileSchema.safeParse(currentEditData);

  //   If validation passes, set the fieldErrors to null
  if (result.success) {
    //   Return the validated data
    return {
      success: true as const,
      data: result.data as unknown as UserProfileDataInterface,
    };
  }

  //   If validation fails, map the errors to a fieldErrors object
  const fieldErrors: Record<string, string> = {};
  for (const issue of (result.error as ZodError).issues) {
    const key = issue.path[0] as string;
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  //   Return the errors
  return { success: false as const, errors: fieldErrors };
};

// Hook to submit the user edit data
export const useSubmitEditData = () => {
  const userEditData = useEditUserMainProfileStore(
    (state) => state.userEditData
  );
  const userMainProfile = useUserMainProfileStore(
    (state) => state.userMainProfile
  );

  const diffData =
    userMainProfile && userEditData
      ? getUpdatedKeys(userMainProfile, userEditData)
      : null;

  return {
    diffData,
  };
};
