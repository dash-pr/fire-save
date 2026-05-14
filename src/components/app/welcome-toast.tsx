"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, X } from "lucide-react";

const KEY = "stashy:welcome";

export function WelcomeToast() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { name?: string };
      if (parsed?.name) queueMicrotask(() => setName(parsed.name ?? null));
    } catch {
      /* ignore */
    }
    window.sessionStorage.removeItem(KEY);
  }, []);

  return (
    <AnimatePresence>
      {name && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg bg-[#1C1F3A] px-4 py-3 text-sm text-white shadow-[0_12px_32px_rgba(17,24,39,0.16)]"
        >
          <CheckCircle2 className="h-4 w-4 text-[#4A7CFF]" />
          <span>
            Welcome to Stashy, <span className="font-medium">{name}</span>. Your budget is ready to set up.
          </span>
          <button
            type="button"
            onClick={() => setName(null)}
            className="ml-1 rounded p-0.5 text-white/60 transition hover:text-white"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
