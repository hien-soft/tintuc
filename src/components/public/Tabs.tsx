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
      <div className="mb-3 flex flex-wrap items-end gap-x-4 border-b-2 border-brand">
        {title}
        <div role="tablist" className="-mb-0.5 flex max-w-full overflow-x-auto [scrollbar-width:none]" onKeyDown={onKey}>
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
              className={`whitespace-nowrap border-b-2 px-3 py-1.5 text-sm font-bold uppercase transition ${i === active ? "border-brand bg-brand text-white" : "border-transparent text-ink-soft hover:text-brand"}`}
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
