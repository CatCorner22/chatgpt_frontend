import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import type { z } from "zod";
import { createLovableAiGatewayRunIdFetch } from "./run-id.server";
import { chooseProvider } from "./ai-provider";
import { AI_SPENDING_ENABLED, AI_PAUSED_MESSAGE, withAiReservation } from "./ai-policy";

export async function askObject<T>(
  userId: string,
  schema: z.ZodType<T>,
  instructions: string,
  prompt: string,
  image?: string,
): Promise<T> {
  // Fail closed before provider setup, database reservations or any paid call.
  if (!AI_SPENDING_ENABLED) throw new Error(AI_PAUSED_MESSAGE);
  if (!userId) throw new Error("Sign in before requesting AI.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return withAiReservation(
    AI_SPENDING_ENABLED,
    async () => {
      const { data, error } = await supabaseAdmin.rpc("reserve_ai_request", { _user_id: userId });
      if (error || !data) {
        if (error?.message.includes("already running"))
          throw new Error("One AI request is already running. Wait for it to finish.");
        if (error?.message.includes("Six AI requests"))
          throw new Error(
            "Six AI requests started in the last minute. Wait one minute and try again.",
          );
        throw new Error("AI protection is unavailable. No AI request was started.");
      }
      return data;
    },
    async (ticket) => {
      const { error } = await supabaseAdmin.rpc("release_ai_request", {
        _user_id: userId,
        _ticket: ticket,
      });
      if (error) throw error;
    },
    () => runObject(schema, instructions, prompt, image),
  );
}

async function runObject<T>(
  schema: z.ZodType<T>,
  instructions: string,
  prompt: string,
  image?: string,
): Promise<T> {
  const { model, providerOptions } = await getModel();
  const result = streamText({
    model,
    instructions,
    prompt: image
      ? [
          {
            role: "user" as const,
            content: [
              { type: "text" as const, text: prompt },
              { type: "image" as const, image },
            ],
          },
        ]
      : prompt,
    output: Output.object({ schema }),
    maxRetries: 0,
    maxOutputTokens: 6000,
    abortSignal: AbortSignal.timeout(90_000),
    providerOptions,
  });
  try {
    return (await result.output) as T;
  } catch (e) {
    if (NoObjectGeneratedError.isInstance(e))
      throw new Error("The AI returned an unusable answer. Please try again.");
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 402)
      throw new Error("AI credits have run out. Add credits in your workspace to continue.");
    if (status === 429)
      throw new Error("Too many requests right now. Wait a moment and try again.");
    console.error(e);
    throw new Error("The AI request failed. Please try again.");
  }
}

// The only place that knows which AI service is used. Switch with AI_PROVIDER (+ that service's key).
async function getModel() {
  const { provider, apiKey, model } = chooseProvider(process.env);
  if (provider === "anthropic") {
    const { createAnthropic } = await import("@ai-sdk/anthropic");
    return { model: createAnthropic({ apiKey })(model), providerOptions: {} };
  }
  const openaiOptions = {
    openai: {
      store: false,
      forceReasoning: true,
      reasoningEffort: "low",
      reasoningSummary: "auto",
      include: ["reasoning.encrypted_content"],
    },
  };
  if (provider === "openai")
    return { model: createOpenAI({ apiKey }).responses(model), providerOptions: openaiOptions };
  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const gateway = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  return { model: gateway.responses(model), providerOptions: openaiOptions };
}
