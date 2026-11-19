import type { PendingExportReceipt } from "@/hooks/useExportReceipt";
import { Button } from "@/components/ui/button";

export function ExportReceipt({ receipt }: { receipt: PendingExportReceipt | null }) {
  if (!receipt) return null;
  return (
    <div className="space-y-2 rounded-sm border border-border bg-card p-3 text-sm">
      <p role="status">
        Focus cannot confirm that {receipt.filename} reached your device. Check your downloads and
        open the file before confirming. This download will not mark work as saved until you
        confirm.
      </p>
      <Button variant="outline" onClick={receipt.confirm}>
        I’ve saved the file
      </Button>
    </div>
  );
}
