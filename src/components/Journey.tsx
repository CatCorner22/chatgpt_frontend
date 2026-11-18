import { Link } from "@tanstack/react-router";
import { Button } from "./ui/button";

export function Journey({ current }: { current: 0 | 1 | 2 | 3 }) {
  return <nav aria-label="Design journey" className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 border-b border-border px-5 py-3 text-xs md:px-10">
    {["Start", "Look", "Hand-off", "Proof"].map((name, i) => <span key={name} aria-current={i === current ? "step" : undefined} className={i === current ? "font-semibold text-foreground" : "text-muted-foreground"}>{i + 1}. {name}</span>)}
    {current === 2 && <Button asChild variant="link" size="sm"><Link to="/critic">Built it? Check my site</Link></Button>}
  </nav>;
}