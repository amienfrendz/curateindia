export function SkeletonImage({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-2xl bg-ink-800 ${className}`} />;
}

export function SkeletonText({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded h-4 ${className}`} />;
}

export function SkeletonChip() {
  return <div className="skeleton rounded-full h-6 w-20" />;
}

export function SkeletonCard() {
  return (
    <div className="space-y-3">
      <SkeletonImage className="aspect-[4/5] w-full" />
      <SkeletonText className="w-3/4" />
      <SkeletonText className="w-1/2 h-3" />
    </div>
  );
}

export function SkeletonClusterTile() {
  return (
    <div className="relative aspect-[4/5] rounded-2xl skeleton overflow-hidden" />
  );
}

export function SkeletonReviewBlock() {
  return (
    <div className="space-y-3">
      <SkeletonText className="w-32 h-3" />
      <SkeletonText className="w-full" />
      <SkeletonText className="w-5/6" />
      <SkeletonText className="w-1/2 h-3" />
    </div>
  );
}

export function SkeletonAvailability() {
  return (
    <div className="glass rounded-2xl p-5 space-y-3">
      <SkeletonText className="w-24 h-3" />
      <SkeletonText className="w-2/3 h-5" />
      <div className="flex gap-2 pt-2">
        <SkeletonChip />
        <SkeletonChip />
        <SkeletonChip />
      </div>
    </div>
  );
}
