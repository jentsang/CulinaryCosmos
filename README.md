# FlavorNetwork

Next.js web app with **Cursor Cloud Agents API** integration (Composer 1.5) for launching and viewing AI coding agents.

## Setup

```bash
npm install
```

### Cursor API (Composer 1.5)

To use the Composer page (launch agents, view conversations):

1. Get an API key: [Cursor Dashboard → Integrations](https://cursor.com/dashboard?tab=integrations).
2. Copy `.env.example` to `.env.local` and set your key:
   ```bash
   cp .env.example .env.local
   # Edit .env.local: NEXT_PUBLIC_CURSOR_API_KEY=your_key_here
   ```
3. **Never commit `.env.local`** — it's in `.gitignore`. For production, use a backend proxy so the key isn't in the client.

## Run

```bash
npm run dev    # Development (http://localhost:3000)
npm run build  # Production build
npm start      # Start production server
```

From the home page, open **"Open Cursor Composer 1.5"** or navigate to `/composer` to launch agents and view conversations.

## Folder structure

```
├── src/
│   ├── app/                # Next.js App Router
│   │   ├── layout.tsx       # Root layout
│   │   ├── page.tsx        # Home (/)
│   │   ├── globals.css     # Global styles (Tailwind)
│   │   └── composer/
│   │       └── page.tsx    # Composer 1.5 (/composer)
│   ├── components/         # Reusable UI components
│   ├── constants/          # Config (Cursor API)
│   ├── services/           # API clients (Cursor Cloud Agents)
│   ├── hooks/              # Custom React hooks
│   ├── types/              # TypeScript types
│   └── utils/              # Helpers
├── next.config.ts
├── tailwind.config.ts
├── package.json
└── tsconfig.json
```

## Path alias

Use `@/` for `src/` in imports:

```ts
import { Button } from "@/components";
import { getCursorApiKey } from "@/constants/cursor";
```

## Adding routes

Create folders under `src/app/` for new routes, e.g. `src/app/about/page.tsx` → `/about`.
