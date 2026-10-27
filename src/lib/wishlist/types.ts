export interface WishlistProduct {
  productId: string;
  slug?: string;
  title: string;
  image: string | null;
  /** Display price in USD; final price and availability are verified when selecting options. */
  price: number | null;
  available: boolean;
}

export interface WishlistResponse {
  status: number;
  success: true;
  message: string;
  data: WishlistProduct[];
  userId: string;
}

export interface WishlistMutationResponse {
  success: true;
  message: string;
  userId: string;
}
