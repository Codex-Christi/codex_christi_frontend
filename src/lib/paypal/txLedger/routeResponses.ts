import { NextResponse } from 'next/server';

type SuccessArgs<T> = {
  data: T;
  requestId: string;
};

type ErrorArgs = {
  status: number;
  code: string;
  stage: string;
  message: string;
  requestId: string;
  orderToken?: string;
};

export function paypalRouteSuccess<T>({ data, requestId }: SuccessArgs<T>) {
  return NextResponse.json({
    data,
    requestId,
  });
}

export function paypalRouteError({
  status,
  code,
  stage,
  message,
  requestId,
  orderToken,
}: ErrorArgs) {
  return NextResponse.json(
    {
      error: {
        code,
        stage,
        message,
        requestId,
        orderToken,
      },
    },
    { status },
  );
}

type CreateRespondersArgs = {
  requestId: string;
  getOrderToken?: () => string | undefined;
};

type RouteErrorArgs = Omit<ErrorArgs, 'requestId' | 'orderToken'> & {
  orderToken?: string;
};

export function createPayPalRouteResponders({ requestId, getOrderToken }: CreateRespondersArgs) {
  return {
    success<T>(data: T) {
      return paypalRouteSuccess({ data, requestId });
    },
    error({ orderToken, ...args }: RouteErrorArgs) {
      return paypalRouteError({
        ...args,
        requestId,
        orderToken: orderToken ?? getOrderToken?.(),
      });
    },
  };
}
