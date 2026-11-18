import { focusLocalStorage } from "@/lib/browser-storage";
import { normalizeTokens, type Tokens } from "./design";
import { fixContrast } from "./engine";

export const PORTRAIT_KEY = "refraction:portrait:v1";
export type Influence = { source: string; choice: string; why: string };
export type Portrait = { name: string; summary: string; influences: Influence[]; tokens: Tokens };
export type DuelVote = { id: string; choice: "a" | "b" | "tie"; reason: string };
export type TasteProfile = {
  version: 1;
  inspiration: string;
  avoid: string;
  portrait: Portrait | null;
  votes: DuelVote[];
};
export const EMPTY_PROFILE: TasteProfile = {
  version: 1,
  inspiration: "",
  avoid: "",
  portrait: null,
  votes: [],
};

// Each comparison changes only one visual decision; everything else stays identical.
export const DUELS = [
  {
    id: "type",
    title: "The voice",
    a: "Literary & expressive",
    b: "Direct & modern",
    fields: ["headingFont"],
  },
  {
    id: "space",
    title: "The breathing room",
    a: "Room to linger",
    b: "More at a glance",
    fields: ["density"],
  },
  {
    id: "shape",
    title: "The edges",
    a: "Crisp & architectural",
    b: "Soft & welcoming",
    fields: ["radius"],
  },
  {
    id: "scale",
    title: "The emphasis",
    a: "Quiet confidence",
    b: "A bold entrance",
    fields: ["scale"],
  },
  {
    id: "button",
    title: "The invitation",
    a: "Outlined & restrained",
    b: "Filled & decisive",
    fields: ["buttonStyle"],
  },
] as const;

export function duelPair(base: Tokens, id: string): [Tokens, Tokens] {
  const patches: Record<string, [Partial<Tokens>, Partial<Tokens>]> = {
    type: [{ headingFont: "Fraunces" }, { headingFont: "Space Grotesk" }],
    space: [{ density: "airy" }, { density: "compact" }],
    shape: [{ radius: 0 }, { radius: 20 }],
    scale: [{ scale: 1.18 }, { scale: 1.5 }],
    button: [{ buttonStyle: "outline" }, { buttonStyle: "solid" }],
  };
  const pair = patches[id] ?? [{}, {}];
  return pair.map((p) => normalizeTokens({ ...base, ...p })) as [Tokens, Tokens];
}

export function voteLabel(v: DuelVote): string {
  const d = DUELS.find((x) => x.id === v.id);
  return !d || v.choice === "tie" ? "No preference" : v.choice === "a" ? d.a : d.b;
}

export function preferenceTokens(profile: TasteProfile, fallback: Tokens): Tokens {
  let t = profile.portrait?.tokens ?? fallback;
  for (const vote of profile.votes) {
    if (vote.choice !== "tie") t = duelPair(t, vote.id)[vote.choice === "a" ? 0 : 1];
  }
  return fixContrast(normalizeTokens(t));
}

export function profileText(profile: TasteProfile): string {
  return [
    profile.inspiration && `Personal inspirations: ${profile.inspiration}`,
    profile.avoid && `Avoid: ${profile.avoid}`,
    profile.portrait &&
      `Taste portrait: ${profile.portrait.name}. ${profile.portrait.summary}. ${profile.portrait.influences.map((i) => `${i.source} → ${i.choice}: ${i.why}`).join("; ")}`,
    ...profile.votes
      .filter((v) => v.choice !== "tie")
      .map((v) => `${v.id}: ${voteLabel(v)}${v.reason ? ` (${v.reason})` : ""}`),
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 2400);
}

export function parseProfile(raw: string | null): TasteProfile {
  try {
    const v = JSON.parse(raw ?? "null");
    if (!v || v.version !== 1) return { ...EMPTY_PROFILE };
    const p = v.portrait;
    const portrait =
      p &&
      typeof p.name === "string" &&
      typeof p.summary === "string" &&
      p.tokens &&
      Array.isArray(p.influences)
        ? {
            name: p.name.slice(0, 100),
            summary: p.summary.slice(0, 1000),
            tokens: fixContrast(normalizeTokens(p.tokens)),
            influences: p.influences
              .filter(
                (i: Influence) =>
                  i &&
                  typeof i.source === "string" &&
                  typeof i.choice === "string" &&
                  typeof i.why === "string",
              )
              .slice(0, 6),
          }
        : null;
    const votes: DuelVote[] = [];
    for (const x of Array.isArray(v.votes) ? v.votes : []) {
      if (DUELS.some((d) => d.id === x?.id) && ["a", "b", "tie"].includes(x.choice)) {
        const old = votes.findIndex((e) => e.id === x.id);
        if (old >= 0) votes.splice(old, 1);
        votes.push({ id: x.id, choice: x.choice, reason: String(x.reason ?? "").slice(0, 300) });
      }
    }
    return {
      version: 1,
      inspiration: String(v.inspiration ?? "").slice(0, 2000),
      avoid: String(v.avoid ?? "").slice(0, 500),
      portrait,
      votes,
    };
  } catch {
    return { ...EMPTY_PROFILE };
  }
}

export function readProfile(): TasteProfile {
  try {
    return parseProfile(focusLocalStorage.getItem(PORTRAIT_KEY));
  } catch {
    return { ...EMPTY_PROFILE };
  }
}
