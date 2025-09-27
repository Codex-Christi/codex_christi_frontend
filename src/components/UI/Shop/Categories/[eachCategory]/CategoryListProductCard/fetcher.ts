// `lib/fetcher.ts`

// Define the shape of your error info object, e.g., an object with a message.
interface ErrorInfo {
  message: string;
}

export class FetcherError extends Error {
  info: ErrorInfo | null;
  status: number;

  constructor(message: string, info: ErrorInfo | null, status: number) {
    super(message);
    this.name = 'FetcherError'; // It's good practice to set a custom name
    this.info = info;
    this.status = status;
  }
}

// Add <T> to the function signature to declare it as a generic type parameter.
export const fetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url);

  if (!res.ok) {
    const errorInfo = await res.json().catch(() => null);
    throw new FetcherError('An error occurred while fetching the data.', errorInfo, res.status);
  }

  // Cast the response to the generic type T.
  return res.json() as Promise<T>;
};
