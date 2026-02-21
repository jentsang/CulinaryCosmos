# FlavorNetwork

Next.js web app for network visualization of flavour pairings.

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

From the home page, open **"View Flavour Graph"** or navigate to `/graph` to explore the interactive flavour pairing network.

## Folder structure

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
├── next.config.ts
├── tailwind.config.ts
├── package.json
└── tsconfig.json
```

## Path alias

Use `@/` for `src/` in imports:

```ts
import { Button } from "@/components";
// Graph data loads from /data/nodes.csv and /data/edges.csv via GET /api/graph-data
```

## Adding routes

Create folders under `src/app/`, e.g. `src/app/about/page.tsx` → `/about`.
