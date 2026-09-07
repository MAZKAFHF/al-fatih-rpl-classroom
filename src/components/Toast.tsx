"use client";
import { createContext, useCallback, useContext, useState } from "react";

type Toast = { id: string; message: string; type: "success" | "error" | "info" };
const Ctx = createContext<{ toast: (msg: string, type?: Toast["type"]) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((s) => [...s, { id, message, type }]);
    setTimeout(() => setToasts((s) => s.filter((t) => t.id !== id)), 3000);
  }, []);
  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto min-w-[280px] max-w-[420px] px-4 py-3 rounded-xl border shadow-lg text-[13px] font-medium flex items-center gap-2 ${
              t.type === "success"
                ? "bg-[#ecfdf5] border-[#a7f3d0] text-[#065f46]"
                : t.type === "error"
                ? "bg-[#fef2f2] border-[#fecaca] text-[#991b1b]"
                : "bg-white border-[var(--border)] text-[var(--foreground)]"
            }`}
          >
            <span className="h-2 w-2 rounded-full shrink-0 bg-current opacity-70" />
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast outside provider");
  return ctx;
}
