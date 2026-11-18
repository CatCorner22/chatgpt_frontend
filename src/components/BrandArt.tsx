/** App identity only: these assets are never injected into a customer's export. */
export function BrandLogo({
  variant = "focus",
  decorative = false,
}: {
  variant?: "focus" | "vision";
  decorative?: boolean;
}) {
  return (
    <img
      src={variant === "focus" ? "/brand/focus-aim.png" : "/brand/vision-imagine.png"}
      alt={decorative ? "" : variant === "focus" ? "Focus" : "Vision"}
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
