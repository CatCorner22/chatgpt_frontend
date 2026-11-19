# Japan Digital Agency source ingestion

Prepared November 18, 2026 (America/New_York). This is a research snapshot and proposed application, not a runtime capability or release verdict.

The source discussed with Blake is the Digital Agency Design System's [Local design system (style guide)](https://design.digital.go.jp/dads/guidance/local-design-system/) page, updated October 14, 2026. It describes adapting a platform design system to a product's identity while preserving its accessibility mechanisms. The [resource listing](https://design.digital.go.jp/dads/resources/) supplied an official November 18, 2026 Markdown archive intended for AI reference.

## Preserved artifacts

The workspace research library is `/workspace/deliverables/japan-design-agency/`. Its portable copy is `/workspace/deliverables/Japan-Design-Agency-Research.zip`.

- Original archive: `originals/dads-markdown-20261118.zip`, 290,823 bytes; SHA-256 `96f083c4099672bd3d431f2cae2e979294453483a2206b7d457deecc8adba817`.
- Extracted source: 145 unchanged Markdown files, including the agency README and manifest; `source-index.json` records titles, paths, source URLs and hashes.
- Source provenance: `source-manifest.json` records eight downloads with URL, UTC retrieval time, size and hash. `originals/` retains the article, resources and reuse terms.
- English brief: `Japan-Design-Agency-Focus-Brief.pdf`, with the same text at `notes/Focus-brief.md`. This is an independent summary and Focus proposal by Codex, not an official translation or endorsement.
- Official companion: `originals/official-accessibility-guide-20251016.pdf`, 64 PDF pages, 12,043,171 bytes; SHA-256 `a4279c9c6eba865a7247b6c7219afd2797db283f1acab9496b10c0e2d05c71a9`. It is the separate [Introduction to Web Accessibility](https://www.digital.go.jp/resources/introduction-to-web-accessibility-guidebook), not a PDF of the local-design-system article.
- Proposed integration: `notes/decision-proposals.json` has eight source-linked records, all marked `proposed-not-implemented`.

The source archive is an AI-reference conversion. Linked images, Figma and Storybook assets are not a complete offline mirror. Indexing all files does not mean all pages have been evaluated or implemented. This is durable file storage, not model training or automatic cross-chat memory.

## Research implications for Focus

Use the local-system concept to distinguish editable appearance from protected component behavior. Candidate records cover named tokens and consumers, semantic color, keyboard focus and forced colors, size and spacing, actual action labels, unavailable-action explanations, framework adaptation and feedback from composed screens.

The numerical baselines in DADS belong to that system and context. Do not present its 16 CSS px baseline or 1.5 reading line height as universal WCAG minimums. Likewise, the [button accessibility guidance](https://design.digital.go.jp/dads/components/button/accessibility/) makes clear that `aria-disabled` alone does not stop activation.

The next implementation step requires a bounded decision record, explicit applicability, an actual component contract and acceptance evidence. The research does not widen Target's current source-trial adapter, implement new guards or prove safety for arbitrary customer apps.

## Related user-supplied research

Blake also supplied the [North Star compendium](https://docs.google.com/document/d/1v2gPWRDKvH4pe_fF-dlVso72T_wQx8_6/edit). Its original Markdown and a bounded review are preserved under `/workspace/research/focus-compendium/`. Its ten engineering-gap categories are useful research inputs. Treat mandatory-looking rules as candidate claims until their source, scope, exceptions and measurements are verified. Keep normative requirements, chosen product policy, contextual heuristics and research hypotheses separate.

## Attribution and terms

Source: Digital Agency Design System website, Digital Agency, Government of Japan. This note and the English brief adapt and organize the sources and add Focus recommendations; they were prepared by Codex for Focus, not by the agency. Archived downloaded files remain unchanged.

Documentation follows the [DADS notices](https://design.digital.go.jp/dads/introduction/notices/), [agency copyright policy](https://www.digital.go.jp/copyright-policy) and [Public Data License 1.0](https://www.digital.go.jp/resources/open_data/public_data_license_v1.0), subject to exclusions and third-party rights. Figma, code, icons and branding have distinct terms. Full attribution and retained terms are in the research bundle.
