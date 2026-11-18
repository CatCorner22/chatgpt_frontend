// Pure provider choice so Focus's AI can move between services by one setting.
export type AiProvider = "lovable" | "anthropic" | "openai";

export const PROVIDER_KEYS: Record<AiProvider, string> = {
  lovable: "LOVABLE_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
};

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  lovable: "openai/gpt-6.1-sol",
  anthropic: "claude-sonnet-5",
  openai: "gpt-6.1-sol",
};

export function chooseProvider(env: Record<string, string | undefined>): { provider: AiProvider; apiKey: string; model: string } {
  const raw = (env["AI_PROVIDER"] ?? "lovable").trim().toLowerCase() || "lovable";
  if (!(raw in PROVIDER_KEYS)) throw new Error("AI is not configured.");
  const provider = raw as AiProvider;
  const apiKey = env[PROVIDER_KEYS[provider]]?.trim();
  if (!apiKey) throw new Error("AI is not configured.");
  const model = env["AI_MODEL"]?.trim() || DEFAULT_MODELS[provider];
  return { provider, apiKey, model };
}
