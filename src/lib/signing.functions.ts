import { createServerFn } from "@tanstack/react-start";
import { signId } from "./signing.server";

// Signs a design ID for a downloaded pack so Check a site can tell Focus-issued tags from copies.
export const signDesignId = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => {
    const id = String(d?.id ?? "");
    if (!/^f-[0-9a-f]{10}$/.test(id)) throw new Error("Not a design ID.");
    return { id };
  })
  .handler(async ({ data }) => ({ sig: await signId(data.id) }));
