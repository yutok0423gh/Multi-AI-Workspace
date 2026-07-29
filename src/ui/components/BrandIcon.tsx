export function BrandIcon({
  className,
  tone = 'brand',
}: {
  className?: string;
  tone?: 'brand' | 'pinning';
}) {
  const background = tone === 'pinning' ? '#9A4E3F' : '#29463D';

  return (
    <svg
      className={className}
      data-maw-brand-icon="true"
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="2" y="2" width="60" height="60" rx="14" fill={background} />
      <rect
        x="5.5"
        y="5.5"
        width="53"
        height="53"
        rx="11"
        fill="none"
        stroke="#F5F4EC"
        strokeOpacity=".24"
      />
      <path
        data-letter="m"
        d="M13 26V14l9.5 8L32 14l9.5 8L51 14v12"
        fill="none"
        stroke="#F8F7F0"
        strokeWidth="4.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <path
        data-letter="w"
        d="M13 38v12l9.5-8L32 50l9.5-8L51 50V38"
        fill="none"
        stroke="#F8F7F0"
        strokeWidth="4.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <path d="M17 32h30" stroke="#F8F7F0" strokeOpacity=".42" />
    </svg>
  );
}
