import { FetcherError } from '@/lib/utils/SWRfetcherAdvanced';

export const returnReducedBackendError = (err: FetcherError) => {
  if (err instanceof FetcherError) {
    const allBackendErrorsArr = (err.info &&
    typeof err.info === 'object' &&
    'errors' in err.info &&
    Array.isArray((err.info as { errors?: unknown }).errors)
      ? (err.info as { errors: unknown[] }).errors
      : null) as
      | {
          type: string;
          code: string;
          message: string;
          field_name: string | null;
        }[]
      | null;

    if (!allBackendErrorsArr || allBackendErrorsArr.length === 0) {
      return {
        message:
          err.info && typeof err.info === 'object' && 'message' in err.info
            ? String((err.info as { message?: unknown }).message ?? err.message)
            : err.message,
        status: err.status,
        info: err.info,
      };
    }

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
