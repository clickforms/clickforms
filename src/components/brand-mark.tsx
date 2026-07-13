/** Clickforms brand mark — green rounded square with three form-field lines. */
export function BrandMark({ size = 28, id = 'brand' }: { size?: number; id?: string }) {
  const gradId = `${id}-grad`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="1" y="1" width="30" height="30" rx="8" fill={`url(#${gradId})`} />
      <path d="M8 11h16" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M8 16h10" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M8 21h16" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <defs>
        <linearGradient id={gradId} x1="1" y1="1" x2="31" y2="31">
          <stop stopColor="#00c471" />
          <stop offset="1" stopColor="#008f52" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** Full lockup: mark + “Clickforms” wordmark (raster), for headers/emails that need the PNG. */
export function BrandLogo({
  height = 28,
  className,
  priority = false,
}: {
  height?: number;
  className?: string;
  priority?: boolean;
}) {
  const width = Math.round(height * (666 / 184));
  return (
    // biome-ignore lint/performance/noImgElement: static brand lockup from /public; next/image adds little here
    <img
      src="/brand/logo.png"
      alt="Clickforms"
      height={height}
      width={width}
      className={className}
      decoding="async"
      {...(priority ? { fetchPriority: 'high' as const } : null)}
    />
  );
}
