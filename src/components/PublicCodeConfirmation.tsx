import { needsPublicCodeConfirmation } from "@/lib/action-destination";

export function PublicCodeConfirmation({
  url,
  confirmed,
  onChange,
}: {
  url: string;
  confirmed: boolean;
  onChange: (checked: boolean) => void;
}) {
  if (!needsPublicCodeConfirmation(url)) return null;
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        className="mt-1"
        checked={confirmed}
        onChange={(event) => onChange(event.target.checked)}
      />
      This code is public, like a coupon. Include it when I share this link.
    </label>
  );
}
