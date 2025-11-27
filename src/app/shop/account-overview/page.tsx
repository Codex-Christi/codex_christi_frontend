import AccountOverviewTabs from "./_components/account-overview-tabs";
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Account Overview | Codex Christi Shop',
  description: 'Manage your shop profile',
};

const AccountOverview = () => {
  return (
    <AccountOverviewTabs />
  );
};

export default AccountOverview;
