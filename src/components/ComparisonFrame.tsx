import { useEffect, useRef, useState } from "react";
import "./composition-comparison.css";

export function ComparisonFrame({
  html,
  title,
  size,
  onLoad,
}: {
  html: string;
  title: string;
  size: "phone" | "desktop";
  onLoad?: () => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const [availableWidth, setWidth] = useState(0);
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    setWidth(element.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const width = size === "phone" ? 320 : 1024;
  const height = size === "phone" ? 610 : 740;
  const scale = availableWidth ? Math.min(1, availableWidth / width) : 1;
  return (
    <div className="layout-comparison-stage" ref={stage} style={{ height: height * scale }}>
      <div style={{ width: width * scale, height: height * scale, marginInline: "auto" }}>
        <iframe
          key={html}
          title={title}
          onLoad={onLoad}
          srcDoc={html}
          sandbox=""
          referrerPolicy="no-referrer"
          style={{ width, height, transform: `scale(${scale})` }}
        />
      </div>
    </div>
  );
}
