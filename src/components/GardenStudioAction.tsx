import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import type { GardenGoal } from "@/lib/garden-content";
import { stratosphereSearch } from "@/lib/garden-navigation";
import { requestLibraryOpen } from "@/lib/library-open";
import type { StratosphereGroupId } from "@/lib/stratosphere";

export function GardenStudioAction({
  designId,
  group,
  start,
  className,
  children,
}: {
  designId: string | null;
  group?: StratosphereGroupId | undefined;
  start?: GardenGoal;
  className: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  const destination = group ? stratosphereSearch(group) : { view: "studio" as const };
  if (!designId)
    return (
      <Link
        to="/"
        search={!group && start ? { ...destination, start } : destination}
        className={className}
      >
        {children}
      </Link>
    );
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={async () => {
          try {
            await navigate({ to: "/", search: destination, state: requestLibraryOpen(designId) });
          } catch {
            setFailed(true);
          }
        }}
      >
        {children}
      </button>
      {failed && <p role="alert">Open this saved design from My designs to continue in Studio.</p>}
    </>
  );
}
