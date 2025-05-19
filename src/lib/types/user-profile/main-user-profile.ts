// TypeScript type definition and validation for UserProfileData.
// Includes readonly fields, required attributes, nullable types, and validation logic.
// Suitable for API payloads, PATCH requests, and form validation.

export interface UserProfileDataInterface {
  id?: string; // UUID (ReadOnly)
  email?: string; // Email (Required, Max: 254, Min: 1)
  first_name?: string; // First name (Max: 50)
  last_name?: string; // Last name (Max: 50)
  profile_pic?: string | File | null; // Profile picture URI (ReadOnly)
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
