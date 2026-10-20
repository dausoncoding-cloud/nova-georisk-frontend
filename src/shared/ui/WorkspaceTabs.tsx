import { useId, type ReactNode } from "react";

export function WorkspaceTabs({ tabs, value, onChange, children, label }: {
  tabs: readonly { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
  children: ReactNode;
  label: string;
}) {
  const id = useId();
  return <div className="tab-workspace">
    <div className="workspace-tabs result-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => <button type="button" key={tab.key} id={`${id}-${tab.key}`} role="tab"
        aria-selected={value === tab.key} aria-controls={`${id}-panel`} tabIndex={value === tab.key ? 0 : -1}
        className={value === tab.key ? "is-active" : ""} onClick={() => onChange(tab.key)}
        onKeyDown={(event) => {
          const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
          if (next === null) return;
          event.preventDefault();
          onChange(tabs[next]!.key);
          document.getElementById(`${id}-${tabs[next]!.key}`)?.focus();
        }}>{tab.label}</button>)}
    </div>
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${value}`} tabIndex={0} className="tab-content">{children}</div>
  </div>;
}
