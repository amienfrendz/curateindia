import Link from "next/link";
import type { Cluster } from "@/types";
import ClusterImage from "./ClusterImage";

export default function ClusterTile({ cluster }: { cluster: Cluster }) {
  return (
    <Link
      href={`/clusters/${cluster.slug}`}
      className="group relative overflow-hidden rounded-2xl border-hairline border block aspect-[4/5] hover:border-ink-300/30 transition-colors"
    >
      <ClusterImage
        imageUrl={cluster.imageUrl}
        query={`${cluster.name} india ${cluster.tagline}`}
        alt={cluster.name}
        className="absolute inset-0"
      />
      <div className={`absolute inset-0 bg-gradient-to-t ${cluster.accent} opacity-50`} />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/40 to-transparent" />

      <div className="absolute inset-0 p-5 flex flex-col justify-between">
        <div className="text-2xl">{cluster.icon}</div>
        <div>
          <div className="font-display text-2xl leading-tight text-balance">
            {cluster.shortName}
          </div>
          <div className="text-xs text-muted mt-1 line-clamp-2 text-balance">
            {cluster.tagline}
          </div>
        </div>
      </div>
    </Link>
  );
}
