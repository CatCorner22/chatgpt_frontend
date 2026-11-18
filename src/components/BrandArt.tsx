/** App identity only: these assets are never injected into a customer's export. */
export function BrandLogo({
  variant = "focus",
  decorative = false,
}: {
  variant?: "focus" | "vision" | "horizon" | "telescope" | "target";
  decorative?: boolean;
}) {
  return (
    <img
      src={
        {
          focus: "/brand/focus-aim.png",
          vision: "/brand/vision-imagine.png",
          horizon: "/brand/horizon-next.png",
          telescope: "/brand/telescope-explore.png",
          target: "/brand/target-prepare.png",
        }[variant]
      }
      alt={decorative ? "" : variant.charAt(0).toUpperCase() + variant.slice(1)}
      width={variant === "focus" ? 768 : 1020}
      height={variant === "focus" ? 256 : 340}
      className={`brand-logo brand-logo--${variant}`}
      decoding="async"
    />
  );
}

export function CatMascot({ pose }: { pose: "library" | "handoff" }) {
  return (
    <img
      src={`/brand/cat-${pose}.png`}
      alt=""
      width={pose === "library" ? 384 : 320}
      height={pose === "library" ? 351 : 292}
      className={`cat-mascot cat-mascot--${pose}`}
      loading="lazy"
      decoding="async"
    />
  );
}
