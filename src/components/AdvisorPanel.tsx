import { useState } from "react";
import { Download, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { advisorReport, type Advice } from "@/lib/advisor";
import { downloadBlob } from "@/lib/exportPack";

export function AdvisorPanel({
  target,
  summary,
  priorities,
  brief,
  measured,
}: {
  target: string;
  summary: string;
  priorities: Advice[];
  brief: string;
  measured: boolean;
}) {
  const [business, setBusiness] = useState("");
  const [client, setClient] = useState("");
  return (
    <section className="border-t border-border pt-6" aria-labelledby="advisor-title">
      <div className="flex items-center gap-2">
        <Briefcase className="size-5" />
        <h2 id="advisor-title" className="font-display text-3xl">
          Report for a client
        </h2>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Your business name
          <Input
            className="mt-1"
            value={business}
            maxLength={120}
            onChange={(e) => setBusiness(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Client or project
          <Input
            className="mt-1"
            value={client}
            maxLength={120}
            onChange={(e) => setClient(e.target.value)}
          />
        </label>
      </div>
      <Button
        className="mt-4"
        variant="outline"
        onClick={() => {
          try {
            const report = advisorReport({
              business,
              client,
              target,
              summary,
              priorities,
              brief,
              measured,
            });
            downloadBlob(
              new Blob([report], { type: "text/markdown" }),
              "client-design-improvement-plan.md",
            );
          } catch {
            toast.error("Could not download the client plan.");
          }
        }}
      >
        <Download />
        Download client improvement plan
      </Button>
    </section>
  );
}
