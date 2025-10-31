export function formatAmount({
  amount,
  noDecimal = false,
  showCurrency = true,
  currency = "NGN",
}: {
  amount: string | number;
  noDecimal?: boolean;
  showCurrency?: boolean;
  currency?: string;
}): string | null {
  // Convert the amount to a number if it's a string
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;

  if (isNaN(numAmount)) {
    return null;
  }

  // Define the options for formatting
  const options: Intl.NumberFormatOptions = {
    minimumFractionDigits: noDecimal ? 0 : 2,
    maximumFractionDigits: noDecimal ? 0 : 2,
  };

  const currencyOptions: Intl.NumberFormatOptions = {
    ...options,
    style: "currency",
    currency: currency,
  };

  // Create a formatter for the given locale (assuming 'en-US' here for comma separation)
  const formatter = new Intl.NumberFormat("en-NG", options);

  if (showCurrency) {
    return new Intl.NumberFormat("en-NG", currencyOptions).format(numAmount);
  }

  return formatter.format(numAmount);
}
