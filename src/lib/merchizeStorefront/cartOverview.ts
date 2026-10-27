import 'server-only';
import type { CartVariant } from '@/stores/shop_stores/cartStore';
import { getDollarMultiplier } from '@/actions/shop/general/currencyConvert';
import { loadExtrasBySku } from '@/lib/datasetSearchers/merchize/shipping.data';
import {
  calculateStrictShippingQuoteUsd,
  StrictShippingResolutionError,
} from '@/lib/paypal/orderSnapshot/strictShipping';
import { hasCheckoutBlockingCartItems } from '@/components/UI/Shop/Cart/cartAvailability';
import { createStorefrontVerificationContext } from './currentProductLineCompatibility';
import { verifyCartDisplay } from './cartVerification';
import {
  calculateOrderPreviewTotals,
  resolveOrderCurrency,
  type OrderPreviewTotals,
} from '@/lib/shop/checkout/orderMoney';

export async function resolveCartOverview(cart: CartVariant[], countryIso3: string) {
  if (!/^[A-Z]{3}$/.test(countryIso3)) throw new Error('A valid destination is required.');
  const context = createStorefrontVerificationContext();
  const verified = await verifyCartDisplay(cart, context);
  let totals: OrderPreviewTotals | null = null;
  let quoteError: string | null = null;
  let shippingEvidenceComplete = false;
  if (
    verified.cartItems.length &&
    !hasCheckoutBlockingCartItems(cart, verified.availabilityByVariantId)
  ) {
    try {
      const lines = verified.cartItems.map((item) => ({
        lineId: item.variantId,
        sku: item.itemDetail.supplierSku!,
        quantity: item.quantity,
      }));
      const catalog = await context.resolveCatalogVariants(lines.map((line) => line.sku));
      if (!catalog.generationAvailable)
        throw new Error('Supplier shipping data could not be verified.');
      shippingEvidenceComplete =
        catalog.variants.length === new Set(lines.map((line) => line.sku)).size &&
        catalog.variants.every((variant) => Array.isArray(variant.catalogRow.shippingBands));
      const quote = calculateStrictShippingQuoteUsd({
        lines,
        catalogRows: catalog.variants.map((v) => v.catalogRow),
        countryIso3,
        extrasBySku: await loadExtrasBySku(),
      });
      const fx = resolveOrderCurrency(await getDollarMultiplier(countryIso3));
      totals = calculateOrderPreviewTotals(
        verified.cartItems.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
          unitPriceUsd: item.itemDetail.retail_price,
        })),
        quote.totalUsdCents,
        fx,
      );
    } catch (error) {
      console.warn(
        '[merchize.cartOverview] quote failed',
        error instanceof Error ? error.message : 'Unknown error',
      );
      quoteError =
        shippingEvidenceComplete &&
        error instanceof StrictShippingResolutionError &&
        error.code === 'INVALID_SHIPPING_BAND'
          ? `Unfortunately, ${verified.cartItems.find((item) => item.itemDetail.supplierSku === error.sku)?.title ?? 'an item in your cart'} isn't available for delivery to the selected country. Choose another country or remove it.`
          : 'We could not confirm delivery right now. Please try again shortly.';
    }
  }
  return { ...verified, totals, quoteError };
}
