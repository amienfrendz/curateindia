"use client";
import { useState } from "react";

export default function ShareButton({ name, slug }: { name: string; slug: string }) {
  const [copied, setCopied] = useState(false);
  const url = `https://curateindia.vercel.app/stays/${slug}`;
  const text = `Check out ${name} on CurateIndia`;

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: name, text, url });
        return;
      } catch {
        // User cancelled — fall through to copy
      }
    }
    // Fallback for desktop without Web Share API
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-ink-800 hover:bg-ink-700 border border-hairline transition-colors"
      title="Share this stay"
    >
      {/* Native share icon — works across iOS/Android/Windows */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </svg>
      {copied ? "Copied!" : "Share"}
    </button>
  );
}
