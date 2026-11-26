import { useCallback, useEffect, useRef, useState } from "react";
import { readPageImage, savePageImage } from "@/lib/page-settings";
import { validatePageImageAsset } from "@/lib/page-image-asset";
import { getBrowserOwnerId } from "@/lib/browser-storage";

/** Keep a late upload or decode attached to its original project and image slot. */
export function usePageImage(id: string | null, project: string, onSelect: (id: string) => void) {
  const generation = useRef(0);
  const nextRequest = useCallback(() => ++generation.current, []);
  const latest = useRef({ id, project, onSelect });
  latest.current = { id, project, onSelect };
  const [snapshot, setSnapshot] = useState<{ id: string; project: string; src: string } | null>(
    null,
  );
  const [uploading, setUploading] = useState(false);
  const [hydrating, setHydrating] = useState(false);
  const [error, setError] = useState("");
  const src = snapshot?.id === id && snapshot?.project === project ? snapshot.src : null;
  useEffect(() => {
    let active = true;
    nextRequest();
    setUploading(false);
    setError("");
    setHydrating(!!id);
    if (!id) setSnapshot(null);
    else
      void (async () => {
        const owner = getBrowserOwnerId();
        const data = await validatePageImageAsset(id, readPageImage(id));
        if (!active) return;
        if (owner !== getBrowserOwnerId())
          throw new Error("Your account changed. Reload before adding an image.");
        setSnapshot({ id, project, src: data });
      })()
        .catch((failure: unknown) => {
          if (active) {
            setSnapshot(null);
            setError(
              failure instanceof Error
                ? failure.message
                : "This image could not be checked. Choose it again or remove it.",
            );
          }
        })
        .finally(() => {
          if (active) setHydrating(false);
        });
    return () => {
      active = false;
      nextRequest();
    };
  }, [id, project, nextRequest]);

  async function choose(file: File | undefined) {
    if (!file) return;
    const token = nextRequest();
    const current = () =>
      token === generation.current &&
      latest.current.id === id &&
      latest.current.project === project;
    setUploading(true);
    setError("");
    try {
      const owner = getBrowserOwnerId();
      const nextId = await savePageImage(file);
      if (!current()) return;
      if (owner !== getBrowserOwnerId())
        throw new Error("Your account changed. Reload before adding an image.");
      const data = await validatePageImageAsset(nextId, readPageImage(nextId));
      if (!current()) return;
      if (owner !== getBrowserOwnerId())
        throw new Error("Your account changed. Reload before adding an image.");
      setSnapshot({ id: nextId, project, src: data });
      latest.current.onSelect(nextId);
    } catch (failure) {
      if (current())
        setError(failure instanceof Error ? failure.message : "This image could not be added.");
    } finally {
      if (current()) setUploading(false);
    }
  }
  function cancel() {
    nextRequest();
    setUploading(false);
    setError("");
  }
  return { src, loading: uploading || hydrating, error, choose, cancel };
}
