import type { Config } from 'tailwindcss';
import sharedConfig from './tailwind.config';

export default {
  ...sharedConfig,
  content: [
    './src/**/*.{ts,tsx}',
    '!./src/app/admin/**/*.{ts,tsx}',
    '!./src/components/UI/Admin/**/*.{ts,tsx}',
  ],
} satisfies Config;
