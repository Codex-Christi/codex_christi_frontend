import type { Config } from 'tailwindcss';
import sharedConfig from './tailwind.config';

export default {
  ...sharedConfig,
  content: [
    './src/app/{layout,not-found}.tsx',
    './src/app/shop/{page,not-found,error,loading}.tsx',
    './src/app/shop/{category,categories,product,shipping-pod-policy}/**/*.{ts,tsx}',
    './src/components/UI/{Providers,general,primitives}/**/*.{ts,tsx}',
    './src/components/UI/Shop/{Nav,MobileSidebar,ShopSubNav,Index,Categories,ProductDetails,GlobalShopComponents,HelperComponents,404PageComponents}/**/*.{ts,tsx}',
    './src/components/UI/Shop/{Footer,Logo}.tsx',
    './src/components/UI/profile/UserAvatar.tsx',
    './src/lib/**/*.{ts,tsx}',
  ],
} satisfies Config;
