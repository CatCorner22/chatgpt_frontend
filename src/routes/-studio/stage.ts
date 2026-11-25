import type { State } from "@/lib/studio-state";
import type { Purpose } from "@/lib/engine";

export type StudioStageProps = {
  s: State;
  update: (p: Partial<State>) => void;
  ask?: (k: "new" | "retake") => void;
};

export const purposeText = (p: Purpose) =>
  [
    p.audience && `audience: ${p.audience}`,
    p.tone && `tone: ${p.tone}`,
    p.goal && `main visitor goal: ${p.goal}`,
    p.device && `visitors use: ${p.device}`,
    p.reading && `amount of text: ${p.reading}`,
    p.experience && `building: ${p.experience}`,
  ]
    .filter(Boolean)
    .join("; ");
