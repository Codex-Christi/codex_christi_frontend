// TypeScript type definition and validation for UserProfileData.
// Includes readonly fields, required attributes, nullable types, and validation logic.
// Suitable for API payloads, PATCH requests, and form validation.

export interface UserProfileData {
  id?: string; // UUID (ReadOnly)
  email?: string; // Email (Required, Max: 254, Min: 1)
  first_name?: string; // First name (Max: 50)
  last_name?: string; // Last name (Max: 50)
  profile_pic?: string | null; // Profile picture URI (ReadOnly)
  username?: string | null; // Username (ReadOnly, Min: 1)
  city?: string | null; // City (ReadOnly, Min: 1)
  state?: string | null; // State (ReadOnly, Min: 1)
  country?: string | null; // Country (ReadOnly, Min: 1)
  address?: string | null; // Address (ReadOnly, Min: 1)
  bio?: string | null; // Bio (ReadOnly, Min: 1)
  date_of_birth?: string | null; // Date of Birth (ReadOnly, Min: 1)
  age?: number | null; // Age (ReadOnly)
  currency?: string | null; // Currency (ReadOnly, Min: 1)
  mobile_phone?: string | null; // Mobile phone (ReadOnly, Min: 1)
  date_created?: string | null; // Date created (ReadOnly, DateTime)
  date_updated?: string | null; // Date updated (ReadOnly, DateTime)
}

// === Validation Logic ===

// Regex for international E.164 phone format (up to 15 digits, starting with '+').
const phoneRegex = /^\+[1-9]\d{1,14}$/;

// Regex for image file extensions (.jpg, .jpeg, .png).
const imageExtensionRegex = /\.(jpe?g|png)$/i;
const MAX_PROFILE_PIC_SIZE = 1048576; // 1MB in bytes

/**
 * Validate a mobile phone number (E.164 format).
 * Returns true if the string matches '+<countrycode><number>' up to 15 digits.
 */
export function validateMobilePhone(phone: string): boolean {
  return phoneRegex.test(phone);
}

/**
 * Validate a profile picture URL or File:
 * - If it's a File, it must have extension .jpg, .jpeg, or .png.
 * - If it's a URL string, it must match the extension pattern.
 * - File size must not exceed 1MB.
 */
export function validateProfilePic(fileOrUrl: File | string): boolean {
  if (typeof fileOrUrl === 'string') {
    return imageExtensionRegex.test(fileOrUrl);
  } else {
    return (
      imageExtensionRegex.test(fileOrUrl.name) &&
      fileOrUrl.size <= MAX_PROFILE_PIC_SIZE
    );
  }
}

/**
 * Generic validation function for UserProfileData before sending API requests.
 */
export function validateUserProfileData(
  data: Partial<UserProfileData>
): boolean {
  if (data.mobile_phone && !validateMobilePhone(data.mobile_phone)) {
    return false;
  }
  if (data.profile_pic && !validateProfilePic(data.profile_pic)) {
    return false;
  }
  return true;
}
