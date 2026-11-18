# Customer transfer compatibility — November 17, 2026

## Observed result

The actual `buildPack` ZIP was read back with JSZip, all files verified inside `focus-restyle/`, and its extracted CSS used in Chromium. 172 generated CSS files parsed successfully; Tailwind v4 fixture compiled. 27 integration runs passed at 1280, 768 and 390 CSS pixels. The two new fixtures bundle and mount actual React 19, rather than simulating its event handlers.

| Fixture | Observed behavior | Compatibility limit |
|---|---|---|
| Plain CSS | Import alone inert; wrapper background, text and heading font opt in | Controls using literal colors need selective styling |
| Compiled Tailwind v4, runtime theme variables | Scoped primary and radius change; outside content unaffected | Build-time inlined colors cannot respond to runtime variables |
| Older HSL-variable theme | Legacy bridge renders valid HSL colors | Use only legacy bridge; never load both bridges |
| Fixed-color controls | Original fixed colors preserved | Not an automatic full makeover; manual token mapping required |
| External portal | Portal stays outside scope and retains original appearance | Keep its position and behavior; separate styling needs customer approval |
| Module-style class fixture | Class rules using theme variables adopt the scoped palette | Simulated cascade, not a CSS Modules bundler build |
| Shadow component | Internal fixed styles and click handler remain intact | Shadow DOM is not automatically restyled |
| React 19 booking project specimen | Controlled email input, required/email validation, submit state, counter, navigation state and React portal survive install, opt-in and rollback | Actual client React mount; not SSR, hydration or a complete customer project |
| React 19 + compiled Tailwind v4 specimen | Same React tasks retained; runtime theme variables adopt scoped palette and corners | Bun browser bundle and real Tailwind compilation, not customer Vite/Next/TanStack production builds |

Each run performed the same form submission, anchor navigation and counter action before installation, after opt-in, and after rollback. Links, form destinations, names and field types stayed identical. Shadow actions were tested where present. Scope removal and removal of both added stylesheets restored the original computed colors/fonts/corners. No customer package, configuration, routing or rule file was replaced.

## Explicitly not verified

- Real sessions in all twelve handoff destinations remain unverified: Lovable, Cursor, v0, Claude Code, ChatGPT, Gemini, GitHub Copilot, Bolt, Replit, Windsurf, Own or local model, and Human developer. Twelve tool instructions are tested, not agent edits, complete customer projects or a human's implementation.
- Full React/Vite, TanStack Start/Router, Next.js App/Pages Router, Remix, Astro, Gatsby, Angular, Vue/Nuxt and Svelte/SvelteKit customer projects remain unverified. React 19 client mounting is now verified only in the booking specimens above; framework routing, SSR, hydration and production deployment are not.
- WordPress/other CMS themes, Webflow, Framer, Shopify themes, React Native and other native applications remain unverified. This does not add export support for those frameworks or platforms.
- Real CSS Modules bundler isolation, Tailwind v3 customer compilation, custom Tailwind configurations, styled-components, Emotion, Sass, Bootstrap, Material UI and Ant Design integration remain unverified; the module fixture is only a simulated cascade and the legacy fixture only an HSL convention.
- Authentication, permissions, billing, server actions, persisted customer data, private routes, third-party widgets and full application behavior. The fixture form has a local handler, not a customer backend.
- Safari, Firefox, real devices, CSP-restricted deployments and offline font loading. Chromium and three viewport widths were used.
- Arbitrary existing specificity, `!important`, layers, root-only variables, nested competing scopes and inherited theme modes. Trial one page and compare computed results first.
- Font ownership/licensing, Google Fonts availability and remote asset rights. Self-host approved fonts when required.
- Coding-tool edits to markup or logic. CSS rollback does not undo those edits; selectively restore only restyle changes while preserving later unrelated work.

## Safe customer acceptance

Save a named backup and uncommitted changes; stop if the export folder already exists. Record routes, fields, links, permissions and critical tasks. Add one bridge and one trial wrapper. Test keyboard, phone and desktop with the customer's real account and data. Compare the same original tasks and screenshots. Do not accept a makeover on a design score alone. Stop and roll back on any behavior regression.

Reproduce: `mkdir -p /tmp/browser/transfer && bun scripts/transfer-fixtures.ts && python3 scripts/verify-transfer.py`. Results are written to `/tmp/browser/transfer/results.txt`; screenshots there are temporary test evidence, not customer deliverables. The complete outside-tool instruction inventory remains twelve generated guides; only those guides, not agent operations or full projects in the twelve tools, have been checked.
## Round 3 hardening (Nov 17, 2026)
- Missing-item check counts repeats and now includes buttons ("1 of 2 missing"); older saved originals still load.
- Saving an original never crashes in private browsing or full storage; it reports failure plainly.
- Older-theme bridge converts 3- and 6-character colours exactly; invalid colours block the download.
- Every pack file is refused if it contains scripts, iframes, event handlers, javascript: links, !important, outside @import, or html/:root/body rules in bridges. DESIGN.md is cleaned of raw HTML and hidden comments.
- Existing-site ZIP adds READ-FIRST.txt: stop if focus-restyle already exists.
- Re-verified: 288 automatic checks, real ZIP fixtures, 27 browser trials at 1280/768/390. Outside tools, private pages, Safari/Firefox remain unverified.
