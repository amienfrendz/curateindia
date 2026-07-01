# curateIndia

> Stay where India still lives.

A curated discovery layer for India's small, hosted, experience-led stays —
havelis, plantation bungalows, tribal homestays, houseboats, ashrams.
Conversational search, live web-grounded availability, real reviews. **No booking
middleperson** — we link out to Google, Booking, Airbnb, or the host's own site.

## Features

- **14 activity-based clusters** as the primary taxonomy (not destinations).
- **53 hand-picked properties** in `src/data/properties.ts` (≤10 rooms, hosted, experience-led).
- **Conversational search** powered by GitHub Models (OpenAI-compatible).
- **Live availability** badge — DuckDuckGo + LLM signal, deep-links to OTAs.
- **Live reviews** scraped from real sources (TripAdvisor, Booking, blogs).
- **Progressive loading** — every async surface has a skeleton; no layout shift.
- **Dark, modern UI** with Cormorant Garamond display + Inter body.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind
- GitHub Models inference endpoint (`https://models.github.ai/inference`)
- Zero database for now; `src/lib/repo.ts` is the single read path so the future
  Firestore/Cosmos migration changes only that file.

## Setup

```bash
cp .env.example .env.local
# edit .env.local, set GITHUB_TOKEN to a fine-grained PAT with "models:read" scope
npm install
npm run dev
```

Open <http://localhost:3000>.

## Project map

```
src/
├── app/
│   ├── page.tsx                 # Home — hero, clusters grid, featured stays
│   ├── search/page.tsx          # Full-page conversational search
│   ├── clusters/[slug]/page.tsx # Cluster detail + filtered grid
│   ├── stays/[slug]/page.tsx    # Property detail + reviews + availability
│   └── api/
│       ├── search/              # POST query → LLM-curated hits
│       ├── availability/        # GET slug → web-grounded inventory signal
│       ├── reviews/             # GET slug → highlights + verbatim quotes
│       └── image/               # GET url → og:image proxy
├── components/                  # All UI, including Skeletons.tsx
├── data/
│   ├── clusters.ts              # 14 activity clusters
│   └── properties.ts            # 53 curated stays
├── lib/
│   ├── repo.ts                  # Single read path (future-DB ready)
│   ├── githubModels.ts          # OpenAI SDK wrapper
│   └── bookingLinks.ts          # Deep-link builder
└── types/index.ts
```

## How the LLM is used

1. **`/api/search`** — sends a compact catalogue (id, name, clusters, blurb,
   location, rooms, priceTier) to the model with a strict JSON schema. Hits are
   validated against existing IDs to prevent hallucination.
2. **`/api/availability`** — scrapes 2 DuckDuckGo HTML SERPs for "<property>
   availability <month>", strips HTML, asks the model to classify into
   `likely-available | limited | likely-full | unknown` with a one-line note.
   30-min in-memory cache.
3. **`/api/reviews`** — dual SERP queries (general + tripadvisor/booking),
   model extracts highlights + verbatim quotes with source attribution.
   24-hour in-memory cache.

> **Production note:** in-memory caches need to be Redis / Vercel KV for
> multi-instance deploys.

## Data layer

`src/lib/repo.ts` is the only file that talks to property storage. To migrate
to Firestore or Cosmos:

1. Replace the `import` from `@/data/properties` with a Firestore client.
2. Implement the same five functions:
   `getAllProperties / getPropertyBySlug / getPropertiesByCluster / getFeaturedProperties / totalCount`.
3. Nothing else changes.

Each `Property` already has optional fields for the migration:
`addedAt`, `lastVerified`, `source` (editorial / aggregator / host-submitted /
community / llm-discovery), `status` (active / dormant / closed / candidate).

## Adding a property

Append to `src/data/properties.ts`. Required fields: `id`, `slug`, `name`,
`type` (whitelisted to small-property types — no resort/hotel), `location`,
`state`, `region`, `clusters` (1–3 from `ClusterSlug`), `signatureExperiences`
(3 bullets), `priceTier`, `blurb`, `unsplashId`. Optional but recommended:
`rooms`, `food`, `host`, `website`.

`generateStaticParams` in `app/stays/[slug]/page.tsx` will auto-pick it up at
build time.

## Roadmap

- Move catalogue to Firestore.
- Replace DuckDuckGo scrape with a proper search API (Bing / Brave).
- Per-property hero gallery (currently single image).
- Redis cache.
- Host self-submission flow.
- Periodic LLM-driven discovery loop to expand the catalogue automatically.

## License

Private MVP — © Amrita Rohatgi.
