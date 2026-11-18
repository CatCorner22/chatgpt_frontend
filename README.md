# Focus

A design studio for finding a visual direction, making it your own, and checking the result. This version builds on the supplied Focus project and includes an independent North Star kit.

## Run locally

Use Node 22.12 or newer and npm. No environment file or account is required for the local studio.

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 3000
```

Open http://localhost:3000. The npm lockfile is authoritative; the original Bun lockfile is retained only as part of the supplied project history.

## What works without a backend

- Match a brief against 43 authored design directions.
- Choose and refine colors, fonts, scale, spacing, shape, layout, and detail using deterministic local options.
- Edit your actual business name, headline, services, call to action, and optional customer quote.
- Save designs automatically in this browser, resume them, and use the existing library and undo controls.
- Build a working page in Studio, Editorial, Product, Showcase, or Journal; download the same HTML seen in the preview and editable linked CSS.
- Back up and restore your design library with the actual image files, saved versions, and retained history.
- Download the original design brief and specification ZIP for your coding tool.
- Choose **Restyle my existing site or app** at the start or at handoff. Download a scoped trial pack with preservation and undo guides; no public URL or source upload is needed.
- Use the Quality lab at `/quality` to inspect pasted HTML locally, view measurement limits, and download a JSON receipt.

Local design matching uses the existing design collection. It does not call a model or fabricate customer proof. Font previews may load public web fonts; the core studio does not need AI or account services.

## North Star kit

`north-star-kit/` is a separate strict TypeScript package with 47 evidence-bearing rules, 10 injectable DOM/CSSOM checks, fixtures, content validation, design labels, grading, bounded repair plans, receipts, token/pixel comparison, preference duels, and blind-review scoring.

The kit has only Zod as a runtime dependency. It can be copied out and installed independently. Read its `README.md`, `HONEST-REPORT.md`, `SOURCES.md`, and `BROWSER-TESTS.md` for the public API, evidence, and limitations. Snapshot checks cannot establish keyboard behavior, screen-reader support, temporal behavior, or suitability for intended users. These remain explicit review work.

## Verification

```sh
npm test
npx tsc --noEmit
npm run build
npm test --prefix north-star-kit
npm run typecheck --prefix north-star-kit
```

With the development server running and Chromium installed:

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

Use `FOCUS_TEST_URL` to test another local port. Browser smoke tests exercise the local creation flow, real copy editing, Markdown/ZIP downloads, persistence, skipped-question resume, keyboard skip link, mobile reflow, and quality receipts. They write evidence and screenshots to `artifacts/`.

## Optional cloud features

Accounts, account sync, public sharing, and monitoring require a configured Supabase backend. See `.env.example` and `PORTABILITY.md`. Database migrations and generated backend files are preserved from the supplied project. They were not deployed or tested against a live database here.

Paid AI remains explicitly paused by the existing project policy. Enabling paid services, configuring production credentials, and deploying publicly are separate owner decisions. Missing credentials do not block the local design studio.

Read [Launch verification](docs/LAUNCH-READINESS.md) for the current release scope and evidence. The [Root Cause Debugger report](docs/ROOT-CAUSE-DEBUGGER.md) records the latest reproduced failures, causal evidence, corrections and customer review. Earlier implementation notes remain in `docs/BUILD-REVIEW.md` and `docs/NORTH-STAR-PROGRESS.md`.

For delivery to a customer, follow [Customer handoff](docs/CUSTOMER-HANDOFF.md). It distinguishes editable website files, private source snapshots, and restorable library backups, with checks for the receiving browser.

For an existing project, read [Existing-project hardening](docs/EXISTING-SITE-HARDENING.md). The pack exposes namespaced values first; semantic theme mapping is a separate opt-in after checking the customer's component color pairs. Try one page on a backup or preview, test its original tasks and contrast, and demonstrate undo before expanding the change. The ZIP does not install itself or verify arbitrary customer applications.

## North Star: working output and independent review

Working-page HTML/ZIP exports now include five compositions, owner imagery and real action destinations. In the final studio step, use the working preview; the original specification tools remain available in the expandable handoff section.

```sh
npm run test:authored
npm run audit:browser -- --file artifacts/authored-pages/studio.html --out artifacts/my-audit
npm run test:audit
npm run benchmark -- init benchmark/organizer.json
npm run test:benchmark
```

Quality lab imports rendered browser receipts. The Review room (`/review-room`, under Explore) collects a neutral packet prepared from real benchmark pages. Read [North Star progress](docs/NORTH-STAR-PROGRESS.md), [browser audit instructions](docs/AUDIT-RUNNER.md), and [independent-review instructions](docs/BENCHMARK-REVIEW.md). These additions support the evaluation process; no human-equivalence result has been established.


## Verify the built app locally

The release checks run the generated Cloudflare Worker locally, without deploying it or signing in:

```sh
npm run build
WRANGLER_SEND_METRICS=false npx --yes wrangler@4.164.0 dev --config .output/server/wrangler.json --local --port 4173
```

Stop this preview before rebuilding, then restart it against the new build. Keeping an old Worker process alive while replacing its hashed assets can leave the local preview requesting files from the previous build.

With that preview running, the same browser harnesses accept `FOCUS_TEST_URL=http://localhost:4173`:

```sh
FOCUS_TEST_URL=http://localhost:4173 node scripts/browser-smoke.mjs
FOCUS_TEST_URL=http://localhost:4173 node scripts/test-authored-pages.mjs
FOCUS_TEST_URL=http://localhost:4173 node scripts/test-reference-editor.mjs
FOCUS_TEST_URL=http://localhost:4173 node scripts/test-library-transfer.mjs
FOCUS_TEST_URL=http://localhost:4173 node scripts/test-studio-recovery.mjs
FOCUS_TEST_URL=http://localhost:4173 node scripts/test-history-transfer.mjs
FOCUS_TEST_URL=http://localhost:4173 node scripts/test-local-taste.mjs
FOCUS_TEST_URL=http://localhost:4173 node scripts/test-customer-handoff.mjs
FOCUS_TEST_URL=http://localhost:4173 node scripts/test-integration-mode.mjs
FOCUS_TEST_URL=http://localhost:4173 node scripts/test-existing-transfer.mjs
```

The editor harness uses the screenshots generated by `test-authored-pages.mjs`. The library/recovery harnesses create their own fixtures. Core smoke, authored-page, library-transfer, studio-recovery and customer-handoff harnesses also accept `FOCUS_BROWSER=firefox` after `npx playwright-core install firefox`. The customer-handoff harness extracts actual UI downloads and opens them in a fresh browser context. The audit runner itself uses Chromium's isolated execution world. See the launch report for covered browsers and remaining external-service checks.

The latest Lovable kit and Devin's judge report were compared against this code rather than copied over it. Findings and dispositions are in [the kit comparison](docs/LOVABLE-KIT-COMPARISON.md) and [browser triage](docs/DEVIN-BROWSER-TRIAGE.md). Neither automated checks nor the Audi/Firehouse references establish human indistinguishability.
