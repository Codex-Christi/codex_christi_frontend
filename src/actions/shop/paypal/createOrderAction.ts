"use server";
import { CartVariant } from "@/stores/shop_stores/cartStore";
import { ShopCheckoutStoreInterface } from "@/stores/shop_stores/checkoutStore";
import { headers } from "next/headers";
import { cache } from "react";
import "server-only";

export interface BillingAddressInterface {
  addressLine1: string;
  addressLine2: string;
  adminArea1: string;
  adminArea2: string;
  countryCode: string;
  postalCode: string;
}

export interface CreateOrderActionInterface {
  cart: CartVariant[];
  customer?: { name: string; email: string };
  country: string;
  country_iso_3: string;
  initialCurrency: string;
  delivery_address: ShopCheckoutStoreInterface["delivery_address"];
}

export const createOrderAction = cache(async (data: CreateOrderActionInterface) => {
  // Destructure
  const { cart, customer, country, country_iso_3, initialCurrency, delivery_address } = data;

  // Validate Cart
  if (!cart) {
    throw new Error("Missing cart");
  } else if (!Array.isArray(cart)) {
    throw new Error("Cart must be an array");
  } else if (!delivery_address) {
    throw new Error("Missing delivery address!");
  } else if (cart.length === 0) {
    throw new Error("Cart cannot be empty");
  } else if (
    !cart.every(
      (item) => item && typeof item === "object" && "variantId" in item && "quantity" in item,
    )
  ) {
    throw new Error("Each cart item must be a valid CartVariant with id and quantity");
  }

  if (!customer) {
    throw new Error("Missing customer");
  }

  //   Main Fetcher

  const headersList = await headers();
  const protocol = headersList.get("x-forwarded-proto") || "http"; // Default to http if header is missing
  const host = headersList.get("host");

  try {
    const response = await fetch(`${protocol}://${host}/next-api/paypal/orders/create-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cart,
        customer: { name: customer.name, email: customer.email },
        country,
        country_iso_3,
        initialCurrency,
        delivery_address,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    return await response.json();
  } catch (err: unknown) {
    let errorText = "";
    let status = "";
    let statusText = "";
    if (err instanceof Response) {
      errorText = await err.text();
      status = err.status.toString();
      statusText = err.statusText;
    } else if (err instanceof Error) {
      errorText = err.message;
    } else {
      errorText = String(err);
    }
    console.log(`Request failed: ${status} ${statusText} - ${errorText}`);

    throw new Error(`Request failed: ${status} ${statusText} - ${errorText}`);
  }
});
