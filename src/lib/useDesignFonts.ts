import { useEffect } from "react";
import type { Tokens } from "./design";
import { fontsUrl } from "./fonts";

// Loads only the typefaces the shown designs use, instead of every font up front.
const loaded = new Set<string>();
export function useDesignFonts(list: (Tokens | null | undefined)[]) {
  const key = list.flatMap((t) => (t ? [t.headingFont, t.bodyFont] : [])).join("|");
  useEffect(() => {
    for (const f of new Set(key.split("|").filter(Boolean))) {
      if (loaded.has(f)) continue;
      loaded.add(f);
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = fontsUrl([f]);
      document.head.appendChild(l);
    }
  }, [key]);
}
