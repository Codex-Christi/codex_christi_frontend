import ProfilePageMainComponent from '@/components/UI/profile/ProfilePageMainComponent';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Profile | Codex Christi',
  description: 'View and edit your personal information',
};

// export const revalidate = 600;

// Async SSR profile page data genarator function
export default async function Page() {
  return <ProfilePageMainComponent />;
}
