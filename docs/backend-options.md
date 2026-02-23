# Backend Implementation Options: Personal Recipe Book

This document compares backend approaches for expanding the cookbook page into a personal recipe book that stores user-inputted recipes and visualizes them as a graph network (like the main landing page).

---

## Option 1: Supabase (PostgreSQL + Auth)

**Architecture:** Managed Postgres on AWS, built-in Auth, Row Level Security (RLS), real-time subscriptions, and file storage — all accessible via a REST/JS SDK.

**How it fits:**

- Recipes stored as rows in a `recipes` table with an `ingredients` JSONB column
- Each ingredient maps to nodes in the existing `flavor_pairings.json` — query for matches and build a user-specific graph overlay on top of the main graph
- Auth handles "personal" recipe books per user (Google/GitHub OAuth in ~30 min)
- Supabase's JS client works directly from Next.js API routes or Server Components

**Schema sketch:**

```sql
recipes(id, user_id, title, ingredients[{name, nodeId}], instructions, created_at)
```

**Pros:**

- Best-in-class for Next.js — official `@supabase/ssr` package handles cookies/sessions
- SQL lets you do complex ingredient queries (e.g. "recipes using lemon")
- RLS means user A can never see user B's recipes — enforced at DB level
- Real-time: recipe list auto-updates across tabs
- Free tier is generous (500 MB DB, 50k MAU, 5 GB bandwidth)

**Cons:**

- Slightly more setup than Firebase (need to configure RLS policies)
- Paused projects after 1 week of inactivity on free tier (hackathon risk)
- Vendor lock-in to Supabase ecosystem

**Cost:** Free tier covers everything for a hackathon. Production: $25/month Pro plan.

---

## Option 2: Firebase (Firestore + Auth)

**Architecture:** Google's NoSQL document database + Auth, globally distributed, real-time by default.

**How it fits:**

- Each recipe is a Firestore document under `/users/{userId}/recipes/{recipeId}`
- Ingredients stored as an array field; resolved against local `flavor_pairings.json` on the client
- Firebase Auth handles login (Google sign-in is ~10 lines of code)

**Schema sketch:**

```
/users/{uid}/recipes/{recipeId}: {
  title, instructions,
  ingredients: [{name, nodeId, category}],
  createdAt
}
```

**Pros:**

- Fastest to set up for auth + storage (Google ecosystem, great docs)
- Real-time listeners are first-class citizens
- No server needed — SDK talks directly to Firestore from the browser
- Free tier: 1 GB storage, 50k reads/day, 20k writes/day

**Cons:**

- NoSQL: no complex queries across ingredients (can't do "find all recipes with both lemon and garlic" without denormalizing)
- Firestore pricing is per-operation — can get expensive at scale
- Firebase SDK is heavier than Supabase's
- Less natural fit with Next.js App Router server-side patterns

**Cost:** Free tier (Spark plan) covers hackathon use. Production Blaze plan is pay-as-you-go (~$0.06/100k reads).

---

## Option 3: Neon (Serverless Postgres) + NextAuth.js

**Architecture:** Serverless Postgres (branches like Git, scales to zero), with NextAuth.js handling sessions via JWT stored in cookies. All API logic lives in your own Next.js API routes.

**How it fits:**

- Full ownership of the data model — no vendor magic
- Neon's connection pooling works well with Next.js serverless functions
- NextAuth adapts to Neon via the official Prisma adapter
- Graph data: query ingredient `nodeId`s from recipes and merge with the base `flavor_pairings.json` graph at request time

**Schema sketch:**

```sql
CREATE TABLE recipes (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,  -- NextAuth session user id
  title TEXT,
  instructions TEXT,
  ingredients JSONB,      -- [{name, nodeId, category}]
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Pros:**

- Full control — no vendor-specific SDK patterns
- Neon branches: create a "dev" DB branch instantly without affecting prod
- Scales to zero (no idle costs)
- Postgres is the most portable choice long-term
- Free tier: 0.5 GB storage, 191.9 compute hours/month

**Cons:**

- Most setup work — you wire up NextAuth, Prisma/Drizzle ORM, and Neon yourself
- Cold starts on Neon free tier can be ~500ms
- NextAuth config is boilerplate-heavy for a hackathon

**Cost:** Free tier covers hackathon. Production: $19/month Launch plan.

---

## Option 4: localStorage / IndexedDB (No Backend)

**Architecture:** Recipes stored entirely client-side in the browser using `localStorage` (small data) or `IndexedDB` (structured, larger). No server, no auth, no database.

**How it fits:**

- Recipe objects serialized to JSON and stored under a key in localStorage
- Graph is built on the fly by resolving ingredient names against the already-loaded `flavor_pairings.json` graph data
- No user accounts — the recipe book is tied to the browser

**Pros:**

- Zero setup, zero cost, zero infrastructure
- Instant reads/writes (no network)
- Works offline
- No GDPR/data compliance concerns
- Perfect scope for a hackathon demo

**Cons:**

- Data is lost if user clears browser storage
- Not accessible on other devices or browsers
- No sharing between users
- localStorage limited to ~5 MB; IndexedDB is more but complex to usevvc

**Cost:** $0 forever.

---

## Summary Comparison


|                    | Supabase   | Firebase       | Neon + NextAuth | localStorage |
| ------------------ | ---------- | -------------- | --------------- | ------------ |
| **Setup time**     | ~2 hrs     | ~1.5 hrs       | ~4 hrs          | ~30 min      |
| **Auth included**  | Yes        | Yes            | Needs NextAuth  | No           |
| **Cross-device**   | Yes        | Yes            | Yes             | No           |
| **Query power**    | SQL (high) | NoSQL (medium) | SQL (high)      | JS only      |
| **Real-time**      | Yes        | Yes            | No (polling)    | N/A          |
| **Free tier**      | Generous   | Generous       | Moderate        | Unlimited    |
| **Next.js fit**    | Excellent  | Good           | Excellent       | Excellent    |
| **Hackathon risk** | Low        | Low            | Medium          | Very Low     |


**Recommendation:** For a hackathon, **Supabase** gives the best ratio of power-to-setup-time. Its `@supabase/ssr` package has first-party Next.js App Router support, auth is trivial to add, and the free tier won't pause mid-demo as long as the project was active recently. If zero risk is the priority and browser-only persistence is acceptable, **localStorage** gets the graph visualization working in under an hour.