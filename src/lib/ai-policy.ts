// Spending remains disabled until the owner explicitly approves launch costs.
export const AI_SPENDING_ENABLED = false;
export const AI_PAUSED_MESSAGE =
  "Paid AI requests are paused until launch approval. Saved designs, manual choices and measured site checks remain available.";

export async function withAiReservation<T>(
  enabled: boolean,
  reserve: () => Promise<string>,
  release: (ticket: string) => Promise<void>,
  run: () => Promise<T>,
): Promise<T> {
  if (!enabled) throw new Error(AI_PAUSED_MESSAGE);
  const ticket = await reserve();
  try {
    return await run();
  } finally {
    // A release failure cannot turn a completed response into a false failure.
    // The 120-second lease recovers abandoned work; old tickets cannot clear new leases.
    await release(ticket).catch(() =>
      console.error("AI reservation release failed; lease will expire."),
    );
  }
}
