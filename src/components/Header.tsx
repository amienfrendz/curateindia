import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 glass border-b border-hairline">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="font-display text-2xl tracking-tight">
            curate<span className="text-spice-500">India</span>
          </span>
        </Link>
        <Link
          href="/search"
          className="text-xs uppercase tracking-wider px-3 py-1.5 rounded-full bg-spice-500/15 border border-spice-500/30 text-spice-400 hover:bg-spice-500/25 transition-colors"
        >
          Ask CurateIndia
        </Link>
      </div>
    </header>
  );
}
