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
const Logo: FC<LogoInterface> = ({ className }) => {
  // Props
  // const needs_text = with_text === true || undefined ? true : false;

  // Main JSX
  return (
    <Link href='/' className='inline-block'>
      <Image
        priority
        width={100}
        height={100}
        className={`h-auto relative ${className}`}
        alt='Codex Christi Main Logo'
        src='/media/img/general/logo.svg'
        onContextMenu={(event: MouseEvent<HTMLImageElement>) => {
          event.preventDefault();
        }}
        onDragStart={(event: MouseEvent<HTMLImageElement>) => {
          event.preventDefault();
        }}
      />
    </Link>
  );
};

export default Logo;
