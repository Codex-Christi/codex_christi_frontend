// EditUserProfileStore.ts
import { create } from 'zustand';
import { UserProfileDataInterface } from '@/lib/types/user-profile/main-user-profile';
import { getUpdatedKeys } from '@/lib/utils/getUpdatedObjKeys';
import { useUserMainProfileStore } from './userMainProfileStore';
import { PatchUserProfileSchema } from '@/lib/formSchemas/editUserProfileSchema';
import { ZodError } from 'zod';
import { useCallback, useMemo } from 'react';

// Types
type UserEditProfileStoreType = {
  userEditData: UserProfileDataInterface | null;
  setUserEditData: (userEditData: UserProfileDataInterface | null) => void;
  fieldErrors: Record<string, string> | null;
  setFieldErrors: (fieldErrors: Record<string, string> | null) => void;
  clearEditData: () => void;
};

// Store for user edit profile data
export const useEditUserMainProfileStore = create<UserEditProfileStoreType>(
  (set) => ({
    userEditData: null,
    fieldErrors: null,
    // Set the user edit data
    setUserEditData: (userEditProfileState: UserProfileDataInterface | null) =>
      set((state) => ({
        ...state,
        userEditData: userEditProfileState,
        fieldErrors: null,
      })),
    setFieldErrors: (fieldErrors: Record<string, string> | null) => fieldErrors,

    // Clear the user edit data
    clearEditData: () => set({ userEditData: null, fieldErrors: null }),
  })
);

export const useValidateUserEditData = () => {
  // Hooks
  const currentEditData = useEditUserMainProfileStore(
    (state) => state.userEditData
  );
  const { setFieldErrors, fieldErrors: errors } = useEditUserMainProfileStore(
    (state) => state
  );

  const validate = useCallback(() => {
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
    setFieldErrors(fieldErrors);
    return { success: false as const, errors: fieldErrors };
  }, [currentEditData, setFieldErrors]);

  return { validate, errors };
};

// Hook to submit the user edit data
export const useSubmitEditData = () => {
  const userEditData = useEditUserMainProfileStore(
    (state) => state.userEditData
  );
  const userMainProfile = useUserMainProfileStore(
    (state) => state.userMainProfile
  );

  const diffData = useMemo(() => {
    return userMainProfile && userEditData
      ? getUpdatedKeys(userMainProfile, userEditData)
      : null;
  }, [userEditData, userMainProfile]);

  return {
    diffData,
  };
};
