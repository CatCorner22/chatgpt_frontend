import { reviewerPacketSchema } from "../../north-star-kit/blind-test/reviewer";

export function packetFixture() {
  const dimensions = [
    "hierarchy",
    "typography",
    "composition",
    "distinctiveness",
    "interaction",
    "content",
  ] as const;
  const titles = [
    "Hierarchy",
    "Reading and typography",
    "Composition and detail",
    "Fit and distinctiveness",
    "Interaction clarity",
    "Content and credibility",
  ];
  return reviewerPacketSchema.parse({
    version: 1,
    benchmarkId: "study-one",
    title: "Independent page review",
    instructions: "Try each page on its own before comparing observations.",
    tasks: [
      {
        id: "booking",
        title: "Book a visit",
        family: "service",
        brief: "A repair shop offers appointments.",
        task: "Find the available appointment.",
        successCriterion: "The intended appointment reaches confirmation.",
        viewport: { width: 390, height: 844 },
      },
    ],
    samples: [
      {
        id: "sample-a",
        taskId: "booking",
        label: "Sample 1",
        assetRef: "https://review.test/a",
        kind: "interactive",
      },
      {
        id: "sample-b",
        taskId: "booking",
        label: "Sample 2",
        assetRef: "https://review.test/b",
        kind: "image",
      },
    ],
    dimensions: dimensions.map((id, index) => ({
      id,
      title: titles[index]!,
      low: "The task is difficult.",
      middle: "The task is understandable.",
      high: "The task is consistently clear.",
    })),
  });
}
