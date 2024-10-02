'use client';
import { FC } from 'react';
import Image from 'next/image';
import { MouseEvent } from 'react';
import Link from 'next/link';

interface LogoInterface {
  with_text?: boolean | undefined;
  className?: string;
}

// Main Component
const Logo: FC<LogoInterface> = ({ with_text, className }) => {
  // Props
  const needs_text = with_text === true || undefined ? true : false;

  // Main JSX
  return (
    <Link href='/' className={`flex items-end ${className}`}>
      <Image
        priority
        width={91}
        height={84.5}
        alt='Codex Christi Main Logo'
        src='/media/img/general/logo-main.svg'
        onContextMenu={(event: MouseEvent<HTMLImageElement>) => {
          event.preventDefault();
        }}
        onDragStart={(event: MouseEvent<HTMLImageElement>) => {
          event.preventDefault();
        }}
      />
      {needs_text && (
        <span
          className={`max-w-[50px] flex flex-col items-center 
        !font-ocr font-[900] mb-[.75rem] leading-none
        -ml-[1.25rem] text-[1.05rem] text-shadow-lg shadow-white`}
        >
          <h4>Codex</h4>
          <h4>Christi</h4>
        </span>
      )}
    </Link>
  );
};

export default Logo;
