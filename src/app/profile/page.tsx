import ProfilePageMainComponent from '@/components/UI/profile/ProfilePageMainComponent';
import { UserProfileDataInterface } from '@/lib/types/user-profile/main-user-profile';
import { Metadata } from 'next';
import { getUser } from '@/lib/funcs/userProfileFetchers/getUser';

export const metadata: Metadata = {
  title: 'Profile | Codex Christi',
  description: 'View and edit your personal information',
};

// export const revalidate = 600;

// Async SSR profile page data genarator function
export default async function Page() {
  const userDataApiResponse = await getUser();

  const doesResponseHaveUserData = userDataApiResponse
    ? 'first_name' in userDataApiResponse
    : false;

  if (doesResponseHaveUserData) {
    const responseObj = userDataApiResponse as UserProfileDataInterface;
    return <ProfilePageMainComponent serverFetchedProfileUserData={responseObj} />;
  }
}
