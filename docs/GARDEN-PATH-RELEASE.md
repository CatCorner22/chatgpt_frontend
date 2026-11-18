# Garden Path implementation and evidence

## Behavior

- `/` opens a nine-stop journey with Reverie carrying a kite beside a blue-green river. The active stop changes by native keyboard-accessible buttons; animation is disabled for reduced-motion preferences. Compact ordered controls replace the wide illustration on small screens.
- `/?view=studio` opens the existing editor. Library, brand, saved-project, and rescue handoffs explicitly target it. Home no longer changes the saved studio stage. The map neither reads nor writes project records or pending imports.
- A new, empty editor uses the chosen Garden goal as its default integration mode. Existing saved state always takes precedence. The editor keeps its existing undo, recovery, normalization, archive and export protections.
- Brief, versioned preferences are owner-scoped. Reads do not rewrite damaged data. Explicit changes are acknowledged as saved only after readback; failures remain usable in memory with a warning.
- Eighteen substantive lessons are optional. “Keep it brief,” the lesson disclosure, and the hide action share one preference. Essential guidance remains visible. Returning from the hide action restores focus to the lesson summary.
- Navigation is reduced to Your journey, My designs, Tools, and Help, with account controls retained. Menus are mutually exclusive; Escape closes a menu and restores focus.
- Studio navigation warns only about failed persistence or a running account save, not merely an unexported design. Existing full-page unload guards remain in place.
- Surface colors follow Cat Samurai: crisp white, cool mist, forest green and coral accents. No beige app surface. Approved Reverie art retains her character colors.

## Scope boundary

This is a functional navigation and learning improvement around existing tools. It does not add a writable GitHub integration, execute customer code, install a redesign, or establish a completed customer deployment. Target prepares files and prompts. Telescope performs bounded static inspection. Whole-app redesign acceptance still requires the actual repository, affected routes/tasks, an isolated preview, browser testing, selective rollback and owner approval. No zero-defect guarantee or human-equivalence result is claimed.

## Previous release verification (v6)

- 875 automated tests across 84 files pass, including 18 preference cases, 10 Garden interaction cases, 13 real-router navigation-guard cases and 4 new menu regressions.
- Production build succeeds. TypeScript succeeds. Changed-source ESLint succeeds except that the one-line link change in reset-password retains its pre-existing formatting debt; no new issue was introduced there.
- Source review independently checked state separation, import destinations and menu behavior. The one observed menu-overlap defect was fixed and covered by tests.
- Browser initialization remains blocked: `the gaas-browser node_repl sandbox cannot be disabled`. No browser-rendered screenshot, visual fidelity, responsive overflow, console or real keyboard acceptance pass is claimed.

## Required customer acceptance

Before calling this a customer-ready end-to-end redesign, verify every affected route and important success/error/permission task on desktop and phone, keyboard and 200% zoom. Bind results to the actual source revision. Demonstrate selective rollback without losing unrelated work, then have a colleague complete the handoff. A one-page trial proves only that trial; expanding scope requires additional coverage.

Current expanded-journey checks are recorded in [Stratosphere release evidence](STRATOSPHERE-RELEASE.md). The v6 counts above are historical, not evidence for untested additions.
