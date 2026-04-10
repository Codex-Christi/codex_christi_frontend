const DEFAULT_META_DESCRIPTION_MAX_LENGTH = 160;
const DEFAULT_META_DESCRIPTION_TARGET_LENGTH = 140;
const DEFAULT_META_DESCRIPTION_MAX_SENTENCES = 3;

const HTML_ENTITY_MAP: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  hellip: '...',
  lt: '<',
  mdash: '-',
  nbsp: ' ',
  ndash: '-',
  quot: '"',
  reg: '',
  trade: '',
};

export type HtmlTextExtractionOptions = {
  stopBeforePatterns?: RegExp[];
  removeBlockPatterns?: RegExp[];
  preferParagraphs?: boolean;
};

export type HtmlSentencePreviewOptions = HtmlTextExtractionOptions & {
  fallbackText?: string;
  maxLength?: number;
  maxSentences?: number;
  targetLength?: number;
};

const decodeHtmlEntities = (value: string): string =>
  value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-zA-Z]+);/g, (match, entity) => HTML_ENTITY_MAP[entity.toLowerCase()] ?? match);

const normalizeText = (value: string): string =>
  value
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();

const stripHtmlTags = (value: string): string =>
  value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|tr|td|th|h[1-6])>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');

const truncateAtWordBoundary = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) return value;

  const truncated = value.slice(0, maxLength + 1);
  const safeBoundary = truncated.lastIndexOf(' ');

  return `${truncated.slice(0, safeBoundary > 0 ? safeBoundary : maxLength).trimEnd()}...`;
};

const splitIntoSentences = (value: string): string[] =>
  normalizeText(value)
    .match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g)
    ?.map((sentence) => normalizeText(sentence))
    .filter(Boolean) ?? [];

const applyTextFilters = (value: string, options: HtmlTextExtractionOptions): string => {
  let output = value;

  for (const pattern of options.stopBeforePatterns ?? []) {
    output = output.replace(pattern, ' ');
  }

  for (const pattern of options.removeBlockPatterns ?? []) {
    output = output.replace(pattern, ' ');
  }

  return output;
};

export const extractPlainTextFromHtml = (
  rawHtml: string | null | undefined,
  options: HtmlTextExtractionOptions = {},
): string => {
  if (!rawHtml) return '';

  const filteredText = applyTextFilters(rawHtml, options);
  const paragraphMatches = options.preferParagraphs
    ? [...filteredText.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    : [];

  const paragraphText = paragraphMatches
    .map(([, paragraph = '']) => normalizeText(stripHtmlTags(decodeHtmlEntities(paragraph))))
    .filter(Boolean)
    .join(' ');

  if (paragraphText) {
    return paragraphText;
  }

  return normalizeText(stripHtmlTags(decodeHtmlEntities(filteredText)));
};

export const extractSentencePreviewFromHtml = (
  rawHtml: string | null | undefined,
  options: HtmlSentencePreviewOptions = {},
): string => {
  const {
    fallbackText = '',
    maxLength = DEFAULT_META_DESCRIPTION_MAX_LENGTH,
    maxSentences = DEFAULT_META_DESCRIPTION_MAX_SENTENCES,
    targetLength = DEFAULT_META_DESCRIPTION_TARGET_LENGTH,
    ...cleaningOptions
  } = options;

  const cleanedText = extractPlainTextFromHtml(rawHtml, cleaningOptions);

  if (!cleanedText) {
    return fallbackText;
  }

  const sentences = splitIntoSentences(cleanedText);
  let description = '';

  for (const sentence of sentences.slice(0, maxSentences)) {
    const candidate = description ? `${description} ${sentence}` : sentence;
    if (candidate.length > maxLength && description) break;

    description = candidate;

    if (description.length >= targetLength) break;
  }

  return truncateAtWordBoundary(description || cleanedText, maxLength);
};

export const extractProductMetaDescriptionFromHtml = (
  rawHtml: string | null | undefined,
  productTitle: string,
): string =>
  extractSentencePreviewFromHtml(rawHtml, {
    fallbackText: `Buy ${productTitle} now. Limited edition.`,
    maxLength: DEFAULT_META_DESCRIPTION_MAX_LENGTH,
    maxSentences: DEFAULT_META_DESCRIPTION_MAX_SENTENCES,
    preferParagraphs: true,
    removeBlockPatterns: [/<table[\s\S]*?<\/table>/gi, /<ul[\s\S]*?<\/ul>/gi],
    stopBeforePatterns: [
      /<div[^>]+id=["']SizeChartContainer["'][\s\S]*$/i,
      /Size chart information:[\s\S]*$/i,
    ],
    targetLength: DEFAULT_META_DESCRIPTION_TARGET_LENGTH,
  });
