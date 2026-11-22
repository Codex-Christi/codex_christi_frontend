/** Only the purchase details a customer needs to review; supplier identities stay on the server. */
export type CheckoutReviewLine = {
  productId: string;
  variantId: string;
  title: string;
  selectedOptions: { name: string; value: string }[];
  quantity: number;
  unitAmount: string;
  lineAmount: string;
};
