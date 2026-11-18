import { describe, expect, it } from "vitest";
import { afterAnswer, questionCount, STEPS } from "@/lib/design";

describe("short version", () => {
  it("asks three questions instead of eight", () => {
    expect(questionCount(true)).toBe(3);
    expect(questionCount(false)).toBe(STEPS.length);
  });
  it("goes to the Vision after the third answer in the short version", () => {
    expect(afterAnswer(2, true).stage).toBe("review");
    expect(afterAnswer(2, false)).toEqual({ stage: "exam", stepIndex: 3 });
  });
});

import { resumeLabel } from "@/lib/library";
describe("continue a saved design", () => {
  it("names the next question, counting the short version as 3", () => {
    expect(resumeLabel({ stage: "exam", stepIndex: 4, picks: [1, 2, 3, 4] })).toBe("Continue at question 5 of 8");
    expect(resumeLabel({ stage: "exam", stepIndex: 1, picks: [1], quick: true })).toBe("Continue at question 2 of 3");
    expect(resumeLabel({ stage: "rx", picks: [] })).toBe("Open its Vision");
  });
});
