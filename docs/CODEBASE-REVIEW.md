# Focus code review

The November 25 review began at `e1d301f`. Blake asked to approve removals individually after raising a question about the design-template library. All 46 UI primitive files, both root dependency manifests, the stylesheets, the public assets, and the portable kit are retained.

## Where the templates connect

The source import graph from the app entry points reaches 11 of the 46 UI primitives. Import counts alone miss two relevant uses of the folder.

- Tailwind scans the whole `src` tree. For example, the sidebar width utility occurs in the sidebar source and is present in the released CSS. Removing the source can change the stylesheet even when React never renders the sidebar in Focus. [Stylesheet sources](../src/styles.css) · [Sidebar](../src/components/ui/sidebar.tsx)
- The shadcn configuration maps the UI alias to this folder. Focus's v0 instructions tell the builder to generate shadcn components styled with the customer's tokens. A developer or private template can use that contract. The investigation found no direct import of the flagged 35 modules in the checked-in gallery or in the two packaged customer examples. [Component configuration](../components.json) · [Builder instructions](../src/lib/design.ts)

The 49 checked-in visual directions are defined separately. They supply words, tokens and layout choices. Comparing the refactored gallery with the baseline produced identical entries and identical file contents across 98 new-project and existing-project packs. [Gallery](../src/lib/gallery.ts) · [Pack builder](../src/lib/exportPack.ts)

<details>
<summary>The 35 retained component modules flagged by the import check</summary>

- **Content and presentation** — alert, aspect-ratio, avatar, badge, calendar, card, carousel, chart, skeleton, table.
- **Navigation and layout** — breadcrumb, menubar, navigation-menu, pagination, resizable, scroll-area, separator, sidebar.
- **Controls and interaction** — accordion, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input-otp, progress, radio-group, select, sheet, toggle, toggle-group.

</details>

## Organization and compatibility

The Studio route owns navigation and project lifetime. Its stages now live together under `src/routes/-studio/`, where TanStack excludes them from URL generation. An independent comparison found the same 33 route modules and the same metadata order and values on all 18 routes that now share a metadata helper. Common file-reading and download operations also have one implementation for their callers. [Studio stages](../src/routes/-studio/) · [Route metadata](../src/routes/-social-head.ts)

All 132 app test files retain their cases, assertions and lifecycle hooks. Repeated test data and asynchronous test setup now live in shared fixtures. The existing-site checker exercises the two opt-in steps separately, checks the original application before styling and verifies rollback. [Tests](../src/test/) · [Existing-project checks](../scripts/test-existing-transfer.mjs)

A clean npm installation passed all 1,631 app tests, all 62 portable-kit tests, TypeScript checks and the Sites build. The two compiled application stylesheets matched the preceding release byte for byte, as did the ten files in the rebuilt reviewer interface. Browser checks exercised navigation autosave, the Garden-to-Target handoff, isolated owners, print output and the existing-project rollback fixtures. Lint reported zero errors and the same 11 warnings as the preceding release.

## Review coverage and open items

The baseline inventory covers 752 tracked paths and 131,220 lines of nonbinary material, including documentation, lockfiles and generated data. TypeScript and PostCSS parsed 515 JavaScript, TypeScript and stylesheet files comprising 89,842 lines. Other passes covered Python syntax, data and archive integrity, module references, compiler diagnostics, and review of the changed implementation and its callers. These are automated and targeted source checks. They cannot establish how private downstream templates use an exported component.

The baseline compiler flags nine unused bindings when both optional unused-code checks are enabled. The welcome and specimen styles also contain candidates left from earlier screens. They remain available pending an owner decision. No file, UI primitive, package, or style removal was approved in this pass.

The npm advisory database reported four moderate entries across the full lockfile, associated with esbuild and the Drizzle tooling chain. The production-dependency query separately returned one low esbuild advisory concerning its Windows development server. These results describe the installed dependency graph. A deployed exploitability assessment remains open. [esbuild development-server advisory](https://github.com/advisories/GHSA-67mh-4wv8-2f99) · [esbuild Windows advisory](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr)
