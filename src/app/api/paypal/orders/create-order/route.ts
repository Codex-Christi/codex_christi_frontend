// POST /api/paypal/orders/create-order
import { NextResponse } from 'next/server';
import { createPayPalOrder } from '@/lib/paypal/createPayPalOrder';
import type { CreateOrderActionInterface } from '@/lib/paypal/createPayPalOrder';

// Main POST endpoint receiver
export async function POST(req: Request) {
  // const { origin } = new URL(req.url); // ← Edge‑safe way to get your app's origin

  const body: CreateOrderActionInterface = await req.json();
  try {
    const order = await createPayPalOrder(body);

    return NextResponse.json(order);
  } catch (err: unknown) {
    console.error('Create Order Error', err);

    return NextResponse.json(err);
  }
}
