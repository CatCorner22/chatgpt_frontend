# Focus and Vision cat identity

The approved “Aim & Imagine” identity uses the same cream-and-ginger cat with dark forest outlines throughout the application:

- Focus: a toy bow and suction-cup arrow aimed at an intact coral balloon.
- Vision: round glasses, a small palette, and a smiling flower painting.
- Supporting poses: a design book in the saved-design welcome state, and a small parcel beside the customer handoff.
- Compact face: browser and touch icons.

`BrandArt.tsx` keeps wordmarks and decorative poses consistent. Wordmarks have an accessible name except when the surrounding home link supplies it. Supporting illustrations are decorative, have reserved dimensions, and do not convey success or validation status. The customer’s exported page, design tokens, and restyle assets do not contain these brand illustrations.

The PNG delivery assets retain transparency and use modest display dimensions. The header wraps its navigation below the logo at narrower tablet widths. No animation is required to use the application.

The original approved image is retained outside the checkout at `/workspace/generated_images/exec-1680d475-088b-4986-8ca8-f615913ac0d1.png`. Individual transparent artwork was generated from that reference and exported at application sizes. A WebP encoding showed alpha artifacts during inspection and was rejected; only inspected PNG assets are included.

Browser comparison is tracked in `design-qa.md`; asset inspection alone is not a rendered application acceptance pass.
