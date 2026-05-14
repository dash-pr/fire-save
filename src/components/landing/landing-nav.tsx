"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export function LandingNav() {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinelRef} aria-hidden className="absolute top-0 h-px w-full" />
      <header
        className={`fixed inset-x-0 top-0 z-40 h-16 transition-colors duration-200 ${
          scrolled
            ? "border-b border-[#E5E7EB] bg-[#F5F4F0]/85 backdrop-blur"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
          <Link
            href="/"
            className={`text-lg font-medium tracking-wide ${scrolled ? "text-[#1C1F3A]" : "text-white"}`}
          >
            Stashy
          </Link>
          <div className="flex items-center gap-5">
            <Link
              href="/signin"
              className={`text-sm font-medium transition ${
                scrolled ? "text-slate-700 hover:text-slate-900" : "text-white/85 hover:text-white"
              }`}
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-[#4A7CFF] px-4 text-sm font-medium text-white transition hover:bg-[#3A68E5]"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
