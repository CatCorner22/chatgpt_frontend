import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { SKINS, applySkin } from "@/lib/skins";
import type { Tokens } from "@/lib/design";

// One-click colour variations. Only colours change; fonts, sizes, layout and buttons stay.
export function SkinBar({
  id,
  tokens,
  onChange,
}: {
  id: string;
  tokens: Tokens;
  onChange: (t: Tokens) => void;
}) {
  const base = useRef<{ id: string; tokens: Tokens } | null>(null);
  const [active, setActive] = useState<string | null>(null);
  if (!base.current || base.current.id !== id) base.current = { id, tokens };
  const original = active ? base.current.tokens : tokens;
  const options = useMemo(() => SKINS.map((s) => ({ s, t: applySkin(original, s) })), [original]);
  const pick = (skinId: string | null, next: Tokens) => {
    const before = tokens;
    const prev = active;
    if (!active) base.current = { id, tokens };
    setActive(skinId);
    onChange(next);
    toast(
      skinId ? `${SKINS.find((x) => x.id === skinId)?.name} skin applied` : "Original colours back",
      {
        duration: 8000,
        action: {
          label: "Undo",
          onClick: () => {
            setActive(prev);
            onChange(before);
          },
        },
      },
    );
  };
  const sw = (t: Tokens) => [t.bg, t.surface, t.accent, t.ink];
  return (
    <section aria-labelledby="skins-title" className="rounded-md border border-border bg-card p-4">
      <h3 id="skins-title" className="font-medium">
        Try a Skin
      </h3>
      <p className="text-sm text-muted-foreground">
        One click changes the colours only. Fonts, sizes, layout and buttons stay. Text stays
        readable.
      </p>
      <div
        role="radiogroup"
        aria-label="Colour skins"
        className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-7"
      >
        <SkinChip
          label="Original"
          colors={sw(original)}
          on={!active}
          onClick={() => active && pick(null, original)}
        />
        {options.map(({ s, t }) => (
          <SkinChip
            key={s.id}
            label={s.name}
            title={s.looks}
            colors={sw(t)}
            on={active === s.id}
            onClick={() => active !== s.id && pick(s.id, t)}
          />
        ))}
      </div>
    </section>
  );
}

function SkinChip({
  label,
  title,
  colors,
  on,
  onClick,
}: {
  label: string;
  title?: string;
  colors: string[];
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      role="radio"
      aria-checked={on}
      title={title}
      onClick={onClick}
      className={`min-h-11 rounded-md border p-1.5 text-left text-xs transition ${on ? "border-primary ring-2 ring-primary" : "border-border hover:border-primary"}`}
    >
      <span className="flex h-6 overflow-hidden rounded-sm" aria-hidden>
        {colors.map((c, i) => (
          <span key={i} className="flex-1" style={{ backgroundColor: c }} />
        ))}
      </span>
      <span className="mt-1 block truncate">{label}</span>
    </button>
  );
}
