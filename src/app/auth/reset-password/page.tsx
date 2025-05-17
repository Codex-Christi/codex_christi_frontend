import ResetPassword from '@/components/UI/Auth/ResetPassword/ResetPassword';
import { Metadata } from 'next';
import { Suspense } from 'react';

export const metadata: Metadata = {
	title: 'Create New Password | Codex Christi',
	description: 'Createa new password and access your account.',
};

const Index = (): JSX.Element => {
	return (
        <Suspense>
            <ResetPassword />
        </Suspense>
    );
};

export default Index;
