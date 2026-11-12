import React, { useId } from "react";

interface MonolithLogoProps {
  size?: number;
  className?: string;
}

/**
 * Znak Monolith (wariant A): czarna płyta opasana orbitą na gradientowym kafelku.
 * Ten sam rysunek jest w `app/icon.svg`; zmieniając jeden, zmień drugi.
 */
export function MonolithLogo({ size = 40, className }: MonolithLogoProps) {
  const gradientId = `monolith-logo-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="Monolith"
      className={className}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22D3EE" />
          <stop offset="0.55" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#E879F9" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill={`url(#${gradientId})`} />
      <ellipse cx="24" cy="30" rx="18" ry="5.5" fill="none" stroke="#05060A" strokeWidth="2" />
      <rect x="18.5" y="8" width="11" height="30" rx="1" fill="#05060A" />
      <path
        d="M6 30A18 5.5 0 0 0 42 30"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
