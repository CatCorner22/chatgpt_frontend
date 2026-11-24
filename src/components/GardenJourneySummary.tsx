import { GARDEN_STEPS } from "@/lib/garden-content";
import { JOURNEY_FIELDS, type GardenJourney } from "@/lib/garden-journey";

export function GardenJourneySummary({ brief }: { brief: GardenJourney }) {
  return (
    <dl className="my-3 space-y-3">
      {JOURNEY_FIELDS.filter(({ id }) => brief[id]).map(({ id, label }) => (
        <div key={id}>
          <dt className="font-medium">{label}</dt>
          <dd className="whitespace-pre-wrap break-words">{brief[id]}</dd>
        </div>
      ))}
      {GARDEN_STEPS.map((step) => {
        const answer = brief.decisions[step.id];
        if (!answer || (!answer.choice && !answer.note)) return null;
        return (
          <div key={step.id}>
            <dt className="font-medium">{step.title}</dt>
            {answer.choice && (
              <dd>{step.choices.find((item) => item.id === answer.choice)?.title}</dd>
            )}
            {answer.note && <dd className="whitespace-pre-wrap break-words">{answer.note}</dd>}
          </div>
        );
      })}
    </dl>
  );
}
