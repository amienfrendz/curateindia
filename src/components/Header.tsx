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
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider px-3 py-1.5 rounded-full bg-spice-500/15 border border-spice-500/30 text-spice-400 hover:bg-spice-500/25 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Ask CurateIndia
        </Link>
      </div>
    </header>
  );
}
