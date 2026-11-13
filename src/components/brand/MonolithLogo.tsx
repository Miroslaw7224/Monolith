import React, { useId } from "react";

interface MonolithLogoProps {
  size?: number;
  className?: string;
}

/**
 * Znak Monolith (wariant A): czarna płyta opasana świetlistą orbitą, z gwiazdą
 * nad szczytem i poświatą. Linie są pogrubione względem planszy projektowej,
 * żeby detale były widoczne już przy ~48 px. Ten sam rysunek jest w `app/icon.svg`.
 */
export function MonolithLogo({ size = 48, className }: MonolithLogoProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const line = `ml-line-${uid}`;
  const halo = `ml-halo-${uid}`;
  const star = `ml-star-${uid}`;
  const face = `ml-face-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 400 400"
      role="img"
      aria-label="Monolith"
      className={className}
    >
      <defs>
        <linearGradient id={line} gradientUnits="userSpaceOnUse" x1="30" y1="60" x2="370" y2="340">
          <stop offset="0" stopColor="#22D3EE" />
          <stop offset="0.55" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#E879F9" />
        </linearGradient>
        <radialGradient id={halo} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#8B5CF6" stopOpacity="0.55" />
          <stop offset="0.6" stopColor="#22D3EE" stopOpacity="0.12" />
          <stop offset="1" stopColor="#22D3EE" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={star} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={face} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1B1E30" />
          <stop offset="1" stopColor="#020308" />
        </linearGradient>
      </defs>
      <circle cx="200" cy="200" r="198" fill={`url(#${halo})`} />
      <ellipse
        cx="200"
        cy="262"
        rx="168"
        ry="46"
        fill="none"
        stroke={`url(#${line})`}
        strokeWidth="5"
        strokeOpacity="0.45"
      />
      <ellipse
        cx="200"
        cy="262"
        rx="130"
        ry="34"
        fill="none"
        stroke={`url(#${line})`}
        strokeWidth="9"
      />
      <circle cx="194" cy="36" r="36" fill={`url(#${star})`} />
      <circle cx="194" cy="36" r="11" fill="#FFFFFF" />
      <path d="M236 72l26 15v236l-26 13z" fill="#222640" />
      <path
        d="M152 72h84v264h-84z"
        fill={`url(#${face})`}
        stroke={`url(#${line})`}
        strokeWidth="7"
      />
      <path d="M152 72v264" stroke={`url(#${line})`} strokeWidth="16" strokeLinecap="round" />
      <path
        d="M70 262A130 34 0 0 0 330 262"
        fill="none"
        stroke={`url(#${line})`}
        strokeWidth="13"
        strokeLinecap="round"
      />
      <path
        d="M32 262A168 46 0 0 0 368 262"
        fill="none"
        stroke={`url(#${line})`}
        strokeWidth="5"
        strokeOpacity="0.8"
      />
      <circle cx="347" cy="285" r="15" fill="#22D3EE" />
      <circle cx="88" cy="279" r="11" fill="#E879F9" />
    </svg>
  );
}
