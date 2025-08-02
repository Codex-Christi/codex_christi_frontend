import 'server-only';
import {
  merchizeBaseURL,
  merchizeAPIKey,
  cacheForDays,
} from '../../product/[id]/productDetailsSSR';
import { cache } from 'react';

export const getCategoryMetadataFromMerchize = cache(async (categoryName: string) => {
  try {
    const res = await fetchFromMerchizeWithNextCache({
      url: `${merchizeBaseURL}/product/v2/collections/search`,
      method: 'POST',
      body: new URLSearchParams({ name: `'${categoryName}'` }).toString(),
      isFormBody: true,
      daysToCache: 1,
    });

    const categoryID = res.data.collections[0]._id as string;

    // Make second request to extract all metadata
    const { data: metaDataObj } = (await fetchFromMerchizeWithNextCache({
      url: `${merchizeBaseURL}/product/v2/collections/${categoryID}`,
      daysToCache: 1,
    })) as {
      data: { cover: { url: string } | null | undefined; description: string; name: string };
    };

    const { description, name } = metaDataObj || {};

    return {
      ...metaDataObj,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      description: description
        ? description.split('.')[0].replace(/<[^>]*>/g, '')
        : `Buy ${name} now. Limited edition.`,
      categoryID,
    };

    //  Catch errors
  } catch (err) {
    console.log(err);
    throw err;
  }
});

// Fetch from Merchize with Next.js Cache
// This function is used to fetch data from Merchize API with caching enabled
const fetchFromMerchizeWithNextCache = cache(
  async (params: {
    url: string;
    body?: BodyInit | null | undefined;
    method?: string | undefined;
    daysToCache: number;
    isFormBody?: boolean;
  }) => {
    // DEstrcuting params
    const { url, method, body, daysToCache, isFormBody } = params;

    // Main fetch from here
    return await fetch(`${url}`, {
      method: method ?? 'GET',
      headers: {
        'X-API-KEY': `${merchizeAPIKey}`,
        'Content-Type': isFormBody ? 'application/x-www-form-urlencoded' : 'application/json',
      },
      next: { revalidate: cacheForDays(daysToCache) },

      body: body,
    }).then(async (resp) => {
      if (!resp.ok) throw new Error('Network error');

      const data = await resp.json();
      return data;
    });
  },
);
