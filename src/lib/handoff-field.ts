import { containsUrlCredentials } from "./action-destination";
import { z } from "zod";

// Keep normal multiline answers, but never conceal an instruction with display controls.
// eslint-disable-next-line no-control-regex
const HIDDEN_CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u;
export const SECRET_URL_MESSAGE =
  "Remove credentials and secret URL parameters from your answers. Use a plain preview address or a local preview name instead.";
function hasCredentialUrl(value: string) {
  for (const match of value.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    try {
      const url = new URL(match[0]);
      if (containsUrlCredentials(url)) return true;
    } catch {
      // This is prose, not a navigable link. Target never opens or fetches these addresses.
    }
  }
  return false;
}
export const handoffAnswer = (max: number) =>
  z
    .string()
    .max(max)
    .refine((value) => !HIDDEN_CONTROL.test(value))
    .refine((value) => !hasCredentialUrl(value), SECRET_URL_MESSAGE);
