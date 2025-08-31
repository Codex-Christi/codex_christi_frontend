'use client';

import { Button } from '@/components/UI/primitives/button';
import { decrypt, getCookie } from '@/lib/session/main-session';

export default function AdminShopActionsPage() {
  return (
    <Button
      name='Update/Populate Products'
      onClick={async () => {
        const sessionCookie = await getCookie('session');

        const decryptedSessionCookie = await decrypt(sessionCookie?.value);

        const mainAccessToken = decryptedSessionCookie
          ? (decryptedSessionCookie.mainAccessToken as string)
          : ('' as string);
        fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/admin/populate-products`, {
          headers: { Authorization: `Bearer ${mainAccessToken}` },
        }).then((resp) => resp.json().then((data) => console.log(data)));
      }}
    >
      Update/Populate Products
    </Button>
  );
}
