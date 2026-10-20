import { useEffect, useRef } from "react";

// Shared by modal surfaces: contain focus, dismiss with Escape and restore the trigger.
export function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const container = ref.current;
    if (!container) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(container.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')).filter(element => !element.hidden && !element.closest("[hidden], [inert]") && getComputedStyle(element).display !== "none" && !Array.from(element.closest("details:not([open])")?.children ?? []).some(child => child.tagName !== "SUMMARY" && child.contains(element)));
    (focusable()[0] ?? container).focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close.current(); }
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0]; const last = items.at(-1);
      if (!first || !last) { event.preventDefault(); container.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !container.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("keydown", handleKey); document.body.style.overflow = previousOverflow; trigger?.focus(); };
  }, [open]);
  return ref;
}
