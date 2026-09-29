import React from 'react';

/**
 * Horizontal pill navigation bar for the Master List personnel-status tabs.
 * Design-only component — the page keeps ownership of the active tab and the
 * live personnel counts, this only renders them.
 */
export default function PersonnelStatusTabs({ tabs, activeTab, onChange }) {
  return (
    <div className="w-full overflow-x-auto">
      <div className="inline-flex items-stretch overflow-hidden rounded-full border border-border bg-gradient-to-b from-card to-muted/50 shadow-sm">
        {tabs.map((tab, index) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <div key={tab.key} className="flex items-stretch">
              {index > 0 && <span className="h-7 w-px self-center bg-border" />}
              <button
                type="button"
                onClick={() => onChange(tab.key)}
                className={`relative flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'font-semibold text-foreground'
                    : 'font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                }`}
              >
                {Icon && <Icon className={`h-4 w-4 ${isActive ? 'text-foreground' : tab.color}`} />}
                {tab.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none ${
                    isActive ? 'bg-highlight text-slate-900' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {tab.count.toLocaleString()}
                </span>
                {isActive && <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-highlight" />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}