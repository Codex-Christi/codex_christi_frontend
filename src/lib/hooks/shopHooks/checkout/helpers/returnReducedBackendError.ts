import { FetcherError } from '@/lib/utils/SWRfetcherAdvanced';

export const returnReducedBackendError = (err: FetcherError) => {
  if (err instanceof FetcherError) {
    // console.log(`Error info from save Action:`, err.info!.errors);
    const allBackendErrorsArr = err.info!.errors as {
      type: string;
      code: string;
      message: string;
      field_name: string | null;
    }[];

    const reducedErr = allBackendErrorsArr.reduce(
      (acc, currErrObj) => {
        const infoString = `[${currErrObj.type}]: ${currErrObj.code}
           ${currErrObj.field_name ? `field name: ${currErrObj.field_name}` : ``}`;
        return {
          ...acc,
          message: acc.message ? acc.message + `\n ${currErrObj.message}` : currErrObj.message,
          status: err.status,
          info: acc.info ? acc.info + ` \n` + infoString : infoString,
        };
      },
      {} as {
        message: string;
        status: number | null;
        info: Record<string, unknown> | string | null;
      },
    );

    return reducedErr;
  } else {
    return err;
  }
};
