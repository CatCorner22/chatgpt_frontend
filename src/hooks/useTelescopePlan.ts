import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { focusLocalStorage } from "@/lib/browser-storage";
import { handoffAnswer } from "@/lib/handoff-field";
import { TELESCOPE_STATES } from "@/lib/telescope";
import { useDraftExitSave } from "./useDraftExitSave";

export const TELESCOPE_PLAN_KEY = "focus:telescope-plan:v1";

const planSchema = z
  .object({
    version: z.literal(1),
    task: handoffAnswer(1000),
    expectations: z.partialRecord(z.enum(TELESCOPE_STATES), handoffAnswer(1000)),
  })
  .strict();
type Plan = z.infer<typeof planSchema>;
const blankPlan: Plan = { version: 1, task: "", expectations: {} };
const changedElsewhere =
  "A different task plan was saved in another tab. Reload the saved plan to use that version.";
const unreadable =
  "The saved Telescope task plan could not be read. The original copy is still in this browser.";

function parse(raw: string): Plan {
  if (raw.length > 64_000) throw new Error(unreadable);
  try {
    return planSchema.parse(JSON.parse(raw));
  } catch {
    throw new Error(unreadable);
  }
}

/** Only the editable text belongs in this draft. Inspection input and receipts stay in memory. */
export function useTelescopePlan() {
  const [plan, setPlan] = useState<Plan>(blankPlan);
  const [ready, setReady] = useState(false);
  const [stored, setStored] = useState(false);
  const [issue, setIssue] = useState("");
  const [unsaved, setUnsaved] = useState(false);
  const expected = useRef<string | null | undefined>(undefined);
  const readable = useRef(false);
  const pending = useRef<Plan | null>(null);

  function reload() {
    try {
      const raw = focusLocalStorage.getItem(TELESCOPE_PLAN_KEY);
      expected.current = raw;
      setStored(raw !== null);
      readable.current = false;
      const saved = raw === null ? blankPlan : parse(raw);
      readable.current = true;
      pending.current = null;
      setPlan(saved);
      setUnsaved(false);
      setIssue("");
    } catch (error) {
      setIssue(
        error instanceof Error && error.message === unreadable
          ? unreadable
          : "Browser storage is unavailable. Your edits can stay in this tab.",
      );
    }
  }

  useEffect(() => {
    reload();
    setReady(true);
  }, []);

  function flush() {
    const next = pending.current;
    if (!next) return true;
    if (!readable.current && expected.current !== undefined) return false;
    const validated = planSchema.safeParse(next);
    if (!validated.success) {
      setIssue(
        "Use up to 1,000 characters per field and remove hidden characters, credentials or secret URLs before saving.",
      );
      return false;
    }
    try {
      const raw = JSON.stringify(validated.data);
      const current = focusLocalStorage.getItem(TELESCOPE_PLAN_KEY);
      if (expected.current === undefined) {
        // An unreadable first load gives us no authority to replace an existing draft.
        if (current !== null) {
          setIssue(changedElsewhere);
          return false;
        }
        expected.current = null;
        readable.current = true;
      }
      if (current !== raw) {
        if (current !== expected.current) {
          setIssue(changedElsewhere);
          return false;
        }
        focusLocalStorage.setItem(TELESCOPE_PLAN_KEY, raw);
        if (focusLocalStorage.getItem(TELESCOPE_PLAN_KEY) !== raw) throw new Error();
      }
      expected.current = raw;
      setStored(true);
      pending.current = null;
      setUnsaved(false);
      setIssue("");
      return true;
    } catch {
      setIssue("Focus couldn’t confirm the save. Keep this tab open and retry saving your plan.");
      return false;
    }
  }
  useDraftExitSave(flush, { handlesRouter: true });

  function change(next: Plan) {
    pending.current = next;
    setPlan(next);
    setUnsaved(true);
    flush();
  }

  function clear() {
    try {
      const current = focusLocalStorage.getItem(TELESCOPE_PLAN_KEY);
      if (current !== null && current !== expected.current) {
        setIssue(changedElsewhere);
        return false;
      }
      if (current !== null) {
        focusLocalStorage.removeItem(TELESCOPE_PLAN_KEY);
        if (focusLocalStorage.getItem(TELESCOPE_PLAN_KEY) !== null) throw new Error();
      }
      expected.current = null;
      setStored(false);
      readable.current = true;
      pending.current = null;
      setPlan(blankPlan);
      setUnsaved(false);
      setIssue("");
      return true;
    } catch {
      setIssue(
        "Focus couldn’t confirm that the saved plan was cleared. Your work remains open here.",
      );
      return false;
    }
  }

  return { plan, ready, stored, issue, unsaved, flush, change, reload, clear };
}
