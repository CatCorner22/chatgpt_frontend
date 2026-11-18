import { useEffect, useRef, useState } from "react";
import { Input } from "./ui/input";
import { Slider } from "./ui/slider";

/** Browser-only screenshots: never upload, persist or execute customer page HTML. */
export function BeforeAfter() {
  const [images, setImages] = useState({ before: "", after: "" });
  const [amount, setAmount] = useState(50);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState({ before: false, after: false });
  const urls = useRef({ before: "", after: "" });
  const pending = useRef<Partial<Record<"before" | "after", () => void>>>({});
  useEffect(
    () => () => {
      Object.values(pending.current).forEach((cancel) => cancel());
      Object.values(urls.current)
        .filter(Boolean)
        .forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  const choose = (kind: "before" | "after", file?: File) => {
    if (!file) return;
    pending.current[kind]?.();
    setChecking((old) => ({ ...old, [kind]: false }));
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 8_000_000) {
      setError("Choose a PNG, JPG or WebP under 8 MB. Your previous picture is unchanged.");
      return;
    }
    const url = URL.createObjectURL(file);
    const candidate = new Image();
    const detach = () => {
      clearTimeout(timer);
      candidate.onload = null;
      candidate.onerror = null;
      if (pending.current[kind] === cancel) delete pending.current[kind];
    };
    const cancel = () => {
      detach();
      URL.revokeObjectURL(url);
    };
    const reject = () => {
      cancel();
      setChecking((old) => ({ ...old, [kind]: false }));
      setError(
        "This screenshot could not be read. Choose another PNG, JPG or WebP. Your previous picture is unchanged.",
      );
    };
    pending.current[kind] = cancel;
    candidate.onload = () => {
      if (!candidate.naturalWidth || !candidate.naturalHeight) {
        reject();
        return;
      }
      detach();
      if (urls.current[kind]) URL.revokeObjectURL(urls.current[kind]);
      urls.current[kind] = url;
      setImages((old) => ({ ...old, [kind]: url }));
      setChecking((old) => ({ ...old, [kind]: false }));
      setError("");
    };
    candidate.onerror = reject;
    const timer = setTimeout(reject, 10000);
    setChecking((old) => ({ ...old, [kind]: true }));
    setError("");
    candidate.src = url;
  };
  return (
    <section
      className="space-y-3 border-y border-border py-5"
      aria-label="Before and after comparison"
    >
      <h2 className="font-display text-2xl">Your site, before and after</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {(["before", "after"] as const).map((kind) => (
          <label className="block text-sm" key={kind}>
            {kind === "before" ? "Original screenshot" : "Restyled screenshot"}
            <Input
              className="mt-1"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                choose(kind, e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {(checking.before || checking.after) && (
        <p role="status" className="text-sm text-muted-foreground">
          Checking the screenshot…
        </p>
      )}
      {images.before && images.after && (
        <>
          <div className="relative aspect-[4/3] overflow-hidden rounded-sm border border-border bg-muted">
            <img
              src={images.after}
              alt="Restyled site"
              className="absolute h-full w-full object-contain"
            />
            <img
              src={images.before}
              alt="Original site"
              className="absolute h-full w-full object-contain"
              style={{ clipPath: `inset(0 ${100 - amount}% 0 0)` }}
            />
            <span
              className="absolute inset-y-0 w-px bg-foreground"
              style={{ left: `${amount}%` }}
              aria-hidden
            />
            <span className="absolute top-2 left-2 bg-background px-2 text-xs">Before</span>
            <span className="absolute top-2 right-2 bg-background px-2 text-xs">After</span>
          </div>
          <Slider
            aria-label="Before and after split"
            value={[amount]}
            onValueChange={(value) => setAmount(value[0] ?? 50)}
            min={0}
            max={100}
            className="min-h-11"
          />
        </>
      )}
      <p className="text-xs text-muted-foreground">
        Pictures stay in this browser and disappear when you leave. Use the same page and screen
        size. This visual comparison does not test working features.
      </p>
    </section>
  );
}
