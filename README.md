# Culinary Cosmos

[![Live Demo](https://img.shields.io/badge/Live%20Demo-culinary--cosmos.vercel.app-black?style=flat&logo=vercel)](https://culinary-cosmos.vercel.app)

An interactive network visualization of flavour pairings, extracted from *[The Flavor Bible](https://www.amazon.com/Flavor-Bible-Essential-Creativity-Imaginative/dp/0316118400)* (Dornenburg & Page, 2008) and powered by AI-assisted ingredient search.

## Screenshot

![Culinary Cosmos landing page](public/screenshot.png)

## Why This Project Matters

Food and flavour pairing is traditionally locked inside dense culinary books, requiring years of training to internalize. **Culinary Cosmos makes this knowledge universally accessible** — a single interactive graph that lets anyone, from home cooks to professional chefs, instantly explore thousands of ingredient relationships.

### Impact

- **Democratizes culinary expertise** — The flavour pairing data from *[The Flavor Bible](https://www.amazon.com/Flavor-Bible-Essential-Creativity-Imaginative/dp/0316118400)* represents decades of chef knowledge. This tool puts that knowledge in an intuitive visual format anyone can explore without any culinary background.
- **Accelerates creative cooking** — Instead of flipping through a 400-page reference book, cooks can click a single ingredient and immediately see every compatible pairing, ranked by strength, grouped by category.
- **Reduces food waste** — By showing what an ingredient pairs with, the app helps people actually use what they have on hand rather than defaulting to familiar recipes or discarding overlooked items.
- **AI-augmented discovery** — The Gemini-powered search can suggest novel ingredient combinations beyond the book's dataset, surfacing emerging or cross-cultural pairings that traditional references miss.
- **Educational tool** — The graph structure makes abstract flavour relationships concrete and explorable, helping students, culinary trainees, and food-curious people build genuine flavour intuition.

### The Data

The underlying dataset contains **1,757 ingredients** and **15,830 pairing edges** extracted from *[The Flavor Bible](https://www.amazon.com/Flavor-Bible-Essential-Creativity-Imaginative/dp/0316118400)*, one of the most comprehensive flavour pairing references ever published. Each edge is weighted by recommendation strength — from general pairings up to "Holy Grail" affinities that the book singles out as exceptional combinations.

## Setup

```bash
npm install
```

## Run

```bash
npm run dev    # Development (http://localhost:3000)
npm run build  # Production build
npm start      # Start production server
```

From the home page, explore the interactive flavour pairing network directly. Use the **search bar** to look up any ingredient or ask Gemini for AI-powered pairing suggestions.

## Features

- **Force-directed graph** — 1,757 ingredient nodes laid out by pairing relationships, colour-coded by food category
- **Category filtering** — Show/hide any of 16 food categories (Herbs & Spices, Seafood, Dairy, etc.) with a single click
- **Ingredient search** — Fuzzy search to instantly find and focus any ingredient
- **AI-powered search** — Ask Gemini questions like "what goes with miso and butter?" to get AI-suggested ingredient highlights
- **Pairing details** — Click any node to see all its pairings ranked by strength with ★ indicators for top recommendations
- **Holy Grail pairings** — A curated panel of the highest-rated pairings from the dataset
- **Recipe search** — Jump directly to Google recipe results for any selected ingredient combination

## Folder Structure

```
├── src/
│   ├── app/                # Next.js App Router
│   │   ├── layout.tsx      # Root layout
│   │   ├── page.tsx        # Home (/)
│   │   ├── globals.css     # Global styles (Tailwind)
│   │   └── graph/
│   │       └── page.tsx    # Flavour graph (/graph)
│   ├── components/         # Reusable UI components
│   ├── data/               # Constants, theme (src)
│   ├── hooks/              # Custom React hooks
│   ├── types/              # TypeScript types
│   └── utils/              # Helpers
├── data/                   # Graph data (CSV)
│   ├── nodes.csv           # Node definitions
│   ├── edges.csv           # Pairing links
│   └── README.md           # CSV format docs
├── public/
│   └── screenshot.png      # App screenshot
├── next.config.ts
├── tailwind.config.ts
├── package.json
└── tsconfig.json
```

## Path Alias

Use `@/` for `src/` in imports:

```ts
import { Button } from "@/components";
// Graph data loads from /data/nodes.csv and /data/edges.csv via GET /api/graph-data
```

## Adding Routes

Create folders under `src/app/`, e.g. `src/app/about/page.tsx` → `/about`.

## Data Source

Flavour pairing data extracted from **[The Flavor Bible](https://www.amazon.com/Flavor-Bible-Essential-Creativity-Imaginative/dp/0316118400)** (Dornenburg & Page, 2008) using a custom PDF extraction pipeline. See `[data/README.md](data/README.md)` for details on the dataset structure and how to regenerate it.