'use client';

import { FC, useCallback, useMemo, useState, useEffect } from 'react';
import useAuthStore from '@/store/authStore';

export const CartIcon: FC = () => {
  // Hooks
  const { isAuthenticated } = useAuthStore();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  //   Funcs
  const getApproxCartItems = useCallback(() => {
    if (isClient) {
      const randomNum = Math.floor(Math.random() * (10 - 1 + 1)) + 1;

      const approxString = randomNum >= 9 ? '9+' : randomNum;

      return approxString;
    }
  }, [isClient]);

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
