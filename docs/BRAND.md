# Reverie — the Focus and Vision identity

The approved “Aim & Imagine” identity features **Reverie**, the same cream-and-ginger guide with dark forest outlines throughout the application. She is gentle, curious, artistic and thoughtful. Her name means **a pleasant daydream**, pronounced **REV-uh-ree**.

- Focus: a toy bow and suction-cup arrow aimed at an intact coral balloon.
- Vision: round glasses, a small palette, and a smiling flower painting.
- Supporting poses: a design book in the saved-design welcome state, and a small parcel beside the customer handoff.
- Compact face: browser and touch icons.
- Horizon: Reverie with a small map and a coral sunrise, for project progress and next steps.
- Telescope: Reverie in an ivory spacesuit beside a small cream-and-coral spaceship, for advanced tools.
- Target: Reverie shooting a coral basketball into a small hoop, for preparing a design for a real project.

Reverie introduces herself in the studio and welcome guide. **Help → About Reverie** opens her first-person profile at `/reverie`, explains her name and leads into the welcome guide. Shared introduction copy lives in `src/lib/reverie.ts`; supporting illustrations use `ReverieArt`. Refer to her by name and use she/her when pronouns are needed.

Character development and sticker assets have a separate Reverie handoff pack; application branding remains in this repository. Naming a capability does not replace descriptive labels or imply that a project has passed a quality gate.

`BrandArt.tsx` keeps wordmarks and decorative poses consistent. Wordmarks have an accessible name except when the surrounding home link supplies it. Supporting illustrations are decorative, have reserved dimensions, and do not convey success or validation status. The customer’s exported page, design tokens, and restyle assets do not contain these brand illustrations.

The PNG delivery assets retain transparency and use modest display dimensions. The header wraps its navigation below the logo at narrower tablet widths. No animation is required to use the application.

The original approved image is retained outside the checkout at `/workspace/generated_images/exec-1680d475-088b-4986-8ca8-f615913ac0d1.png`. Individual transparent artwork was generated from that reference and exported at application sizes. A WebP encoding showed alpha artifacts during inspection and was rejected; only inspected PNG assets are included.

Browser comparison is tracked in `design-qa.md`; asset inspection alone is not a rendered application acceptance pass.
