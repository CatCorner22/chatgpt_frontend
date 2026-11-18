import { z } from "zod";
import { normalizeTokens } from "./design";

// Bound paid work before prompts are built; these are payload protections, not design quotas.
export const directionInput = z.object({
  brief: z.string().trim().min(10).max(2000),
  purpose: z.string().max(300),
  taste: z.string().max(2400).optional(),
});
export const stepInput = z.object({
  brief: z.string().max(2000),
  purpose: z.string().max(300),
  stepId: z.string().max(40),
  history: z.string().max(1500),
  tokens: z
    .object({})
    .catchall(z.union([z.string().max(100), z.number().finite()]))
    .refine((tokens) => Object.keys(tokens).length <= 24, "Too many design values.")
    .transform((tokens) => normalizeTokens(tokens)),
});
export const urlInput = z.object({ url: z.string().trim().min(3).max(500) });
export const screenshotInput = z.object({
  image: z
    .string()
    .max(4_000_000, "That screenshot is too large. Try a smaller one.")
    .regex(
      /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/,
      "Upload a PNG, JPG or WebP screenshot.",
    ),
  rx: z.string().max(1500).optional(),
});
