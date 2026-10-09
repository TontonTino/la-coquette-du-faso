"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Tone = "succes" | "erreur" | "info";
interface ToastItem {
  id: number;
  tone: Tone;
  title: string;
  message?: string;
}

const ToastContext = createContext<((tone: Tone, title: string, message?: string) => void) | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (tone: Tone, title: string, message?: string) => {
      const id = nextId++;
      setToasts((list) => [...list.slice(-2), { id, tone, title, message }]);
      window.setTimeout(() => dismiss(id), tone === "erreur" ? 6000 : 4000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-3 z-[60] mx-auto flex max-w-md flex-col gap-2 px-4 sm:top-auto sm:right-6 sm:bottom-6 sm:left-auto sm:mx-0 sm:px-0"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "erreur" ? "alert" : "status"}
            className="pointer-events-auto flex animate-montee items-start gap-3 rounded-2xl border border-or/30 bg-noir px-4 py-3 text-white shadow-2xl"
          >
            <span
              className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                t.tone === "succes" ? "bg-or text-noir" : t.tone === "erreur" ? "bg-rouge text-white" : "bg-white/15 text-or"
              }`}
              aria-hidden
            >
              {t.tone === "succes" ? "✓" : t.tone === "erreur" ? "!" : "i"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.message && <p className="mt-0.5 text-xs text-white/70">{t.message}</p>}
            </div>
            <button type="button" onClick={() => dismiss(t.id)} className="text-white/50 hover:text-white" aria-label="Fermer la notification">
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const push = useContext(ToastContext);
  if (!push) throw new Error("useToast doit être utilisé dans <ToastProvider>");
  return push;
}
