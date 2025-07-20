import { useRouter } from 'next/navigation';

export const useShopRouter = () => {
  const router = useRouter();

  const hostname = window.location.hostname;

  const push = (path: string) => {
    if (path.startsWith('/shop') && hostname === 'codexchristi.shop') {
      return router.push(path.split('/shop')[1] || '/');
    } else {
      return router.push(path);
    }
  };

  return { push };
};
