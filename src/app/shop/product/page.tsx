import { redirect } from 'next/navigation';

export default function CatchAll() {
  return redirect('/shop/products/all'); // Triggers Next.js to send a 404 status, important for SEO
}
