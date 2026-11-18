import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WaitLine } from "@/components/WaitLine";
import { useCancellable, useWait } from "@/hooks/useUx";
import { checkSite } from "@/lib/northstar.functions";

type Result = Awaited<ReturnType<typeof checkSite>>;
const path = (u: string) => {
  const x = new URL(u);
  return x.pathname === "/" ? x.hostname : x.pathname;
};

/** Scores up to 10 pages of one site and names the pages that drift from the rest. */
export function WholeSiteCheck({ url }: { url: string }) {
  const run = useServerFn(checkSite);
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<Result | null>(null);
  const [err, setErr] = useState("");
  const job = useCancellable();
  const wait = useWait(busy, "Checking up to 10 pages of this site");
  const go = async () => {
    const id = job.start();
    setBusy(true);
    setErr("");
    setR(null);
    try {
      const res = await run({ data: { url } });
      if (job.current(id)) setR(res);
    } catch (e) {
      if (job.current(id)) setErr((e as Error).message);
    } finally {
      if (job.current(id)) setBusy(false);
    }
  };
  const ok = r?.pages.filter((p) => !p.error) ?? [];
  return (
    <section className="mt-8 rounded-sm border border-border bg-card p-5" aria-labelledby="whole-h">
      <h2 id="whole-h" className="flex items-center gap-2 font-semibold">
        <Layers className="size-4" aria-hidden />
        Check the whole site
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Follows up to 9 links on the same site, scores every page, and names pages whose fonts or
        colors don't match the rest. Measured only.
      </p>
      <Button
        className="mt-3"
        variant="outline"
        disabled={busy || url.trim().length < 4}
        onClick={() => void go()}
      >
        {busy ? "Checking pages…" : "Check up to 10 pages"}
      </Button>
      <WaitLine
        wait={wait}
        onCancel={() => {
          job.cancel();
          setBusy(false);
        }}
      />
      {err && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {err}
        </p>
      )}
      {r && (
        <div className="mt-4 space-y-4">
          <p className="text-sm font-semibold" role="status">
            {ok.length} {ok.length === 1 ? "page" : "pages"} checked
            {ok.length ? ` · lowest score ${Math.min(...ok.map((p) => p.score))}` : ""}
            {r.skipped ? ` · ${r.skipped} skipped to stay within time` : ""}
          </p>
          {r.drift.length ? (
            <div className="rounded-sm border border-destructive p-3 text-sm">
              <p className="font-semibold">Pages that don't match the rest of the site</p>
              <ul className="mt-1 list-disc pl-5">
                {r.drift.map((d) => (
                  <li key={d.url}>
                    {path(d.url)} {d.reason}.
                  </li>
                ))}
              </ul>
            </div>
          ) : ok.length > 1 ? (
            <p className="text-sm">Every checked page uses the same fonts and main colors.</p>
          ) : null}
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="w-1/2 py-1 font-normal">Page</th>
                <th className="py-1 font-normal">Quality score</th>
                <th className="py-1 font-normal">Problems</th>
              </tr>
            </thead>
            <tbody>
              {r.pages.map((p) => (
                <tr key={p.url} className="border-t border-border">
                  <td className="max-w-0 truncate py-1.5 pr-2" title={p.url}>
                    {path(p.url)}
                  </td>
                  <td className="py-1.5">{p.error ? "—" : p.score}</td>
                  <td className="py-1.5">{p.error ?? p.fails}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
