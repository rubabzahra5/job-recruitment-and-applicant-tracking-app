"use client";

import * as React from "react";

export interface TabItem {
  id: string;
  label: string;
  content: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  defaultTab?: string;
  onChange?: (id: string) => void;
  ariaLabel?: string;
}

/**
 * Accessible tabs: role=tablist/tab/tabpanel, arrow-key navigation,
 * aria-selected and keyboard focus management.
 */
export function Tabs({ tabs, defaultTab, onChange, ariaLabel = "Tabs" }: TabsProps) {
  const [activeId, setActiveId] = React.useState(defaultTab ?? tabs[0]?.id ?? "");
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  const select = (id: string) => {
    setActiveId(id);
    onChange?.(id);
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next !== null) {
      e.preventDefault();
      const tab = tabs[next];
      if (tab) {
        select(tab.id);
        tabRefs.current[tab.id]?.focus();
      }
    }
  };

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  return (
    <div>
      <div role="tablist" aria-label={ariaLabel} className="flex gap-1 border-b border-slate-200">
        {tabs.map((tab, i) => {
          const selected = tab.id === active?.id;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[tab.id] = el;
              }}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(tab.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                selected
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {active && (
        <div
          role="tabpanel"
          id={`panel-${active.id}`}
          aria-labelledby={`tab-${active.id}`}
          className="py-4"
        >
          {active.content}
        </div>
      )}
    </div>
  );
}
