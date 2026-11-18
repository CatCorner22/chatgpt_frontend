// Wait status in words; a Cancel button appears once a wait passes 10 seconds.
export function WaitLine({
  wait,
  onCancel,
}: {
  wait: { text: string; canCancel: boolean } | null;
  onCancel: () => void;
}) {
  if (!wait) return null;
  return (
    <p
      role="status"
      aria-live="polite"
      className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"
    >
      <span
        className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent motion-reduce:animate-none"
        aria-hidden
      />
      {wait.text}
      {wait.canCancel && (
        <button type="button" className="min-h-6 px-1 font-medium text-foreground underline" onClick={onCancel}>
          Cancel
        </button>
      )}
    </p>
  );
}
