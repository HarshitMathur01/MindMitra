import React from 'react';

interface ActSkipProps {
  label?: string;
  onClick: () => void;
}

export default function ActSkip({ label = 'Skip', onClick }: ActSkipProps) {
  return (
    <button
      onClick={onClick}
      className="absolute top-5 right-5 text-white/50 text-sm hover:text-white/80 transition-colors z-50 px-3 py-1.5 rounded-full border border-white/10 hover:border-white/25 backdrop-blur-sm"
    >
      {label}
    </button>
  );
}
