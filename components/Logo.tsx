type Props = { size?: number; className?: string };

export default function Logo({ size = 40, className }: Props) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/images/lemigas.webp" alt="Logo LEMIGAS" width={size} height={size} className={className} />;
}
