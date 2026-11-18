# Proposed Next.js source-trial boundary

18 November 2026; baseline `e21125f8285336da4d809e7cb21bfb0cb7cac5d2`.

**Proposed, not implemented or enabled.** Target's source-change adapter remains React/Vite only. Next.js continues to use the existing developer-guided handoff. This note defines a possible bounded extension and its proof obligations; it does not authorize customer-code execution or certify Next.js compatibility.

## Candidate eligibility

The first candidate is an existing explicit Client Component App Router root page: `app/page.tsx` or `src/app/page.tsx`, plus its directly imported sibling `.module.css` file. The project framework remains owner-declared; two selected files cannot verify the complete project configuration.

- Require an actual top-level, literal `use client` directive before imports. A comment, label or ordinary string elsewhere does not qualify. Preserve every directive byte; never convert a Server Component by adding or moving a directive.
- Require one parameterless, named, synchronous default function with one direct native JSX return. Keep the existing unique heading/paragraph/action mapping, static CSS-module binding, native-element and flat-CSS restrictions, source bounds and state-conflict checks.
- Refuse unsupported paths, Pages Router files, layouts, route handlers, dynamic/grouped routes, async pages, named route/metadata exports, custom components such as Next Link/Image, and recognizable Server Action shapes such as `use server`, `action` or `formAction` bindings.
- For this first shape, restrict imports to React and the selected CSS module; refuse dynamic imports and recognizable CommonJS loading. These restrictions narrow eligibility, not establish that arbitrary handler code or external services are harmless.
- Preserve elements, attributes, handlers, copy, state logic and all source outside the existing wrapper-class addition and scoped CSS append. Do not change layouts, imports, dependencies, routes, authentication, data access or configuration.

`use client` identifies a component boundary; it does **not** mean the module only runs in a browser. Next.js can prerender Client Components. Focus must continue treating selected source as data, never importing, rendering or executing it. Any customer build or runtime work remains a separately authorized recipient operation in an isolated environment with suitable test data and services.

## Required implementation boundary

Use a distinct fixed adapter identity, for example `next-app-client-css-module-v1`. Carry it through inspection, preparation, deterministic materialization and full proposal revalidation. Revalidation must rerun that adapter's eligibility rules, not merely accept its name. Unknown adapters remain refused.

The recipient verifier must recognize only the approved adapter/path contract while retaining exact whole-file hashes, companion integrity, read-only bounded reads and symlink protections. Recipient guides and UI explanations must describe the actual selected scope. Preserve existing Vite behavior and identities, runtime-change invalidation, owner/context checks and returned-byte comparison. No Target draft-schema expansion, remote repository connection or source storage is needed for this proposal.

## Owned experiment and evidence limits

The root task selected Next.js **16.4.6** for a separately pinned owned fixture in a temporary directory. The experiment uses the current **Vite-labelled** transform mechanically against owned source. Its contract has not become a Next adapter, and its output must not be represented as an eligible customer Next handoff. Do not add the experiment's framework dependencies or generated files to the production app merely to run it.

Record actual results separately; a planned check is not a pass:

| Evidence                                  | What it can establish                                                            | What it cannot establish                                   |
| ----------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Real owned Next builds before/after       | The pinned fixture compiles in the tested configuration.                         | Customer configuration or runtime behavior.                |
| Production HTTP HTML and emitted CSS      | The owned route serves the expected markup and consumes the scoped styling.      | Browser hydration, interaction or visual correctness.      |
| Exact forward/inverse and drift checks    | Touched fixture bytes restore exactly; unrelated work survives; mismatches stop. | That a recipient rehearsed rollback in the customer's app. |
| Browser hydration and visitor-task checks | Only the behavior actually observed on the tested fixture/runtime.               | Universal Next.js support or all customer journeys.        |

Hydration, rendered keyboard behavior and real visitor tasks are **unrun while the supported browser is unavailable**. Compiler, HTTP, CSS and reversal results cannot substitute for them. Keep Next.js unsupported in the live source adapter until the scoped evidence is sufficient and independently reviewed.

## Independent acceptance criteria before enablement

1. Test both approved root locations with a legal parameterless page and an untouched minimal root layout. The Vite Booking fixture's injected function prop is not an App Router page contract. Use owned local/test-only behavior and no live services.
2. Exercise positive and negative parser cases: real versus comment-only directives, missing/server directives, props/async/extra exports, module alias abuse, unsupported components/routes/actions, conflicting CSS states and source limits. Verify every protected byte span, including directives and handlers.
3. Check actual Next builds, served output, consumed CSS, exact inverse, touched-file drift and unrelated-file preservation. Keep the existing Vite suite passing.
4. When browser access is available, check hydration errors, success, invalid input, loading, failure/retry, retained answers, duplicate submission, keyboard/focus, narrow layouts and zoom on the owned before/after fixture. Record absent evidence plainly.
5. Test unknown/cross-adapter rejection, stale owner/runtime/source changes, package instructions, exact returned-byte comparison and absence of automatic Launch credit. Matching bytes and recipient statements remain distinct from measured execution evidence.

Even after these gates pass, customer source/configuration, global CSS, integrations and isolated-preview acceptance still require review. The supported claim must name this exact source shape, not Next.js applications generally.
