export function getCategoryPagePath(categorySlug: string, page: number) {
  const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
  const encodedCategory = encodeURIComponent(categorySlug);

  if (safePage <= 1) return `/shop/category/${encodedCategory}`;
  return `/shop/category/${encodedCategory}/page/${safePage}`;
}
