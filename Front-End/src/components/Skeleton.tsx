type Props = { className?: string };
export default function Skeleton({ className = '' }: Props) {
  return (
    <div
      className={`relative overflow-hidden rounded bg-slate-200 ${className}`}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/50 to-transparent" />
    </div>
  );
}
