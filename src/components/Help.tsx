import { useState } from "react";
import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cardFor } from "@/lib/knowledge";
import { GLOSSARY, type Term } from "@/lib/glossary";

// Short hint on hover, keyboard focus or tap. Keep essential information visible on the page too.
// Explains on hover (mouse) and on tap (phone): the same bubble, opened either way.
export function HelpTip({ tip, children }: { tip: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger
          asChild
          onClick={() => setOpen(true)}
          onPointerDown={(e) => {
            if (e.pointerType !== "mouse") e.preventDefault();
          }}
        >
          {children}
        </TooltipTrigger>
        <TooltipContent className="max-w-64" onPointerDownOutside={() => setOpen(false)}>
          {tip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Tap-friendly "Why?" that explains a rule from its knowledge card.
export function WhyPopover({ cardId, label = "Why?" }: { cardId: string; label?: string }) {
  const c = cardFor(cardId);
  if (!c) return null;
  return (
    <Popover>
      <PopoverTrigger className="inline-flex min-h-6 items-center rounded-sm px-1 text-xs text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring">
        {label}
      </PopoverTrigger>
      <PopoverContent className="w-72 text-sm">
        <p className="font-semibold">{c.name}</p>
        <p className="mt-1 text-muted-foreground">{c.purpose}</p>
        <p className="mt-2">
          <span className="font-medium">Minimum: </span>
          {c.floor}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Source (evidence {c.grade}): {c.evidence}
        </p>
      </PopoverContent>
    </Popover>
  );
}

// "What's this?" for a glossary term.
export function Term({ term, children }: { term: Term; children?: ReactNode }) {
  const g = GLOSSARY[term];
  return (
    <Popover>
      <PopoverTrigger className="cursor-help underline decoration-dotted underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">
        {children ?? g.plain}
      </PopoverTrigger>
      <PopoverContent className="w-72 text-sm">
        <p className="font-semibold capitalize">{g.plain}</p>
        <p className="mt-1 text-muted-foreground">{g.def}</p>
      </PopoverContent>
    </Popover>
  );
}
