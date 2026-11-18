# Run Focus on your machine

Focus has a browser-only studio that does not require accounts, API keys, or a database. Choose a starter, refine its design, save in this browser, and export a design pack. Cloud sync, live site reviews, shared links, and monitoring need a configured backend.

## Local development

Use Node.js 22.12 or newer (Node.js 24 recommended) and npm.

```sh
npm ci
npm run dev -- --host 0.0.0.0
```

Open the address printed by Vite. No `.env` file is needed for local mode. Browser storage stays on that browser and origin; export important work before clearing site data. This is local persistence, not a cloud backup.

```sh
npm test
npm run build
```

The npm lockfile is the reproducible dependency source for this portable distribution.

## Optional cloud features

Copy `.env.example` to `.env`, then set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the browser, and `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` for server requests to the same project. Private server keys never use the `VITE_` prefix. The existing schema migrations describe the backend; exporting this source does not move existing accounts or rows.

Paid AI remains paused in `src/lib/ai-policy.ts`. Adding a provider key does not enable spending. The studio's curated directions and manual choices work without AI.

| Optional capability | Configuration / location |
| --- | --- |
| Accounts and cloud project sync | Supabase configuration in `.env.example` |
| Public shares and signed export tags | Supabase; `FOCUS_SIGNING_KEY` for tag signing |
| AI service | `src/lib/ai.server.ts`; `AI_PROVIDER`; still paused by policy |
| Weekly site monitor | Scheduler calling the existing endpoint with `LOVABLE_CRON_SECRET` |
| Hosting | TanStack Start build; configure a suitable Nitro deployment target |
| Preview fonts | Google Fonts, with CSS system-font fallbacks if unavailable |

Cloud credentials, public deployment, live payments, and migration of hosted data are separate setup steps. No cloud service is provisioned by running this project.
