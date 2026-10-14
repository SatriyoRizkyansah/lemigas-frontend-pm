// Siluet fasilitas migas sederhana (garis), dipakai di sidebar dan halaman login.
export default function Skyline({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 240 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 62V34h14v28M30 62V22h10v40M44 62V30h8v32" />
      <path d="M62 62V40c0-14 10-22 24-22s24 8 24 22v22" />
      <path d="M118 62V34h14v28M138 62V44h12v18M156 62V28h12v34" />
      <path d="M176 62V26h10v36M190 62V32h10v30M206 62V20h10v42" />
      <path d="M211 20V8" />
      <circle cx="211" cy="5" r="3.5" />
      <path d="M4 62h232" />
    </svg>
  );
}
