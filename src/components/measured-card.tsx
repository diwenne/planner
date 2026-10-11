"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

interface MeasuredCardProps {
  id: string;
  // Called with the card's layout size (unaffected by canvas zoom), and null when it unmounts.
  onSize: (id: string, size: { w: number; h: number } | null) => void;
  style: CSSProperties;
  children: ReactNode;
}

// Absolutely-positioned canvas card that reports its rendered size, which changes as
// content is typed, so overlaps can be detected against real dimensions.
export default function MeasuredCard({ id, onSize, style, children }: MeasuredCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const report = () => onSize(id, { w: el.offsetWidth, h: el.offsetHeight });
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => {
      observer.disconnect();
      onSize(id, null);
    };
  }, [id, onSize]);

  return (
    <div ref={ref} style={style}>
      {children}
    </div>
  );
}
