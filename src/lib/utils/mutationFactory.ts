// lib/mutationFactory.ts

import useSWRMutation from 'swr/mutation';
import { universalFetcher, FetcherError, FetcherOptions } from '@/lib/utils/SWRfetcherAdvanced';

export function makeMutationAdapter<Data, Arg extends object>(
  transformArg: (arg: Arg) => { body: Arg; fetcherOptions?: FetcherOptions },
) {
  return async (key: string, { arg }: { arg: Arg }): Promise<Data> => {
    const { body, fetcherOptions } = transformArg(arg);
    return universalFetcher<Data, Arg>(key, {
      arg: body,
      fetcherOptions,
    });
  };
}

export function useMutationHook<Data, Arg extends object>(
  endpoint: string,
  transformArg: (arg: Arg) => { body: Arg; fetcherOptions?: FetcherOptions },
) {
  const adapter = makeMutationAdapter<Data, Arg>(transformArg);

  return function useThisMutation() {
    const { trigger, data, error, isMutating, reset } = useSWRMutation<
      Data,
      FetcherError,
      string, // key
      Arg // arg
    >(endpoint, adapter);

    return { trigger, data, error, isMutating, reset };
  };
}
