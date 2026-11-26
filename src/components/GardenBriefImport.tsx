import { useEffect, useRef, useState } from "react";
import { getBrowserOwnerId } from "@/lib/browser-storage";
import {
  importGardenJourney,
  MAX_JOURNEY_FILE_BYTES,
  type GardenJourney,
} from "@/lib/garden-journey";

export function GardenBriefImport({
  designId,
  onLoad,
}: {
  designId: string | null;
  onLoad: (brief: GardenJourney) => void;
}) {
  const [error, setError] = useState("");
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  return (
    <details className="garden-options">
      <summary>Open a downloaded brief</summary>
      <label>
        Choose a Focus journey JSON file
        <input
          type="file"
          accept=".json,application/json"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            const attempt = ++request.current;
            setError("");
            if (!file) return;
            try {
              const owner = getBrowserOwnerId();
              if (file.size > MAX_JOURNEY_FILE_BYTES)
                throw new Error("This journey file is too large.");
              const brief = importGardenJourney(await file.text(), designId);
              if (request.current !== attempt || getBrowserOwnerId() !== owner) return;
              onLoad(brief);
            } catch (cause) {
              if (request.current === attempt)
                setError(cause instanceof Error ? cause.message : "This file could not be opened.");
            }
          }}
        />
      </label>
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
