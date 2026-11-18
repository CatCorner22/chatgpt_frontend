import { z } from "zod";
import { findPlaceholder } from "./tells";

const text = (max = 1000) =>
  z
    .string()
    .trim()
    .min(1, "Add real content.")
    .max(max)
    .superRefine((value, ctx) => {
      const phrase = findPlaceholder(value);
      if (phrase)
        ctx.addIssue({
          code: "custom",
          message: `Replace the placeholder “${phrase}” with your own content.`,
        });
    });
export const briefSchema = z
  .object({
    businessName: text(200),
    description: text(600),
    audience: text(600),
    mainJob: text(600),
    headline: text(300),
    features: z
      .array(z.object({ title: text(150), description: text(1200) }).strict())
      .min(3)
      .max(8),
    contact: z
      .object({
        email: z.string().trim().email().optional(),
        phone: text(80).optional(),
        address: text(500).optional(),
        url: z
          .string()
          .trim()
          .url()
          .refine((value) => /^https?:\/\//i.test(value), "Use an HTTP or HTTPS address.")
          .optional(),
      })
      .strict()
      .superRefine((contact, ctx) => {
        if (!Object.values(contact).some(Boolean))
          ctx.addIssue({
            code: "custom",
            message: "Add at least one genuine way to contact the business.",
          });
        for (const [key, value] of Object.entries(contact)) {
          if (!value) continue;
          if (
            findPlaceholder(value) ||
            /(?:^|[.@/])example\.(?:com|org|net)(?:[/:]|$)/i.test(value)
          ) {
            ctx.addIssue({
              code: "custom",
              path: [key],
              message: "Replace the example contact detail with a real one.",
            });
          }
        }
      }),
    proof: z
      .array(
        z
          .object({
            kind: z.enum(["testimonial", "number", "client"]),
            content: text(1600),
            attribution: text(500),
            source: text(1000),
          })
          .strict(),
      )
      .min(1)
      .max(12),
    voice: z
      .object({
        formality: z.enum(["formal", "conversational"]),
        energy: z.enum(["calm", "lively"]),
        detail: z.enum(["concise", "expansive"]),
      })
      .strict(),
    wordsToAvoid: z.array(z.string().trim().min(1).max(100)).max(50),
  })
  .strict();
export type Brief = z.infer<typeof briefSchema>;
export const briefLimit =
  "Validation checks structure and common placeholders only. A person must verify contact details, permission to use testimonials or client names, and the truth and context of every claim.";
export function validateBrief(value: unknown) {
  const result = briefSchema.safeParse(value);
  if (result.success) return { valid: true as const, data: result.data, issues: [] };
  return {
    valid: false as const,
    issues: result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  };
}
