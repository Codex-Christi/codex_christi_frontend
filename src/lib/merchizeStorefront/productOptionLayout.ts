import type { ProductOption, ProductVariantsInterface } from './productTypes';

export type ProductOptionKind = 'size' | 'color' | 'label';
export type ProductRadioOption = { label: string; value: string; key: string };
export type ProductOptionLayoutGroup = {
  attribute: ProductOptionKind;
  title: string;
  options: ProductRadioOption[];
};

const SIZE_ORDER = ['xs', 's', 'm', 'l', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl'];
const OPTION_GROUPS = [
  ['size', 'Size:'],
  ['color', 'Colors:'],
  ['label', 'Label:'],
] as const;

function getProductAttributeOptions(
  variants: ProductVariantsInterface['data'],
  attribute: ProductOptionKind,
) {
  return [
    ...new Map(
      variants
        .flatMap((variant) => variant.options)
        .filter((option) => option?.attribute?.name.toLowerCase() === attribute)
        .map((option) => [option.value, option]),
    ).values(),
  ];
}

export function buildProductRadioOptions(options: ProductOption[], attribute: ProductOptionKind) {
  const mapped = options
    .map((option) => {
      const attributeName = option.attribute?.name;
      return {
        label: option.name ?? attributeName ?? attribute,
        value: option.value,
        key: option.slug ?? `${option.value}-${attributeName ?? attribute}`,
      };
    })
    .sort((a, b) =>
      attribute === 'size'
        ? SIZE_ORDER.indexOf(a.label.toLowerCase()) - SIZE_ORDER.indexOf(b.label.toLowerCase())
        : a.label.localeCompare(b.label),
    );

  return [
    ...new Map(
      mapped.map((option) => [`${option.label}:${option.value}`.toLowerCase(), option]),
    ).values(),
  ];
}

export function getProductOptionGroups(variants: ProductVariantsInterface['data']) {
  return OPTION_GROUPS.flatMap(([attribute, title]) => {
    const options = getProductAttributeOptions(variants, attribute);
    return options.length ? [{ attribute, title, options }] : [];
  });
}

// Geometry only: cached labels never constitute availability or price evidence.
export function getProductOptionLayout(
  variants: ProductVariantsInterface['data'],
): ProductOptionLayoutGroup[] {
  return getProductOptionGroups(variants).map(({ attribute, title, options }) => ({
    attribute,
    title,
    options: buildProductRadioOptions(options, attribute),
  }));
}
