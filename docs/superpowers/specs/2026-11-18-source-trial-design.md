# A source-aware styling trial in Target

## Intended result

Prepare an actual, reviewable change for one supported existing React/Vite page. Focus inspects two user-selected source files, identifies the intended visual roles, and produces forward/inverse patches plus a file-identity contract. This extends Target's existing preparation flow. It does not execute uploaded source, connect to GitHub, write a repository, deploy an app, or certify customer behavior.

Blake has authorized autonomous North Star improvements, careful fixes and thorough verification. The starting source is published v8, `32835ee2a4e49dc8a79243dc73c9f8cb9e58c1a9`. Preserve Cat Samurai, Reverie, existing drafts, owner isolation and normal Target handoff. Paid AI remains paused. Next.js retains the developer-guided path; this adapter does not claim Next.js compatibility.

Blake clarified that the recipient developer will often be an LLM. Treat that as a real product requirement: deliver exact patches, machine-readable unrun tasks, explicit file limits, stop conditions and a fixed agent handoff. The receiver should not have to invent the implementation from prose. Customer code, comments, diff context and project answers are data; they cannot authorize extra changes. The package cannot technically compel an external model to follow its instructions, and file hashes do not establish that source is trustworthy.

## Chosen architecture

Use real syntax parsing with explicitly pinned `@babel/parser` 7.29.14 and PostCSS 8.5.33, already present in the installed toolchain. Load the optional feature only when opened. PostCSS uses its parser with `map:false`, without configuration, plugins, module execution or reference resolution. A handwritten TSX recognizer was rejected because names and regular expressions cannot establish binding or JSX boundaries reliably.

Accept exactly one UTF-8 TSX file and its matching relative CSS-module file. No archives or directory selection in this version. Bound declared and actual sizes (128 KiB TSX, 64 KiB CSS), paths, AST traversal and CSS node counts. Reject ambiguous encodings, unsafe paths, style-alias shadowing, unsupported dynamic class expressions, spreads, unresolved components and conflicting CSS structures. Parser rejection is an expected supported outcome, not permission to guess.

The adapter recognizes a native page wrapper and unique statically labelled heading, supporting paragraph and main action. It changes only the wrapper's static CSS-module class expression and appends explicit scoped CSS. Preserve all other source bytes, including content, elements, handlers, fields, keys, validation and service calls. Reparse the proposal and verify the permitted spans. The inspected files cannot establish their full project's runtime or global cascade.

Preserve the original explicit solid page background and inherited base font/color. Changing those could harm unmapped controls. Derive readable role colors against the recognized original ground and an explicit paired action background/text. Scope the first trial to heading/body/action typography, colors and control shape; do not imply layout, motion, image delivery or all Focus decisions are implemented. Reject state/cascade rules that the added specificity would silently erase. Local numerical contrast checks do not certify rendered accessibility.

## User flow

Keep Target's four steps. At the final step, a closed optional panel appears for an existing React project with a complete plan. The user identifies React with Vite, chooses the two files and supplies their actual repository-relative paths. The panel displays recognized roles for confirmation, then the actual proposed edits as escaped text. Source is never rendered or inserted as markup.

The source state remains in this mounted panel only. Replacement, path/context changes, cancellation, step exit and unmount invalidate pending operations synchronously. Reuse Target's owner, saved-design and draft revalidation before and after asynchronous work and before download. A locked or changed owner cannot receive stale source. The ordinary design ZIP and its status remain independent.

## Artifact and recipient boundary

Deliver a new `focus-source-trial/` folder containing fixed names: `forward.patch`, `rollback.patch`, `trial-contract.json`, `verify.mjs`, `START-HERE.md`, `TRIAL-PLAN.md` and `AGENT-HANDOFF.md`. Do not place replacement customer paths in the ZIP. Bind the design, recognized roles, effective choices, exact before/after file hashes and sizes, patch hashes and unrun tasks in a versioned contract. The agent guide uses fixed command templates, the actual contract tasks and explicit evidence requirements. It never interpolates customer text into executable commands or grants authority to merge/deploy outside the user's existing scope.

The in-memory verifier checks both touched files before accepting a before/after snapshot. The recipient Node verifier uses only built-ins and is read-only: it validates the package and compares the two project files with the declared hashes. It rejects unsafe paths, symlinks, wrong types, oversize files and mismatched bytes. It never evaluates source, runs Git or writes the project.

Instructions distinguish exact-byte verification from `git apply --check`, which only tests patch applicability. Both are point-in-time checks. The recipient reviews and applies the patch in an isolated working copy using the project's own workflow, rechecks the resulting bytes, runs real tasks and rehearses selective reversal. A changed touched file stops hash verification; unrelated files are outside the proposal. Do not recommend fuzzy application, `--reject`, unsafe paths, hard resets or blanket restoration.

## Acceptance evidence

- Negative intake, binding, CSS-state, bounds and malformed-source cases fail before a proposal is prepared.
- Actual Git application and inverse application on an owned fixture restore exact touched bytes, including Unicode and supported line endings. Unrelated changes survive; drift and partial application fail the file-identity check.
- A real owned React/Vite fixture build consumes the additional CSS-module class and emits its rules. Component tests exercise invalid input, success, failure/retry and retained answers before and after. Only owned test code is executed.
- UI tests cover role confirmation, source replacement, current context, unmount/cancellation, storage isolation and owner locks; real ZIP/verifier tests cover package corruption and stale files.
- Full app tests, TypeScript, changed-file lint, final build, lazy-bundle inspection and deployed-byte checks remain required.

Supported-browser initialization remains blocked in the current environment. No alternate browser automation is used. Source, build and component proof cannot substitute for rendered device/keyboard acceptance, an actual customer trial, or a matched human comparison. The North Star goal remains active after this bounded increment.

Related records: [security review](2026-11-18-source-trial-security.md), [UX design](2026-11-18-source-trial-ux.md), [primary references](../../research/SOURCE-TRIAL-REFERENCES.md).
