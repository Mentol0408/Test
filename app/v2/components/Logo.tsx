"use client";

import { cn } from "@/v2/lib/cn";

/** Rust Way lockup: the site favicon + wordmark. */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/favicon.ico" alt="" className="h-9 w-9 rounded-lg object-contain" />
      {!compact && (
        <span className="rw-display text-lg font-bold uppercase leading-none tracking-[0.16em]">
          <span className="text-[var(--rw-text)]">RUST</span>{" "}
          <span className="rw-gradient-text">WAY</span>
        </span>
      )}
    </span>
  );
}
