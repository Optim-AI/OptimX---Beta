// BackButton.tsx
// Back navigation button for poster/video session pages

import React from 'react';
import { useRouter } from 'next/router';

type BackButtonProps = {
  href?: string;
  label?: string;
  onClick?: () => void;
};

export default function BackButton({
  href = '/brand-studio',
  label = 'Back to Brand Studio',
  onClick,
}: BackButtonProps) {
  const router = useRouter();

  function handleClick() {
    if (onClick) {
      onClick();
    } else {
      router.push(href);
    }
  }

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors"
      style={{ color: '#FAFAFA' }}
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 19l-7-7 7-7"
        />
      </svg>
      <span>{label}</span>
    </button>
  );
}
