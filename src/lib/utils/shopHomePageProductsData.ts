// Array for the Launch Merch Section
export const launchMerchProducts = [
  {
    image_name: 'launch_merch_grid_rb_hoodie.png',
    img_alt: 'Random Blessings Unisex Hoodie',
    productId: '68cf079c1581a310d9032c25',
    usdCentsBase: 4000,
  },
  {
    image_name: 'launch_merch_grid_p4C_tshirt.png',
    img_alt: 'Programmer For Christ Unisex Long Sleeve T-Shirt (Zeroes and Ones)',
    productId: '68c64ec8efd818cdb12d2d21',
    usdCentsBase: 3500,
  },
  {
    image_name: 'launch_merch_grid_brand-cap.png',
    img_alt: 'Codex Patterned Black Baseball Cap (Glowing Light Logo)',
    productId: '68cfabf271d61ebcebbf415b',
    usdCentsBase: 3000,
  },
  {
    image_name: 'launch_merch_grid_brand-shirt-pink.png',
    img_alt: 'Codex Christi Classic White Logo Unisex Crew-neck Sweatshirt',
    productId: '68b39ac590dbad697de11bbf',
    usdCentsBase: 4000,
  },
  {
    image_name: 'launch_merch_grid_ph4C_hoodie.png',
    img_alt: 'Photographer For Christ Unisex Hoodie',
    productId: '68cf0a371581a3c735032ca4',
    usdCentsBase: 4000,
  },
] as const;

// Categories object
export const categoriesObj = {
  hoodies: {
    headerTitle: 'Hoodies',
    content: [
      {
        image_name: 'd4C_female_hoodie.png',
        img_alt: 'Designer For Christ Female Hoodie',
        productId: '68ce4f301581a3330802f9b6',
        usdCentsBase: 4000,
      },
      {
        image_name: 'Jesus_hoodie.png',
        img_alt: 'Jesus Hoodie Vertical',
        productId: '6830af142932fd3c2dd631cc',
        usdCentsBase: 3500,
      },
    ],
  },
  tshirts: {
    headerTitle: 'T-Shirts',
    content: [
      {
        image_name: 'c4C_tshirt.png',
        img_alt: `Cooking For Christ Men's T-shirt`,
        productId: '684de951647e3a18791ebccf',
        usdCentsBase: 2500,
      },
      {
        image_name: 'ph4C_tshirt.png',
        img_alt: `Photographer For Christ Unisex Sweatshirt`,
        productId: '68cedaa190bc783a79285ca1',
        usdCentsBase: 3500,
      },
    ],
  },
  headwears: {
    headerTitle: 'Headwears',
    content: [
      {
        image_name: 'brand-cap_headwear.png',
        img_alt: `Basic Black Baseball Cap (Logo and Motto)`,
        productId: '68cf20cb1581a3a0fa032d2c',
        usdCentsBase: 3000,
      },
      {
        image_name: 'brand-cap_white_headwear.png',
        img_alt: `Patterned White Baseball Cap Black Logo`,
        productId: '68f0a6aa048473068c573574',
        usdCentsBase: 3000,
      },
    ],
  },
  jackets: {
    headerTitle: 'Jackets',
    content: [
      {
        image_name: 'rb_jacket.png',
        img_alt: `Random Blessings Men's Jacket`,
        productId: '68cf4e6371d61e390dbf2a73',
        usdCentsBase: 5000,
      },
      {
        image_name: 'd4C_jacket.png',
        img_alt: `Designer For Christ Men's Jacket`,
        productId: '68ce314a9771b7c8e583a18b',
        usdCentsBase: 5000,
      },
    ],
  },
} as const;

type HomePageProduct = {
  readonly image_name: string;
  readonly img_alt: string;
  readonly productId: string;
  readonly usdCentsBase: number;
};

const categoryShopProducts = Object.values(categoriesObj).flatMap(
  (category): HomePageProduct[] => [...category.content],
);

const publishedShopProducts: readonly HomePageProduct[] = [
  ...launchMerchProducts,
  ...categoryShopProducts,
] as const;

export const PUBLISHED_SHOP_PRODUCT_IDS = [
  ...new Set(publishedShopProducts.map((product) => product.productId)),
];

export function getPublishedShopProductPreview(productId: string) {
  const product = publishedShopProducts.find((item) => item.productId === productId);
  if (!product) return null;

  return {
    productId: product.productId,
    title: product.img_alt,
    imagePath: `/${product.image_name}`,
    retailPrice: (product.usdCentsBase / 100).toFixed(2),
  };
}
