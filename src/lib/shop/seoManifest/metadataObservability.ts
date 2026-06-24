type ShopMetadataTargetKind = 'product' | 'category';

export type ShopMetadataSource =
  | 'manifest'
  | 'snapshot'
  | 'dev_live'
  | 'published_fallback'
  | 'category_fallback'
  | 'unknown_noindex';

type ShopMetadataObservation = {
  targetKind: ShopMetadataTargetKind;
  targetId: string;
  source: ShopMetadataSource;
  startedAt: number;
  shouldIndex: boolean;
  page?: number;
};

export function recordShopMetadataSource({
  targetKind,
  targetId,
  source,
  startedAt,
  shouldIndex,
  page,
}: ShopMetadataObservation) {
  if (!isMetadataObservabilityEnabled()) return;

  console.info('[shop.generateMetadata.source]', {
    targetKind,
    targetId,
    source,
    shouldIndex,
    ...(page === undefined ? {} : { page }),
    elapsedMs: Date.now() - startedAt,
  });
}

function isMetadataObservabilityEnabled() {
  return (
    process.env.SHOP_SEO_METADATA_OBSERVABILITY === '1' ||
    process.env.NODE_ENV !== 'production'
  );
}
