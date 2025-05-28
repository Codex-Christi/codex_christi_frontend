import { z } from "zod";

// your constants
const phoneRegex = /^\+[1-9]\d{1,14}$/;
const imageExtensionRegex = /\.(jpe?g|png)$/i;
const MAX_PROFILE_PIC_SIZE = 1 * 1024 * 1024;

// 1) Schema for PATCH: all fields optional, but if present must be valid
export const PatchUserProfileSchema = z
	.object({
		email: z
			.string()
			.trim()
			.email({ message: "Must be a valid email address" })
			.optional(),

		first_name: z
			.string()
			.trim()
			.min(2, { message: "First name must be at least 2 characters" })
			.max(50, { message: "First name too long (max 50)" })
			.optional(),

		last_name: z
			.string()
			.trim()
			.min(2, { message: "Last name must be at least 2 characters" })
			.max(50, { message: "Last name too long (max 50)" })
			.optional(),

		profile_pic: z
			.union([z.string().trim(), z.instanceof(File)])
			.refine(
				(v) => {
					if (typeof v === "string")
						return imageExtensionRegex.test(v);
					return (
						imageExtensionRegex.test(v.name) &&
						v.size <= MAX_PROFILE_PIC_SIZE
					);
				},
				{ message: "Profile pic must be .jpg/.jpeg/.png ≤ 1 MB" },
			)
			.optional(),

		username: z
			.string()
			.trim()
			.min(3, { message: "Username must be at least 3 characters" })
			.max(255, { message: "Username too long (max 255)" })
			.optional(),

		city: z
			.string()
			.trim()
			.min(2, { message: "City must be at least 2 characters" })
			.max(100, { message: "City too long (max 100)" })
			.optional(),

		state: z
			.string()
			.trim()
			.min(2, { message: "State must be at least 2 characters" })
			.max(100, { message: "State too long (max 100)" })
			.optional(),

		country: z
			.string()
			.trim()
			.min(2, { message: "Country must be at least 2 characters" })
			.max(100, { message: "Country too long (max 100)" })
			.optional(),

		address: z
			.string()
			.trim()
			.min(5, { message: "Address must be at least 5 characters" })
			.max(255, { message: "Address too long (max 255)" })
			.optional(),

		bio: z
			.string()
			.trim()
			.min(10, { message: "Bio must be at least 10 characters" })
			.max(1000, { message: "Bio too long (max 1000)" })
			.optional(),

		date_of_birth: z.string().trim().optional(), // leave ISO-date validation to your API/server

		age: z
			.number()
			.int()
			.nonnegative({ message: "Age must be a non-negative integer" })
			.optional(),

		currency: z
			.string()
			.trim()
			.length(3, { message: "Currency must be a 3-letter code" })
			.optional(),

		mobile_phone: z
			.string()
			.trim()
			.refine((v) => phoneRegex.test(v), {
				message: "Mobile phone must be in international E.164 format",
			})
			.optional(),

		date_created: z.string().trim().optional(),

		date_updated: z.string().trim().optional(),

		gender: z.string().trim().optional(),

		website: z.string().trim().url().optional(),
	})
	// 2) ensure at least one key is present for a PATCH
	.refine((obj) => Object.keys(obj).length > 0, {
		message: "At least one field must be provided",
	});
