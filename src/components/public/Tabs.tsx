"use client";

import { useId, useState } from "react";

export interface TabPanel {
  key: string;
  label: string;
  content: React.ReactNode;
}

/** Tab phía client; nội dung các tab đã được render sẵn ở server. */
export function Tabs({ panels, title, className = "" }: { panels: TabPanel[]; title?: React.ReactNode; className?: string }) {
  const [active, setActive] = useState(0);
  const id = useId();
  if (panels.length === 0) return null;
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") setActive((a) => (a + 1) % panels.length);
    if (e.key === "ArrowLeft") setActive((a) => (a - 1 + panels.length) % panels.length);
  };
  return (
    <div className={className}>
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        {title}
        <div role="tablist" className="flex max-w-full gap-2 overflow-x-auto [scrollbar-width:none]" onKeyDown={onKey}>
          {panels.map((p, i) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              id={`${id}-tab-${i}`}
              aria-selected={i === active}
              aria-controls={`${id}-panel-${i}`}
              tabIndex={i === active ? 0 : -1}
              onClick={() => setActive(i)}
              className="ds-chip"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {panels.map((p, i) => (
        <div key={p.key} role="tabpanel" id={`${id}-panel-${i}`} aria-labelledby={`${id}-tab-${i}`} hidden={i !== active}>
          {p.content}
        </div>
      ))}
    </div>
  );
}
