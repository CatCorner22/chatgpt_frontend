import { useRef, useState } from "react";
import type { BrowserAudit } from "@/lib/browser-audit";

/** Mounted for a single imported receipt. The comparison happens entirely on this device. */
export function BrowserAuditFileMatch({
  entry,
}: {
  entry: NonNullable<BrowserAudit["entryHtml"]>;
}) {
  const selection = useRef(0);
  const [message, setMessage] = useState("");
  async function compare(file: File) {
    const attempt = ++selection.current;
    setMessage("Comparing the selected file…");
    if (file.size !== entry.bytes) {
      setMessage("The file size changed. Run the browser checks on this version.");
      return;
    }
    try {
      const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      const actual = Array.from(new Uint8Array(hash), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      if (attempt === selection.current) {
        setMessage(
          actual === entry.sha256
            ? "These HTML bytes match the receipt. Linked files and services need their own checks."
            : "The HTML contents changed. Run the browser checks on this version.",
        );
      }
    } catch {
      if (attempt === selection.current)
        setMessage(
          "This browser could not compare the file. Open Focus in a secure browser and try again.",
        );
    }
  }
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer py-2 font-medium">
        Compare your HTML file with this receipt
      </summary>
      <p className="my-2 max-w-2xl text-muted-foreground">
        Choose the delivered HTML. Focus compares its contents locally with the file recorded by the
        runner.
      </p>
      <input
        type="file"
        aria-label="Compare delivered HTML"
        accept=".html,.htm,text/html"
        className="my-2 block max-w-full"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void compare(file);
        }}
      />
      <p role="status" className="text-sm">
        {message}
      </p>
    </details>
  );
}
