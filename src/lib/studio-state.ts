import {
  STEPS,
  normalizeTokens,
  type Content,
  type Direction,
  type Pick,
  type Tokens,
  type Integration,
} from "./design";
import type { Purpose } from "./engine";
import { NAV_PATTERNS, type NavId } from "./nav";
import { DEFAULT_PAGE_SETTINGS, normalizePageSettings, type PageSettings } from "./page-settings";
import { assertRestorableStudioState } from "./studio-recovery";

type Opt = { label: string; why: string; tokens: Tokens };
export type State = {
  stage: "brief" | "directions" | "exam" | "review" | "rx";
  brief: string;
  integration: Integration;
  content: Content | null;
  directions: Direction[];
  direction: string;
  tokens: Tokens | null;
  stepIndex: number;
  picks: Pick[];
  history: Tokens[];
  version: number;
  purpose: Purpose;
  cache: Record<string, Opt[]>;
  aiCalls: number;
  fix: boolean;
  recheck: string[];
  projectId: string | null;
  savedHash: string | null;
  nav: NavId;
  libraryId: string | null;
  quick: boolean;
  page: PageSettings;
  past: Snap[];
  future: Snap[];
};
export type Snap = Omit<State, "past" | "future" | "cache">;
export const EMPTY: State = {
  stage: "brief",
  brief: "",
  integration: "new",
  content: null,
  directions: [],
  direction: "",
  tokens: null,
  stepIndex: 0,
  picks: [],
  history: [],
  version: 2,
  purpose: { audience: "", tone: "" },
  cache: {},
  aiCalls: 0,
  fix: false,
  recheck: [],
  projectId: null,
  savedHash: null,
  nav: "top-menu",
  libraryId: null,
  quick: true,
  page: DEFAULT_PAGE_SETTINGS,
  past: [],
  future: [],
};
export const snap = ({ past: _p, future: _f, cache: _c, ...rest }: State): Snap => rest;
// Older saves pass through the same correction step as AI output.
export function migrate(raw: Partial<State>): State {
  assertRestorableStudioState(raw);
  const s = { ...EMPTY, ...raw, version: 2 } as State;
  // Infer only for legacy saves. An explicit choice never changes the owner's words.
  s.integration = raw.integration ?? (raw.brief?.startsWith("Redesign this") ? "existing" : "new");
  const fixT = (t: Tokens | null) => (t ? normalizeTokens(t) : t);
  s.tokens = fixT(s.tokens);
  s.history = (s.history ?? []).map((t) => normalizeTokens(t));
  s.directions = (s.directions ?? []).map((d) => ({ ...d, tokens: normalizeTokens(d.tokens) }));
  s.purpose = { ...EMPTY.purpose, ...(s.purpose ?? {}) };
  s.page = normalizePageSettings(raw.page);
  if (!NAV_PATTERNS.some((n) => n.id === s.nav)) s.nav = "top-menu";
  if (!STEPS[s.stepIndex]) s.stepIndex = 0;
  if ((s.stage === "exam" || s.stage === "review" || s.stage === "rx") && (!s.tokens || !s.content))
    s.stage = "brief";
  // Undo history survives reload; each saved step passes the same correction (without its own history).
  const steps = (v: unknown) =>
    (Array.isArray(v) ? v : []).slice(-30).flatMap((x) => {
      try {
        return x && typeof x === "object"
          ? [snap(migrate({ ...(x as Partial<State>), past: [], future: [] }))]
          : [];
      } catch {
        return [];
      }
    });
  s.past = steps(raw.past);
  s.future = steps(raw.future);
  return s;
}
