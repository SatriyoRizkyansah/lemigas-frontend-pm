import { LoadingCard } from "./LoadingCard";

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return <LoadingCard label={label} />;
}
