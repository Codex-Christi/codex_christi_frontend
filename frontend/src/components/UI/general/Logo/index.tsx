'use client';
import { FC } from 'react';
import Image from 'next/image';
import { MouseEvent } from 'react';
import Link from 'next/link';

// Main Component
const Logo: FC<{ with_text?: boolean | undefined }> = ({ with_text }) => {
  // Props
  const needs_text = with_text === true || undefined ? true : false;

  // Main JSX
  return (
    <Link href='/' className='flex items-end'>
      <Image
        priority
        width={112}
        height={104}
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
        !font-ocr font-[900] mb-[0.3rem] 
        -ml-[.75rem] text-[1.275rem]`}
        >
          <span>Codex</span>
          <span>Christi</span>
        </span>
      )}
    </Link>
  );
};

export default Logo;
