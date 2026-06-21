'use client';

import { useEffect, useState } from 'react';

export default function AdminSystemTimeGreeting({ displayName }: { displayName: string }) {
  const [greeting, setGreeting] = useState('Welcome');

  useEffect(() => {
    const updateGreeting = () => setGreeting(getTimeGreeting(new Date()));

    updateGreeting();
    const intervalId = window.setInterval(updateGreeting, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <h1 className='text-3xl font-semibold tracking-normal text-white sm:text-4xl'>
      {greeting}, {displayName}
    </h1>
  );
}

function getTimeGreeting(date: Date) {
  const hour = date.getHours();

  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
