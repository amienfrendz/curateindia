"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { Property, SearchHit } from "@/types";
import { getCluster } from "@/data/clusters";
import { SkeletonCard } from "./Skeletons";
import PropertyImage from "./PropertyImage";

const SUGGESTIONS = [
  "A haveli in Rajasthan with Manganiar music evenings",
  "Bird-watching homestay near Eaglenest under ₹5k",
  "Where can I learn Chettinad cooking from the family that owns the house?",
  "Stargazing in Ladakh with a telescope and a Ladakhi family",
  "Slow living near a tea estate with no Wi-Fi",
  "Tribal homestay where my stay funds the village",
];

type Phase = "idle" | "thinking" | "results";

type ResultPayload = {
  intent?: string;
  hits: (SearchHit & { property: Property })[];
};

export default function ConversationalSearch({ minimal = false }: { minimal?: boolean }) {
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [intent, setIntent] = useState<string>("");
  const [hits, setHits] = useState<ResultPayload["hits"]>([]);
  const [error, setError] = useState<string>("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function submit(query: string) {
    if (!query.trim()) return;
    setPhase("thinking");
    setError("");
    setHits([]);
    setIntent("");
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) {
        let errMsg = "Search failed";
        try {
          const body = await res.json();
          if (body?.error) errMsg = body.error;
        } catch {
          // non-JSON response, use status text
        }
        throw new Error(errMsg);
      }
      const data: ResultPayload = await res.json();
      setIntent(data.intent || "");
      setHits(data.hits || []);
      setPhase("results");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setPhase("idle");
    }
  }

  return (
    <div className={minimal ? "" : "max-w-3xl mx-auto w-full"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="glass rounded-3xl p-2 pl-5 pr-2 flex items-end gap-2"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={1}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 200) + "px";
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(input);
            }
          }}
          placeholder="Tell me what you want — landscape, mood, food, budget, vibe…"
          className="flex-1 bg-transparent outline-none resize-none py-3 text-base placeholder:text-faint"
        />
        <button
          type="submit"
          disabled={phase === "thinking"}
          className="h-11 px-5 rounded-2xl bg-spice-500 hover:bg-spice-400 text-ink-900 font-medium text-sm disabled:opacity-50 transition-colors"
        >
          {phase === "thinking" ? "Curating…" : "Ask"}
        </button>
      </form>

      {phase === "idle" && !minimal && (
        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setInput(s);
                submit(s);
              }}
              className="text-xs px-3 py-1.5 rounded-full border border-hairline text-muted hover:text-foreground hover:border-ink-300/30 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-6 p-4 rounded-2xl border border-red-900/40 bg-red-950/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      {phase === "thinking" && (
        <div className="mt-10 space-y-6 animate-fade-in">
          <div className="glass rounded-2xl p-5">
            <div className="text-xs uppercase tracking-wider text-spice-400 mb-2">
              Curating
            </div>
            <div className="skeleton h-4 rounded w-3/4 mb-2" />
            <div className="skeleton h-4 rounded w-1/2" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      )}

      {phase === "results" && (
        <div className="mt-10 animate-slide-up">
          {intent && (
            <div className="glass rounded-2xl p-5 mb-8">
              <div className="text-xs uppercase tracking-wider text-spice-400 mb-2">
                What I heard
              </div>
              <div className="text-base text-foreground/90">{intent}</div>
            </div>
          )}

          {hits.length === 0 ? (
            <div className="text-muted text-sm">
              No matches in our 50+ curated set. Try widening — e.g. drop a budget or add a state.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {hits.map((h) => (
                <ResultCard key={h.propertyId} hit={h} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultCard({ hit }: { hit: SearchHit & { property: Property } }) {
  const p = hit.property;
  const cluster = getCluster(p.clusters[0]);
  return (
    <Link href={`/stays/${p.slug}`} className="block group">
      <div className="relative aspect-[4/5] rounded-2xl overflow-hidden border-hairline border">
        <PropertyImage
          website={p.website}
          query={`${p.name} ${p.location} ${p.type}`}
          alt={p.name}
          className="absolute inset-0 transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-transparent to-transparent" />
        <div className="absolute top-3 left-3 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full glass">
          {p.type}
        </div>
        <div className="absolute bottom-0 inset-x-0 p-4">
          <div className="text-xs text-muted mb-1">
            {cluster?.icon} {p.location} · {p.state}
          </div>
          <div className="font-display text-xl leading-tight text-balance">{p.name}</div>
        </div>
      </div>
      <div className="text-xs text-sand-400 italic mt-2 line-clamp-3 leading-relaxed">
        {hit.reason}
      </div>
    </Link>
  );
}
