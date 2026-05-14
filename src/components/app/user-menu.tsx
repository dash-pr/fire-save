"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Settings as SettingsIcon } from "lucide-react";
import { signOutAction } from "@/app/app/actions";

export type AppUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
};

export function UserMenu({ user }: { user: AppUser }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  const displayName = user.fullName?.trim() || user.email || "Account";
  const initial = (displayName[0] ?? "S").toUpperCase();

  useEffect(() => {
    if (!open) return;
    const handle = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", handle);
    return () => window.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/5"
      >
        <Avatar url={user.avatarUrl} initial={initial} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{displayName}</p>
          {user.email && user.fullName && (
            <p className="truncate text-[11px] text-white/50">{user.email}</p>
          )}
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-white/60 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-lg border border-white/10 bg-[#252846] p-1 shadow-[0_12px_32px_rgba(0,0,0,0.35)]">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push("/app/settings");
            }}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-white/85 transition hover:bg-white/5"
          >
            <SettingsIcon className="h-3.5 w-3.5" />
            Settings
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setOpen(false);
              startTransition(() => {
                void signOutAction();
              });
            }}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-white/85 transition hover:bg-white/5 disabled:opacity-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            {pending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}

function Avatar({ url, initial }: { url: string | null; initial: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-8 w-8 rounded-full object-cover" />;
  }
  return (
    <div className="grid h-8 w-8 place-items-center rounded-full bg-[#4A7CFF] text-xs font-medium text-white">
      {initial}
    </div>
  );
}
