declare module "currency-map-country" {
	export function getCurrencyAbbreviation(
		countryName: string,
	): string | undefined;
	export function getCountryFromCurrency(
		currency: string,
	): string | undefined;
}
