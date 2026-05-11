import Link from "next/link";

export default function LandingPlaceholder() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F4F0] px-6 text-slate-900">
      <div className="max-w-lg text-center">
        <p className="text-xl font-medium tracking-wide">Stashy</p>
        <h1 className="mt-6 text-4xl font-medium tracking-tight">Your path to FATFire, clearly mapped.</h1>
        <p className="mt-4 text-sm text-[#6B7280]">
          Track your money, eliminate your debt, and project exactly when you can stop working — built for Japan.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-[#4A7CFF] px-6 text-sm font-medium text-white shadow-[0_1px_2px_rgba(17,24,39,0.08)] transition hover:bg-[#3A68E5]"
          >
            Get started
          </Link>
          <Link
            href="/signin"
            className="inline-flex h-11 items-center justify-center rounded-lg px-6 text-sm font-medium text-slate-900 transition hover:text-[#4A7CFF]"
          >
            Sign in
          </Link>
        </div>
        <p className="mt-10 text-xs text-[#6B7280]">Landing page copy will be fleshed out in Phase 5.</p>
      </div>
    </main>
  );
}
