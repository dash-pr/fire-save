import type { ReactNode } from "react";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F4F0] px-6 py-12 text-slate-900">
      {children}
    </main>
  );
}

export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="w-full max-w-[400px] rounded-2xl bg-white px-6 pb-6 pt-6 shadow-[0_12px_32px_rgba(17,24,39,0.08),0_2px_4px_rgba(17,24,39,0.04)]">
      <p className="text-center text-lg font-medium tracking-wide text-[#1C1F3A]">Stashy</p>
      {children}
    </div>
  );
}

export function AuthHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mt-6 text-center">
      <h1 className="text-[22px] font-medium tracking-tight text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-[#6B7280]">{subtitle}</p>
    </div>
  );
}

export function Divider() {
  return (
    <div className="my-5 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.08em] text-[#9CA3AF]">
      <span className="h-px flex-1 bg-[#E5E7EB]" />
      or
      <span className="h-px flex-1 bg-[#E5E7EB]" />
    </div>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mt-4 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-xs text-[#B91C1C]">
      {message}
    </div>
  );
}

export function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-[#B91C1C]">{message}</p>;
}

export function GoogleButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-[#E5E7EB] bg-white text-sm font-medium text-slate-900 transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
    >
      <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden>
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C33.9 6.1 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C33.9 6.1 29.2 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2c-2 1.4-4.5 2.3-7.2 2.3-5.3 0-9.7-3.1-11.4-7.9l-6.6 5.1C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.2 5.4l6.2 5.2C41.7 34 44 29.3 44 24c0-1.3-.1-2.3-.4-3.5z" />
      </svg>
      Continue with Google
    </button>
  );
}

export function AppleButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-3 flex h-11 w-full items-center justify-center gap-3 rounded-lg bg-black text-sm font-medium text-white transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
    >
      <svg viewBox="0 0 384 512" className="h-4 w-4 fill-white" aria-hidden>
        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zM256 84.4c30.9-36.7 28.1-70.1 27.2-82.1-27.4 1.6-59.1 18.7-77.2 39.7C184 61 171.9 87.1 174.5 114c29.6 2.2 56.6-13 81.5-29.6z" />
      </svg>
      Continue with Apple
    </button>
  );
}

export function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-slate-700">
      {children}
    </label>
  );
}

export function inputClass(hasError: boolean) {
  return `h-11 w-full rounded-lg border px-3 text-sm text-slate-900 outline-none transition focus:ring-2 ${
    hasError
      ? "border-[#FCA5A5] focus:border-[#EF4444] focus:ring-[#EF4444]/20"
      : "border-[#E5E7EB] focus:border-[#4A7CFF] focus:ring-[#4A7CFF]/20"
  }`;
}

export function PrimaryButton({
  children,
  loading,
  disabled,
  type = "submit",
}: {
  children: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className="mt-5 flex h-11 w-full items-center justify-center rounded-lg bg-[#4A7CFF] text-sm font-medium text-white transition hover:bg-[#3A68E5] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}

export function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" aria-hidden>
      <circle cx="12" cy="12" r="10" strokeWidth="3" className="fill-none stroke-white/30" />
      <path d="M12 2a10 10 0 0 1 10 10" strokeWidth="3" strokeLinecap="round" className="fill-none stroke-white" />
    </svg>
  );
}
