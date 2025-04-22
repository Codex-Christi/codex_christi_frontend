import { redirect } from 'next/navigation';
import { verifySession } from './session-validate';

export const basicRedirect = (destination: string) => {
  redirect(destination.startsWith('/') ? destination : '/');
};

export const redirectLoggedInUserToProfile = async () => {
  if ((await verifySession()) === true) {
    console.log('/profile');
  }
};
