# Sources and limits

Reviewed on 2026-11-18. The following public pages were retrieved directly and the relevant sections were read while writing this kit. No citations below are based only on an abstract or search snippet. Rules are original paraphrases; no published rule set was copied into the kit. A source supports a rule’s rationale; it does not prove that any page passed the rule.

| Source | Sections read and used | Basis |
| --- | --- | --- |
| [Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/) | 1.4.2–1.4.4, 1.4.8, 1.4.10–1.4.12; 2.1.1; 2.2.1–2.2.2; 2.3.1–2.3.3; 2.4.3, 2.4.7, 2.4.13; 2.5.5, 2.5.8; 3.3.1–3.3.4 | `read`: relevant normative sections of the full page, including exceptions |
| [Making Content Usable for People with Cognitive and Learning Disabilities](https://www.w3.org/TR/coga-usable/) | 4.2.4 Make Each Step Clear; 4.3.3 Use a Clear and Understandable Page Structure; 4.4.1 Use Clear Words; 4.5.10 Provide Feedback; 4.6.1 Limit Interruptions; 4.6.2 Make Short Critical Paths; 4.6.3 Avoid Too Much Content; 5.1 Working with Users with Cognitive and Learning Disabilities | `read`: these relevant sections, not the entire note |
| [ARIA Authoring Practices: Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) | Keyboard Navigation Inside Components; Focus VS Selection; roving tabindex guidance | `read`: relevant sections |
| [ARIA Authoring Practices: Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | Keyboard Interaction, initial focus and return-focus notes | `read`: relevant section |
| [ARIA Authoring Practices: Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) | Keyboard Interaction, manual and automatic activation, orientation notes | `read`: relevant section |
| [ARIA Authoring Practices: Menu and Menubar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/) | Keyboard Interaction; first/next/previous item and exit behavior | `read`: relevant section; original `/patterns/menu/` request redirects here |
| [ARIA Authoring Practices: Listbox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/) | Keyboard Interaction; single-selection navigation and focus versus selection | `read`: relevant section |
| Project design judgment | Craft rules, subjective visual warnings, reading presets, state-sheet wording, strict project policies | `builder`: original judgment, no outside research claimed |

## Deliberate project policies

- The kit’s no-autoplay policy is stricter than WCAG 1.4.2 and 2.2.2. The source permits some automatically playing content with controls; this project asks for user initiation. Attribute checks cannot establish whether scripts, embedded players, or carousels start later.
- The 24 by 24 target-box floor intentionally does not evaluate the spacing, inline, equivalent-control, user-agent, or essential exceptions in WCAG 2.5.8. A failed kit target check is not a claim that WCAG was failed. The 44 by 44 comfort target is a preference for relevant designs.
- The flashing policy uses the stricter three-flashes rule; still-page inspection cannot measure temporal frequency. Flash analysis remains external to this kit.
- The text-spacing values describe an override test, not required default typography. The reading presets are choices to test with intended readers, not condition-specific treatments.
- Reflow measurement checks the current viewport’s horizontal extent. A person must still test actual zoom, hidden or missing content, each interaction state, and legitimate two-dimensional content.
- Color calculations are scoped to the supported rendered color/background cases. A numeric contrast result does not establish all forms of readability.
- Reduced-motion and contrast preference behavior require running the real interactions in those modes. Finding a CSS media query would not prove correct behavior.
- Timing targets, radii, typography details, scale consistency, and machine-made “tells” are project judgments, marked `expert-opinion`. A warning never establishes who made a page.
- No evidence here establishes usability for all people with ADHD, autism, dyslexia, or other cognitive and learning differences. Involve the intended people in task testing; COGA section 5.1 explicitly explains why automated checks cannot answer that question.

The reference URLs are citation data only. No kit function requests them at runtime.
