'use server';

import { deleteSession } from '@/lib/session/main-session';

export const logoutUser = async () => {
  try {
    await deleteSession();
    return true;
  } catch (err: Error | unknown) {
    return {
      status: false,
      error: err,
    };
  }
};
