type Props = { size?: number; className?: string };

// Placeholder logo: ganti public/logo.svg dengan logo resmi LEMIGAS.
export default function Logo({ size = 40, className }: Props) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logo.svg" alt="" width={size} height={size} className={className} />;
}
