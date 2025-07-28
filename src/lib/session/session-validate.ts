import { getCookie } from './main-session';
import { decrypt } from './main-session';
import { convertIatToDate } from './main-session';
import { logoutUser } from '@/actions/logout';

export async function verifySession() {
  const session = await getCookie('session'); //Get session
  const payload = await decrypt(session?.value); // Decrypt session

  if (!session || !payload) {
    return false;
  } else {
    if (payload.exp) {
      const { exp } = payload;
      const expDate = await convertIatToDate(exp);

      // Perform expiry check and revalidating token, and logout for expired Token here

      // Check if token is expired or will soon expire by how many hours
      const hoursToSessionExpiry = compareDatesInHours(expDate);
      if (hoursToSessionExpiry <= 0) {
        console.log('session has expired');
        await logoutUser();
        // Log out user
      } else if (hoursToSessionExpiry <= 24) {
        // Refresh Session
        console.log('You have to refresh session');
      } else {
        // Session is valid, return true object
        return true;
      }
    }
    return false;
  }
}

// check difference in dates func
function compareDatesInHours(targetDate: Date | string | number) {
  const data = new Date(targetDate); // replace with your target date
  const now = new Date();

  const diffMs = data.getTime() - now.getTime(); // difference in milliseconds
  const diffHours = diffMs / (1000 * 60 * 60); // convert milliseconds to hours

  const rounded = Math.ceil(diffHours); // or Math.floor / Math.ceil

  return rounded;
}
