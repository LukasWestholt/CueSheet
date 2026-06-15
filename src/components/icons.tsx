// Inline SVG icons (Lucide-style, currentColor) used for functional controls.
// Emoji glyphs render inconsistently across platforms (especially iOS Safari,
// which colours ⏮/⏭/⏸ as emoji) and can't be themed, so structural icons are
// vector instead. Decorative text (in body copy) may still use plain glyphs.

type IconProps = { size?: number; className?: string };

function Svg({
  size = 24,
  className,
  fill = 'none',
  children,
}: IconProps & { fill?: string; children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

export function SkipBack(p: IconProps) {
  return (
    <Svg {...p} fill="currentColor">
      <polygon points="18 20 8 12 18 4 18 20" />
      <rect x="5" y="4" width="2.5" height="16" rx="1" />
    </Svg>
  );
}

export function SkipForward(p: IconProps) {
  return (
    <Svg {...p} fill="currentColor">
      <polygon points="6 4 16 12 6 20 6 4" />
      <rect x="16.5" y="4" width="2.5" height="16" rx="1" />
    </Svg>
  );
}

export function Play(p: IconProps) {
  return (
    <Svg {...p} fill="currentColor">
      <polygon points="6 3 20 12 6 21 6 3" />
    </Svg>
  );
}

export function Pause(p: IconProps) {
  return (
    <Svg {...p} fill="currentColor">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </Svg>
  );
}

export function Star({ filled, ...p }: IconProps & { filled?: boolean }) {
  return (
    <Svg {...p} fill={filled ? 'currentColor' : 'none'}>
      <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </Svg>
  );
}

export function Music(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </Svg>
  );
}

export function Link(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </Svg>
  );
}

export function AlertTriangle(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </Svg>
  );
}
