import { BRAND_PRIMARY } from '@/components/brand-colors';

/**
 * Clickforms brand mark — solid green rounded square with a white "C" monogram.
 * `id` is accepted (unused) for backward compatibility with existing call sites that
 * pass a unique id per instance — no longer needed now the fill is solid, not a gradient.
 */
export function BrandMark({ size = 28 }: { size?: number; id?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="0" y="0" width="32" height="32" rx="8" fill={BRAND_PRIMARY} />
      <text
        x="16"
        y="23"
        fontFamily="Poppins, Arial, sans-serif"
        fontWeight="800"
        fontSize="19"
        fill="#111111"
        textAnchor="middle"
      >
        C
      </text>
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
