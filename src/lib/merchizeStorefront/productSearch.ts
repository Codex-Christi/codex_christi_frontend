import didYouMean, { ReturnTypeEnums, ThresholdTypeEnums } from 'didyoumean2';

export type SearchProduct = {
  id: string;
  title: string;
  image: string | null;
  price: number | null;
};
export type ProductSearchIndex = { products: SearchProduct[]; truncated: boolean };
export const SEARCH_QUERY_MAX_LENGTH = 100;
export const SEARCH_PAGE_SIZE = 15;

export function normalizeSearchQuery(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, SEARCH_QUERY_MAX_LENGTH);
}

function words(value: string) {
  return (
    value
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? []
  );
}

/** Build once per index download, then search without requests or repeated tokenization. */
export function createProductSearch(products: SearchProduct[]) {
  const entries = products.map((product) => {
    const tokens = words(product.title);
    return { product, words: tokens, phrase: tokens.join(' ') };
  });
  const vocabulary = [...new Set(entries.flatMap((entry) => entry.words))];

  return (query: string, limit = 6) => {
    const tokens = words(normalizeSearchQuery(query)).slice(0, 10);
    if (!tokens.length) return [];
    const phrase = tokens.join(' ');
    const alternatives = tokens.map(
      (token) =>
        new Set(
          token.length < 3
            ? []
            : didYouMean(token, vocabulary, {
                returnType: ReturnTypeEnums.ALL_CLOSEST_MATCHES,
                thresholdType: ThresholdTypeEnums.EDIT_DISTANCE,
                threshold: token.length >= 6 ? 2 : 1,
              }),
        ),
    );

    return entries
      .map((entry) => {
        let score = entry.phrase.includes(phrase) ? 0 : 1;
        for (const [index, token] of tokens.entries()) {
          if (entry.words.some((word) => word.startsWith(token))) continue;
          if (!entry.words.some((word) => alternatives[index].has(word))) return null;
          score += 2;
        }
        return { product: entry.product, score };
      })
      .filter((entry) => entry !== null)
      .sort((a, b) => a.score - b.score || a.product.title.localeCompare(b.product.title))
      .slice(0, limit)
      .map((entry) => entry.product);
  };
}
