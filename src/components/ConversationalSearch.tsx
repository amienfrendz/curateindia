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

const SESSION_KEY = "curateindia-search";

export default function ConversationalSearch({ minimal = false }: { minimal?: boolean }) {
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [intent, setIntent] = useState<string>("");
  const [hits, setHits] = useState<ResultPayload["hits"]>([]);
  const [error, setError] = useState<string>("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea whenever input changes (handles sessionStorage restore, mic, paste, etc.)
  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 150) + "px";
    }
  }, [input]);

  // Restore last search from sessionStorage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        const { query, intent: savedIntent, hits: savedHits } = JSON.parse(saved);
        if (query && savedHits?.length) {
          setInput(query);
          setIntent(savedIntent || "");
          setHits(savedHits);
          setPhase("results");
          return;
        }
      }
    } catch { /* ignore parse errors */ }
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
      // Persist to sessionStorage so back-navigation restores results
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
          query,
          intent: data.intent || "",
          hits: data.hits || [],
        }));
      } catch { /* storage full — ignore */ }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setPhase("idle");
    }
  }

  function clearSearch() {
    setInput("");
    setPhase("idle");
    setIntent("");
    setHits([]);
    setError("");
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
    inputRef.current?.focus();
  }

  return (
    <div className={minimal ? "" : "max-w-3xl mx-auto w-full min-w-0"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="glass rounded-2xl sm:rounded-3xl p-2 pl-3 sm:pl-5 pr-2 flex items-center gap-1 sm:gap-2 w-full min-w-0"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={1}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 150) + "px";
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(input);
            }
          }}
          placeholder="Describe what you want…"
          className="flex-1 min-w-0 bg-transparent outline-none resize-none py-3 text-base placeholder:text-faint break-words"
        />
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <MicButton onTranscript={(t) => { setInput((prev) => prev + t); }} />
          {phase === "results" && (
            <button
              type="button"
              onClick={clearSearch}
              className="h-9 sm:h-11 px-2.5 sm:px-4 rounded-lg sm:rounded-2xl bg-ink-800 hover:bg-ink-700 border border-hairline text-muted hover:text-foreground text-xs sm:text-sm transition-colors shrink-0"
              title="Clear and start fresh"
            >
              ✕
            </button>
          )}
          <button
            type="submit"
            disabled={phase === "thinking"}
            className="h-9 sm:h-11 px-3 sm:px-5 rounded-lg sm:rounded-2xl bg-spice-500 hover:bg-spice-400 text-ink-900 font-medium text-xs sm:text-sm whitespace-nowrap disabled:opacity-50 transition-colors shrink-0"
          >
            {phase === "thinking" ? "…" : "Ask"}
          </button>
        </div>
      </form>

      {phase === "idle" && !minimal && (
        <div className="mt-4 flex flex-wrap gap-2 justify-center max-w-full">
          {SUGGESTIONS.slice(0, 4).map((s) => (
            <button
              key={s}
              onClick={() => {
                setInput(s);
                submit(s);
              }}
              className="text-xs px-3 py-1.5 rounded-2xl sm:rounded-full border border-hairline text-muted hover:text-foreground hover:border-ink-300/30 transition-colors text-left max-w-full break-words"
            >
              {s}
            </button>
          ))}
          <details className="w-full sm:hidden">
            <summary className="text-xs text-muted cursor-pointer text-center mt-1">More ideas…</summary>
            <div className="mt-2 flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.slice(4).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setInput(s);
                    submit(s);
                  }}
                  className="text-xs px-3 py-1.5 rounded-2xl sm:rounded-full border border-hairline text-muted hover:text-foreground hover:border-ink-300/30 transition-colors text-left max-w-full break-words"
                >
                  {s}
                </button>
              ))}
            </div>
          </details>
          <div className="hidden sm:contents">
            {SUGGESTIONS.slice(4).map((s) => (
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
        <div className="mt-8 sm:mt-10 animate-slide-up">
          {intent && (
            <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-5 mb-6 sm:mb-8">
              <div className="text-xs uppercase tracking-wider text-spice-400 mb-2">
                What I heard
              </div>
              <div className="text-sm sm:text-base text-foreground/90">{intent}</div>
            </div>
          )}

          {hits.length === 0 ? (
            <div className="text-muted text-sm">
              No matches in our 50+ curated set. Try widening — e.g. drop a budget or add a state.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
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
    <Link href={`/stays/${p.slug}`} className="block group min-w-0">
      <div className="relative aspect-[4/5] rounded-xl sm:rounded-2xl overflow-hidden border-hairline border">
        <PropertyImage
          imageUrl={`/photos/${p.slug}/1.jpg`}
          website={p.website}
          query={`${p.name} ${p.location} ${p.type}`}
          alt={p.name}
          className="absolute inset-0 transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-transparent to-transparent" />
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 text-[9px] sm:text-[10px] uppercase tracking-wider px-2 py-1 rounded-full glass">
          {p.type}
        </div>
        <div className="absolute bottom-0 inset-x-0 p-3 sm:p-4">
          <div className="text-[10px] sm:text-xs text-muted mb-1 truncate">
            {cluster?.icon} {p.location} · {p.state}
          </div>
          <div className="font-display text-base sm:text-xl leading-tight text-balance">{p.name}</div>
        </div>
      </div>
      <div className="text-[11px] sm:text-xs text-sand-400 italic mt-2 leading-relaxed">
        {hit.reason}
      </div>
    </Link>
  );
}

function MicButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Hide mic on Edge (broken Web Speech API in v134-149, iOS Edge uses WebKit but also broken)
  const isEdge = typeof navigator !== "undefined" && /Edg[eA-Z]*\//i.test(navigator.userAgent);

  function cleanup() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    try { recognitionRef.current?.abort(); } catch {}
    recognitionRef.current = null;
    setListening(false);
  }

  async function toggle() {
    if (listening) {
      cleanup();
      return;
    }

    setError("");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Speech not supported — use keyboard dictation");
      return;
    }

    // Request mic permission first (required by Safari)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
    } catch {
      setError("Mic blocked — check browser permissions");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.continuous = false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript: string = event?.results?.[0]?.[0]?.transcript || "";
      if (transcript) onTranscript(transcript);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (e: any) => {
      const code = e?.error || "";
      try { recognitionRef.current?.abort(); } catch {}
      recognitionRef.current = null;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setListening(false);

      if (code === "network" || code === "service-not-allowed") {
        // Edge stable broke cloud speech — suggest Win+H or Chrome
        const isEdge = navigator.userAgent.includes("Edg/");
        if (isEdge) {
          setError("Edge voice is broken (known bug). Use Win+H to dictate, or try Chrome/Safari.");
        } else {
          setError("Speech service unavailable — check connection");
        }
      } else if (code === "not-allowed") {
        setError("Mic blocked — check browser permissions");
      } else if (code !== "aborted") {
        setError("Mic error: " + code);
      }
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    timeoutRef.current = setTimeout(() => cleanup(), 30000);
  }

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 5000);
    return () => clearTimeout(t);
  }, [error]);

  useEffect(() => {
    return () => {
      try { recognitionRef.current?.abort(); } catch {}
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (isEdge) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        className={`h-9 w-9 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl flex items-center justify-center transition-colors shrink-0 ${
          listening
            ? "bg-red-500/20 text-red-400 animate-pulse"
            : "bg-ink-800 hover:bg-ink-700 text-muted hover:text-foreground"
        }`}
        title={listening ? "Tap to stop" : "Speak your request"}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      </button>
      {error && (
        <div className="absolute bottom-full right-0 mb-2 w-56 p-2 rounded-lg bg-red-900/90 text-red-200 text-xs leading-snug z-50">
          {error}
        </div>
      )}
    </div>
  );
}

