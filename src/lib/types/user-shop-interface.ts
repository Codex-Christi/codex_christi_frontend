export interface IUserShopProfile {
  status: number;
  message: string;
  success: boolean;
  data: {
    first_name: string;
    last_name: string;
    bio: string;
    profile_pic: string;
    username: string;
    favorite_products: string[];
    payment_methods: string;
    shipping_address: string | null;
    shipping_city: string | null;
    shipping_state: string | null;
    shipping_country: string | null;
  };
}
