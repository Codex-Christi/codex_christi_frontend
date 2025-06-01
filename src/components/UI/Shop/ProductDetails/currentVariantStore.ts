import { ProductVariantsInterface } from '@/app/shop/product/[id]/productDetailsSSR';
import { create } from 'zustand';

interface CurrentVariantStore {
  currentVariant: ProductVariantsInterface['data'][0];
  setCurrentVariant: (variant: ProductVariantsInterface['data'][0]) => void;
}

// Zustand store for managing the current product variant
export const useCurrentVariant = create<CurrentVariantStore>((set) => ({
  currentVariant: {
    _id: '',
    image_uris: [],
    retail_price: 0,
    is_default: false,
    title: '',
    options: {} as ProductVariantsInterface['data'][0]['options'],
  } as ProductVariantsInterface['data'][0],

  setCurrentVariant: (variant: ProductVariantsInterface['data'][0]) =>
    set(() => ({ currentVariant: variant })),
}));
