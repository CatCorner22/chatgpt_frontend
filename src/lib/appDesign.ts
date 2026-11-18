import { contrast, type Tokens } from "./design";

export type Experience = "website" | "app";
export type AppScreen =
  "dashboard" | "table" | "settings" | "sign-in" | "empty" | "error" | "loading";
export const APP_SCREENS: { id: AppScreen; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "table", label: "Table" },
  { id: "settings", label: "Settings" },
  { id: "sign-in", label: "Sign in" },
  { id: "empty", label: "Empty" },
  { id: "error", label: "Error" },
  { id: "loading", label: "Loading" },
];

// Keep the chosen accent for filled controls; derive readable text separately on each ground.
export function signalText(t: Tokens, ground = t.bg): string {
  if (contrast(t.accent, ground) >= 4.5) return t.accent;
  return contrast(t.ink, ground) >= 4.5
    ? t.ink
    : contrast("#000000", ground) >= 4.5
      ? "#000000"
      : "#ffffff";
}

export function appRules(experience?: Experience) {
  if (experience !== "app") return "";
  return `## App interaction rules
- Use the same tokens on sign-in, dashboard, tables, settings and all feedback states.
- Prioritize the main task over a marketing headline. Keep navigation and page titles consistent.
- Tables: labelled columns, sorting, filtering, pagination, tabular numerals and a phone-friendly row view.
- Forms: persistent labels, field-level errors, preserved input after failure and confirmed save feedback.
- Include empty, loading, error, success and disabled states. Never claim success before the operation succeeds.
- Phone navigation: labelled tabs for primary destinations; do not hide the primary task behind a menu.
- Every control must work with a keyboard, have a visible focus ring and a 44px target.
- Dark mode needs its own contrast-tested grounds and text, not an inverted screenshot.
- Preview records are illustrative only; replace them with real data and wire every action before launch.
`;
}
