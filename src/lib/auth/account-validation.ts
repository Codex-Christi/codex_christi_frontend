import en from 'react-phone-number-input/locale/en';
import { normalizeCountryToIso2 } from '../utils/shop/checkout/normalizeCountryToIso3';
import { shippingAddressSchema } from '../types/shipping-address-schema';
import { profileTextUpdateSchema, profilePhotoSchema } from '../formSchemas/profile-fields';

export function shippingAddressPayload(input: unknown) {
  const parsed = shippingAddressSchema.strict().parse(input);
  const code = normalizeCountryToIso2(parsed.shipping_country);
  if (!code || !en[code as keyof typeof en]) throw new Error('Choose a valid shipping country.');
  return { ...parsed, shipping_country: en[code as keyof typeof en] };
}

export async function profileUpdateForm(input: FormData) {
  if (!(input instanceof FormData)) throw new Error('A profile form is required.');
  const values: Record<string, string> = {};
  const output = new FormData();
  let hasPhoto = false;
  for (const [key, value] of input) {
    if (output.has(key) || Object.hasOwn(values, key)) throw new Error('Duplicate profile field.');
    if (key === 'profile_pic') {
      const photo = profilePhotoSchema.parse(value);
      const bytes = new Uint8Array(await photo.slice(0, 8).arrayBuffer());
      const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      const png = [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
      if ((photo.type === 'image/jpeg' && !jpeg) || (photo.type === 'image/png' && !png))
        throw new Error('Invalid profile photo.');
      output.set(key, photo);
      hasPhoto = true;
    } else {
      if (typeof value !== 'string' || value.length > 2048)
        throw new Error('Invalid profile field.');
      values[key] = value;
    }
  }
  const fields = profileTextUpdateSchema.parse(values);
  if (!hasPhoto && Object.keys(fields).length === 0)
    throw new Error('Make a change before saving.');
  for (const [key, value] of Object.entries(fields))
    if (value !== undefined) output.set(key, value);
  return output;
}
