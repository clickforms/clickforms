export function BrandMark({ size = 28, id = 'brand' }: { size?: number; id?: string }) {
  const gradId = `${id}-grad`;
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="24" height="24" rx="7" fill={`url(#${gradId})`} />
      <path d="M8 9.5h12M8 14h8M8 18.5h10" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <defs>
        <linearGradient id={gradId} x1="2" y1="2" x2="26" y2="26">
          <stop stopColor="#00c471" />
          <stop offset="1" stopColor="#008f52" />
        </linearGradient>
      </defs>
    </svg>
  );
}
