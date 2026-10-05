import { createContext, type PropsWithChildren, useCallback, useContext, useMemo, useState } from "react";
import { Icon } from "./Icon";

type ToastTone = "success" | "error" | "info";
type ToastItem = { id: number; title: string; message?: string; tone: ToastTone };
type ToastContextValue = { notify: (title: string, options?: { message?: string; tone?: ToastTone }) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const notify = useCallback((title: string, options: { message?: string; tone?: ToastTone } = {}) => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current.slice(-3), { id, title, message: options.message, tone: options.tone ?? "success" }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 5000);
  }, []);
  const value = useMemo(() => ({ notify }), [notify]);
  return <ToastContext.Provider value={value}>{children}<div className="toast-region" aria-live="polite" aria-atomic="false">{items.map((item) => <div className={`toast toast--${item.tone}`} key={item.id}><span className="toast__icon"><Icon name={item.tone === "error" ? "warning" : "check"} /></span><div><strong>{item.title}</strong>{item.message ? <p>{item.message}</p> : null}</div><button type="button" aria-label="Dismiss notification" onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}><Icon name="close" /></button></div>)}</div></ToastContext.Provider>;
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used within ToastProvider.");
  return value;
}
