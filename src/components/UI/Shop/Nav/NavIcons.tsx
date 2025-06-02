'use client';

import { FC, useCallback, useMemo, useState, useEffect } from 'react';
import { useCartStore } from '@/stores/shop_stores/cartStore';

export const CartIcon: FC = () => {
  // Hooks
  const { variants } = useCartStore();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  //   Funcs
  const getApproxCartItems = useCallback(() => {
    if (isClient) {
      const cartLenNum = variants.length;

      const approxString = cartLenNum >= 9 ? '9+' : cartLenNum;

      return approxString;
    }
  }, [isClient, variants.length]);

  //   Bools
  const cartIsMoreThanNine = useMemo(
    () => isClient && getApproxCartItems() === '9+',
    [getApproxCartItems, isClient]
  );

  // JSX
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width='30.855'
      height='26.383'
      fill='none'
      viewBox='0 0 30.855 26.383'
    >
      <g>
        <path d='M0 0h30.854v25.883H0z'></path>
        <g fill='#FFF' fillRule='evenodd' transform='translate(0 1.883)'>
          <path
            fillOpacity='0.5'
            d='M2.42 0a2.42 2.42 0 1 0 0 4.84 2.42 2.42 0 0 0 0-4.84M1 2.42a1.42 1.42 0 1 1 2.84 0 1.42 1.42 0 0 1-2.84 0'
            transform='translate(5.58 19.66)'
          ></path>
          <path
            fillOpacity='0.5'
            d='M2.42 0a2.42 2.42 0 1 0 0 4.84 2.42 2.42 0 0 0 0-4.84M1 2.42a1.42 1.42 0 1 1 2.84 0 1.42 1.42 0 0 1-2.84 0'
            transform='translate(17.102 19.66)'
          ></path>
          <path d='M1.279.055a.96.96 0 1 0-.637 1.81l.334.118c.855.3 1.416.5 1.83.703.388.19.559.344.671.51.116.168.205.4.256.866.052.486.054 1.12.054 2.067v3.484c0 1.86.017 3.2.192 4.224.188 1.093.562 1.876 1.26 2.614.76.802 1.725 1.15 2.872 1.313 1.098.156 2.492.156 4.215.156h6.918c.95 0 1.75 0 2.396-.08.686-.083 1.311-.266 1.857-.711s.852-1.02 1.073-1.675c.212-.63.375-1.432.572-2.387l.64-3.103.001-.006c.217-1.085.4-1.996.446-2.725.046-.75-.04-1.49-.528-2.126-.3-.39-.724-.612-1.108-.747a6 6 0 0 0-1.284-.268c-.88-.098-1.948-.098-2.995-.098H5.655l-.014-.139c-.068-.635-.217-1.215-.578-1.743-.364-.532-.848-.873-1.412-1.15C3.112.698 2.424.457 1.613.172zm4.428 6.018v-.16h14.567c1.096 0 2.06.002 2.822.087.378.042.661.101.86.171.171.06.223.109.227.111.078.105.163.293.13.832-.035.568-.184 1.325-.411 2.462l-.002.006-.638 3.098c-.207 1.002-.346 1.668-.512 2.16-.157.468-.305.67-.466.8-.16.13-.387.235-.877.295-.516.063-1.196.065-2.22.065H12.4c-1.813 0-3.072-.002-4.02-.137-.915-.13-1.398-.365-1.747-.733-.41-.432-.63-.856-.761-1.617-.142-.831-.165-1.994-.165-3.9v-3.54'></path>
        </g>
        <path
          fill='#FFF'
          fillRule='evenodd'
          d='M0 7a7 7 0 1 1 14 0A7 7 0 0 1 0 7'
          transform='translate(16.855)'
        ></path>
        <text
          fill='#000'
          fontSize={cartIsMoreThanNine ? 10 : 13}
          fontWeight='bold'
          transform={
            cartIsMoreThanNine ? 'translate(17.5 10)' : 'translate(19.5 11.7)'
          }
        >
          {true ? getApproxCartItems() : 0}
        </text>
      </g>
    </svg>
  );
};

export const FavoritesIcon: FC = () => {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width='24'
      height='21.785'
      fill='none'
      viewBox='0 0 24 21.785'
    >
      <g>
        <path d='M0 0h24v21.785H0z'></path>
        <path
          id='Vector'
          fill='#FFF'
          fillRule='evenodd'
          d='M5.972.07C3.34.488 1.197 2.285.372 4.761c-1.047 3.13.126 6.652 3.428 10.32 1.853 2.055 4.119 3.96 7.098 5.963l1.102.74 1.102-.74c2.98-2.003 5.245-3.908 7.098-5.962 3.302-3.669 4.475-7.192 3.429-10.32C22.686 1.941 20.007.004 17.043 0c-1.76 0-3.359.6-4.668 1.754-.192.17-.36.31-.375.31-.014 0-.183-.14-.375-.31A6.96 6.96 0 0 0 7.872.052c-.516-.066-1.426-.057-1.9.018m2.13 1.52c1.384.282 2.552 1.074 3.523 2.388.192.258.36.474.375.474.014 0 .183-.216.375-.474 1.234-1.67 2.74-2.477 4.63-2.482 2.763 0 5.057 1.994 5.46 4.743.076.52.029 1.58-.093 2.148-.338 1.553-1.178 3.143-2.576 4.888-.647.803-2.42 2.604-3.34 3.387a43 43 0 0 1-3.813 2.9l-.643.44-.647-.44a44 44 0 0 1-3.81-2.9c-.919-.783-2.692-2.584-3.34-3.386C2.807 11.53 1.967 9.94 1.629 8.386 1.506 7.82 1.46 6.76 1.534 6.24a5.56 5.56 0 0 1 3.57-4.424c.868-.323 2.06-.412 2.998-.225'
          transform='matrix(1 0 0 -1 0 21.785)'
        ></path>
      </g>
    </svg>
  );
};
