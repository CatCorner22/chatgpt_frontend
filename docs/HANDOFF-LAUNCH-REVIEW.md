# Focus handoff and launch review — November 17, 2026

## Verdict: NO-GO for public paid launch

## Latest owner decision and safe checks — November 17, after 20:49 UTC

- Owner explicitly approved custom throttling: one active AI request per account, six starts in a rolling minute. Shared PostgreSQL row locking enforces this across workers; a 120-second token-bound lease recovers abandoned requests. Failed provider attempts still count; automatic AI retries are disabled. Counters are service-only; authenticated callers cannot reserve or release them directly.
- Owner authorizes **no paid AI running costs before launch readiness**. The shared AI entry point now refuses all five call paths before provider setup or reservation. There is no browser toggle; a later change requires explicit owner approval. Measured site checks still return without AI. The visible site-wide alert states AI is paused; this is a pause alert, not billing telemetry or email delivery.
- Hosted AI alert lookup found no existing matching limit, so no update was made. No hosted financial ceiling or notification was created. Pausing app AI is not a guarantee of zero Cloud/hosting, preview, external-service or Build costs; remaining credit balance is not an authorized budget.
- Verification: 273 tests in 31 files passed. Live disposable-account script verified one winner among eight concurrent reservations, refusal of the seventh start, token-bound release, caller permission denial, and signed-in generation refusal. No paid provider request was made; test account and guard row removed. AI output quality while enabled remains unverified.
- Customer transfer: 27 Chromium runs now include real React 19 controlled booking forms, navigation state, counters and React portals with plain/runtime-token CSS and compiled Tailwind v4. Exact CSS rollback passed at 1280/768/390. Full-framework and outside-agent boundaries remain explicitly listed in CUSTOMER-TRANSFER-COMPATIBILITY.md.
- Final user-flow verification: signed-in desktop and phone users submitted the brief, generated a portrait, uploaded a screenshot and retried it; all displayed the spending-pause message. A real example.com check still returned measured findings and before/after score history without AI. The guided-step RPC was separately refused while paused. Screenshots inspected; sampled phone checks had no horizontal overflow. Focus's offered theme is light-only; no dark-mode control was introduced. No enabled-AI generation or hosted spend notifications were claimed.
- Three selected security findings remain unchanged pending permission for destination restrictions and badge-publication consent. No other findings were fixed or ignored in this request.

### Exact owner decisions/details still needed

1. Before enabling AI: authorized additional AI/Cloud budget, period, desired alert channel/recipient and hard-stop behavior. Current answer is no paid AI until launch; do not silently enable it on publish. Hosted financial control availability still needs verification.
2. Paid offer: actual price, subscription versus one-time purchase, billing interval if recurring, cancellation/refund terms and seller/business details. Unlimited designs remains the promise; pace throttling is not a total-design quota. Payment provider setup and live checkout testing follow these decisions.
3. Public legal contact and seller/legal name; approval/review of privacy and commercial terms (including refunds and applicable terms). Never invent jurisdiction or contact details.
4. Email address/domain the owner controls and an accessible test inbox for real signup confirmation/recovery. No inbox passwords are needed. DNS approval may be needed to verify a chosen sender.
5. Explicit permission for the pending security tradeoffs: owner-approved site/redirect/stylesheet destinations and opt-in public badge proof details. Existing site-check and public-proof behavior must not be restricted silently.
6. Publication approval and desired domain only after safe launch gates pass. Actual hosted domain/HTTPS, monitoring and backup availability/restore evidence still need checks; no destructive restore into the current app.
7. Representative customer projects and outside-tool access/testing evidence for broader compatibility claims; credentials should not be pasted into chat. Five first-time participant notes and case-study permission are separate product-evidence items, not technical deployment controls.

Upstream Picomatch patch availability, secure egress implementation, deployment correctness and backup verification are technical work/evidence, not choices the owner must invent. Earlier sections are historical where this section supersedes them. NO-GO remains for the unresolved gates; this is not a bug-free guarantee.

## Fresh remediation evidence — November 17, 20:45 UTC

This section supersedes the older results below where they differ. Review shaped by launch-gate and completion-evidence-gate.

| Area | Result | Fresh evidence / remaining fix |
|---|---|---|
| Available dependency patches | Partial | Zod 4.6.7, source-map-js 1.2.2, js-yaml 4.3.2 and Seroval 1.8.1 resolved the corresponding advisory rows. Fresh production scan retains only two high Picomatch rows through TanStack packages. Picomatch 4.0.7 is newest published 4.x; registry contains no version above 4.0.7 even though advisory demands one. Do not claim resolved or suppress it. Wait for a compatible upstream release or independently validated alternative. |
| Usage protection | Partial | Auth remains mandatory for expensive handlers; bounded schemas now reject oversized briefs, URLs, screenshots and nested token payloads before external work. Shared AI helper bounds output to 6,000 tokens and request duration to 90 seconds. These are request safeguards, not distributed rate limiting. Custom per-account limiting awaits explicit agreement; owner skipped the tradeoff question. No design quota invented. |
| Cost limits | Fail | Hosted limit inventory returned “No credit limits found.” Owner must choose an AI/Cloud budget and alert/block behavior in Workspace settings → Usage limits & alerts. Do not silently set a financial limit. |
| Customer transfer | Pass within fixture scope | Actual ZIP extraction, 172 CSS parses, compiled Tailwind v4, 21 browser trials covering seven CSS/component conventions at desktop/tablet/phone. Forms, anchors, counters, outside portals and shadow actions preserved; scope removal plus both CSS imports removed restores appearance. See CUSTOMER-TRANSFER-COMPATIBILITY.md for remaining limits. |
| Automated regression | Pass | `bunx vitest run`: 269 tests in 30 files; final preview telemetry build OK. No manual build/typecheck run. |
| Account isolation | Pass, bounded | Fresh `python3 scripts/verify-rls.py`: cross-owner/anonymous private reads and cross-owner writes/deletes denied across eight data tables; profile/role probes, elevation and fake badge evidence denied; owner showcase update and live-link revocation retained. Only disposable accounts/rows used and cleaned. |
| Login | Pass for tested flows | Disposable password login → projects → password change → current-password requirement → successful change → sign-out → new-password login → sign-out → private projects redirects to auth. Actual hosted password requirement exposed a missing input; fixed without disabling the requirement. No page errors. |
| Signup / recovery email | Partial | No owned email domain configured; tool reports built-in auth fallback sender. Actual inbox delivery, signup confirmation and recovery-link completion not tested; do not treat authenticated password change as recovery-email proof. Keep these as prelaunch tasks. |
| Legal | Partial | Public /privacy and /terms added with footer and signup links, current analytics/clicks, browser/account storage, Google fonts, AI providers, public links, partial badges and transfer limits described. Public contact still needs owner confirmation; commercial terms and legal review outstanding. No invented email, refund, billing price or jurisdiction. |
| Accessibility / screen sizing | Pass for sampled views | Axe WCAG A/AA checks on home, auth, privacy and terms at 1280/768/390: zero reported violations; no horizontal overflow; screenshots inspected. This does not certify every screen, keyboard task or device. |
| Security | Partial | Basic scan clear; completed deep scan of pre-remediation commit a25e80d retains public badge lookup warning and two critical caller-selected public-fetch findings. Exact public badge proofs are intentional; arbitrary public-site review is core functionality. Private-network/redirect and byte-bound tests pass, but DNS lookup-to-fetch rebinding remains a known gap. Findings remain visible, not marked fixed or ignored. Explicit abuse protection and an egress strategy need review before public launch. |
| Search | Partial | All content routes, including home and new legal pages, have distinct titles/descriptions and OG metadata. No meaningful absolute cover image to tag. Built-in full SEO/AI search review not run this turn. |
| Operations | Partial | Cloud health: up, memory 57%, disk 16%, connections 7/60, no recent exhaustion alerts. Publish settings: unpublished; no publish attempted. Code version history preserved. Daily backup behavior documented by platform; actual backup inventory/restore not verified, no destructive restore attempted. Custom domain/HTTPS and hosted deployment remain unverified. |
| Payments | N/A implementation; launch blocker | No checkout/webhook to test. Paid enforcement waits on owner price and billing model; unlimited designs preserved as product intent. |

**NO-GO:** unresolved Picomatch advisory, per-account abuse/egress review, paid enforcement, confirmed public legal contact/commercial terms, signup/recovery inbox delivery, chosen usage budgets and hosted launch/backup checks.

Acceptance: preserve customer work during additive transfer. Check: downloaded ZIP and 21 browser task/install/rollback runs. Output: every run ended “exact CSS rollback PASS.” Not verified: external agents and complete customer projects.

Acceptance: safer launch surfaces. Check: 269 regression tests, two-account isolation script, disposable browser auth flow and 12 sampled axe reviews. Output: all passed after the current-password input fix; zero sampled page errors. Not verified: production Worker execution, fresh AI generation after Zod upgrade, full email flow and every app screen.

Earlier failed browser scripts were test filename/selector/navigation assumptions except for the real hosted current-password requirement. The final browser run passed end to end; all test accounts removed.

Stages 4–6 implementation/review completed, but this is not a bug-free guarantee or a publish approval.

| Area | Result | Evidence / next action |
|---|---|---|
| Customer files | Pass within tested scope | Every generated file audited; existing ZIP inside fresh focus-restyle folder; filename allowlist rejects traversal/unknown files; strict signature shape; font-links.html avoids remote CSS compilation failures; modern and legacy bridges require data-focus-restyle on a trial wrapper; rollback includes every import type and marked rule reminder. |
| Transfer compatibility | Pass, simulated | 172 generated CSS files parsed. Tailwind v4 fixture compiled. Plain CSS, compiled modern Tailwind, legacy HSL, fixed-color controls and external portals tested at 1280 and 390px. All 10 runs: install inert, scoped colors, form submit/link/button tasks unchanged, attribute removal restores original computed colors/fonts/corners. No package/config/rule files replaced. |
| Design match | Partial evidence, clearly labelled | Fonts, six colors, corners, spacing are declared-value checks, not computed rendering. Exact fix copy buttons. Unknown measurements never pass. Existing badge's five original checks unchanged. |
| Preservation | Pass within public HTML scope | Baselines compare links/destinations, form methods/actions and field identities/types; same page path/query/hash required across domain changes. Rescue saves inventory before handoff. Missing items have a repair message. Private routes, JavaScript actions, validation, data/auth logic and complete site content still require customer task tests. |
| User flow | Pass | Signed-in real example.com check → save original → reloadable baseline → upload before/after → keyboard slider; no page errors and no phone overflow. New-design choice focuses brief; makeover opens correct screen. Screenshots stay browser-only and replaced URLs are revoked. |
| Row security | Pass for tested operations | Live policies reviewed on all 10 public tables; no storage buckets. Two disposable users: cross-owner/anonymous private reads blocked, cross-owner changes/deletes blocked on eight data tables; profile/role reads denied; role elevation and owner counts denied. All fixture rows/accounts cleaned. Repeat: scripts/verify-rls.py (requires managed env, never outputs credentials). |
| Badge integrity | Fixed and retested | Deep scan found authenticated direct passing/score writes. Migration 0011 revokes browser INSERT/general UPDATE, allows only showcase UPDATE. Issuance writes admin only after verified evaluation. Fake insert and evidence update denied; owner showcase update works. Full successful issuance after this permission change not rerun; existing whole-site tests still pass. |
| Anonymous cost/fetch abuse | Fixed and retested in screenshot path | Design, critic, inspiration and whole-site handlers require authenticated middleware. Signed-out screenshot invocation returned Unauthorized before AI; signed-in page flow works. Sign-in does not establish payment or quotas. |
| Roles | Fixed and retested | has_role execution denied to anonymous; signed-in caller can only inspect own role. Live tests confirmed other-user probe false and owner counts denied. |
| Public links | Intentional, not private | Exact bearer share/Vision/proof links reveal their published content to link-holders. Live Vision read/revocation tested. Independent judge confirms public badge proof lookup is intentional; scanner warning retained for visibility, not silently suppressed. Avoid placing confidential content in shared Visions. |
| Security scans | Basic passed; deep findings reviewed | Critical badge forgery and anonymous actions addressed; judge found no remaining high issue in these paths. pg_net extension warning and intended public security-definer readers remain documented. |
| Dependencies | Fail/open | Fresh dependency scan flags high advisories via Zod, source-map-js, js-yaml and picomatch; moderate Seroval advisories. Compatible upgrades and retesting required; no blind major upgrade in this handoff slice. |
| Abuse/billing | Fail/open | No per-account throttling/paid enforcement; owner price and billing decision still needed. Paid unlimited designs must not be replaced with an invented design cap. Hosting alerts/limits not verified. |
| Login/email | Partial | Disposable password sign-ins worked. Full signup confirmation, recovery email delivery and reset completion not verified this run; hosted settings not inferred from source. |
| Legal/operations | Fail/open | No privacy/terms pages approved; publication/domain, backups and usage alerts unverified. Publishing still needs owner approval. |
| Search/accessibility | Partial | Content-route metadata inspected; consent metadata completed. Keyboard slider and phone overflow checked. No built-in full accessibility or SEO/AI-search review executed. |
| External tools | Blocked | All 12 preservation guides tested as generated text; sample integrations simulated. Cursor/Bolt/v0/etc. actual runs unavailable here, so not claimed. |

## Reproducible checks

- `bunx vitest run`: 266 tests across 29 files passed before final same-page query regression adjustment; final targeted run recorded in delivery.
- `bun scripts/transfer-fixtures.ts && python3 scripts/verify-transfer.py`: CSS compilation/parsing plus 10 preservation/rollback flows.
- `python3 scripts/verify-rls.py`: disposable accounts/rows only; secrets read from managed env, never printed.
- Preview harness latest result: build OK.

## Confirmed findings retained

| Finding | Status |
|---|---|
| Global bridge repaints all screens | Fixed: scoped wrapper, inert install, browser retested |
| Missing rollback of appended rules | Fixed: marked optional block and explicit removal |
| Validator accepts unknown/nested filenames | Fixed: exact allowed-file set; regression tests |
| Font CSS remote import breaks common bundlers | Removed: head links, offline/CSP guidance |
| Public badge self-award | Fixed: grants revoked and direct-write attacks retested |
| Other-user role probing | Fixed: caller identity checked and anonymous execution revoked |
| Anonymous AI/fetch actions | Authenticated; per-account abuse remains launch blocker |
| Unrelated baseline gives misleading evidence | Fixed: page path/query/hash gate |

Shaped by four-lens-build. Deferred scale work: public-reader abuse monitoring and scheduled backlog visibility, because launch traffic and hosted controls have not been verified.