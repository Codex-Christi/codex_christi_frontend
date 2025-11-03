const AccountOverviewLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className='min-h-dvh p-2 md:p-6'>
      <div className='grid items-start gap-8 p-4 bg-[linear-gradient(180deg,_rgba(243,_243,_243,_0.08)_0%,_rgba(141,_141,_141,_0.08)_100%)] rounded-lg backdrop-blur-xl md:p-6 md:w-4/5 md:mx-auto lg:w-3/5 relative'>
        {children}
      </div>
    </div>
  );
};

export default AccountOverviewLayout;
