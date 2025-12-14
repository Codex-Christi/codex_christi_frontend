// EditUserProfileStore.ts
import { create } from 'zustand';
import { UserProfileDataInterface } from '@/lib/types/user-profile/main-user-profile';
import { getUpdatedKeys } from '@/lib/utils/getUpdatedObjKeys';
import { useUserMainProfileStore } from './userMainProfileStore';
import { PatchUserProfileSchema } from '@/lib/formSchemas/editUserProfileSchema';
import { ZodError } from 'zod';
import { useCallback, useMemo } from 'react';

// Types
type EditableProfileShape = Partial<UserProfileDataInterface>;

type UserEditProfileStoreType = {
  userEditData: EditableProfileShape | null;
  setUserEditData: (userEditData: EditableProfileShape | null) => void;
  updateUserEditField: <K extends keyof UserProfileDataInterface>(
    field: K,
    value: UserProfileDataInterface[K] | undefined,
  ) => void;
  initializeFromMainProfile: () => void;
  fieldErrors: Record<string, string> | null;
  setFieldErrors: (fieldErrors: Record<string, string> | null) => void;
  clearEditData: () => void;
};

// Store for user edit profile data
export const useEditUserMainProfileStore = create<UserEditProfileStoreType>((set) => ({
  userEditData: null,
  fieldErrors: null,
  // Set the user edit data
  setUserEditData: (userEditProfileState: EditableProfileShape | null) =>
    set((state) => ({
      ...state,
      userEditData: userEditProfileState,
      fieldErrors: null,
    })),
  updateUserEditField: (field, value) =>
    set((state) => {
      const mainProfileSnapshot = useUserMainProfileStore.getState().userMainProfile ?? {};
      const existingData: EditableProfileShape = { ...(state.userEditData ?? {}) };
      const nextValue =
        value instanceof File
          ? value
          : value === null || typeof value === 'undefined'
            ? ''
            : value;

      const baseValue = mainProfileSnapshot?.[field];
      const areValuesEqual =
        nextValue instanceof File
          ? false
          : baseValue instanceof File
            ? false
            : (nextValue ?? '') === (baseValue ?? '');

      if (areValuesEqual) {
        delete existingData[field];
      } else {
        existingData[field] = nextValue;
      }

      return {
        ...state,
        userEditData: Object.keys(existingData).length > 0 ? existingData : null,
        fieldErrors: null,
      };
    }),
  initializeFromMainProfile: () =>
    set((state) => ({
      ...state,
      userEditData: null,
      fieldErrors: null,
    })),
  setFieldErrors: (fieldErrors: Record<string, string> | null) =>
    set((state) => ({
      ...state,
      fieldErrors,
    })),

  // Clear the user edit data
  clearEditData: () => set({ userEditData: null, fieldErrors: null }),
}));

export const useValidateUserEditData = () => {
  // Hooks
  const currentEditData = useEditUserMainProfileStore((state) => state.userEditData);
  const { setFieldErrors, fieldErrors: errors } = useEditUserMainProfileStore((state) => state);

  const validate = useCallback(() => {
    if (!currentEditData || Object.keys(currentEditData).length === 0) {
      const noChangeError = { undefined: 'You have not made any changes.' };
      setFieldErrors(noChangeError);
      return { success: false as const, errors: noChangeError };
    }

    const result = PatchUserProfileSchema.safeParse(currentEditData);

    //   If validation passes, set the fieldErrors to null
    if (result.success) {
      //   Return the validated data
      return {
        success: true as const,
        data: result.data as EditableProfileShape,
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
  const userEditData = useEditUserMainProfileStore((state) => state.userEditData);
  const userMainProfile = useUserMainProfileStore((state) => state.userMainProfile);

  const diffData = useMemo(() => {
    return userMainProfile && userEditData ? getUpdatedKeys(userMainProfile, userEditData) : null;
  }, [userEditData, userMainProfile]);

  useUserMainProfileStore().setUserMainProfile({ ...userMainProfile, ...diffData });

  return {
    diffData,
  };
};
