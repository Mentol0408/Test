"use client";

/* =====================================================================
   UI kit — shadcn-flavoured primitives (cva + cn), tuned to the
   Rust Way "Molten Steel" system. Button is polymorphic (button/anchor).
   ===================================================================== */

import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ReactNode } from "react";
import { cn } from "@/v2/lib/cn";
import { Reveal } from "./motion";

/* -------------------------------------------------- Container / Section */

export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1280px] 2xl:max-w-[1440px] px-5 sm:px-8", className)}>
      {children}
    </div>
  );
}

export function Section({
  id,
  children,
  className,
  containerClassName,
  bare = false,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  bare?: boolean;
}) {
  return (
    <section id={id} className={cn("relative isolate py-20 sm:py-28 lg:py-36 scroll-mt-24", className)}>
      {bare ? children : <Container className={containerClassName}>{children}</Container>}
    </section>
  );
}

/* -------------------------------------------------- Eyebrow */

export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "rw-mono inline-flex items-center gap-2.5 text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--rw-orange-2)]",
        className,
      )}
    >
      <span className="h-px w-6 bg-gradient-to-r from-[var(--rw-orange)] to-transparent" />
      {children}
    </span>
  );
}

/* -------------------------------------------------- Section heading */

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-5",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      {eyebrow ? (
        <Reveal>
          <Eyebrow>{eyebrow}</Eyebrow>
        </Reveal>
      ) : null}
      <Reveal delay={0.05}>
        <h2
          className={cn(
            "rw-display text-balance text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl lg:text-6xl",
            align === "center" ? "max-w-3xl" : "max-w-2xl",
          )}
        >
          {title}
        </h2>
      </Reveal>
      {description ? (
        <Reveal delay={0.1}>
          <p
            className={cn(
              "text-pretty text-base leading-relaxed text-[var(--rw-muted)] sm:text-lg",
              align === "center" ? "max-w-2xl" : "max-w-xl",
            )}
          >
            {description}
          </p>
        </Reveal>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------- Button */

const button = cva(
  "relative inline-flex items-center justify-center gap-2 rounded-xl font-medium tracking-tight transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-[var(--rw-orange)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--rw-bg)] disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap",
  {
    variants: {
      variant: {
        primary: "rw-btn-primary hover:-translate-y-0.5 active:translate-y-0",
        ghost: "rw-btn-ghost hover:-translate-y-0.5",
        subtle: "bg-white/[0.04] border border-[var(--rw-line)] text-[var(--rw-text)] hover:bg-white/[0.08]",
        link: "text-[var(--rw-orange-2)] hover:text-[var(--rw-amber)] underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-5 text-[15px]",
        lg: "h-14 px-7 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonBaseProps = VariantProps<typeof button> & {
  className?: string;
  children: ReactNode;
};

type ButtonAsButton = ButtonBaseProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type ButtonAsAnchor = ButtonBaseProps &
  React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export const Button = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  ButtonAsButton | ButtonAsAnchor
>(function Button({ className, variant, size, children, ...props }, ref) {
  const classes = cn(button({ variant, size }), className);
  if ("href" in props && props.href !== undefined) {
    return (
      <a ref={ref as React.Ref<HTMLAnchorElement>} className={classes} {...(props as ButtonAsAnchor)}>
        <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
      </a>
    );
  }
  return (
    <button ref={ref as React.Ref<HTMLButtonElement>} className={classes} {...(props as ButtonAsButton)}>
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </button>
  );
});

/* -------------------------------------------------- Badge / Chip */

const badge = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium tracking-tight",
  {
    variants: {
      tone: {
        default: "border border-[var(--rw-line-2)] bg-white/[0.03] text-[var(--rw-muted)]",
        amber: "border border-[var(--rw-orange)]/30 bg-[var(--rw-orange)]/10 text-[var(--rw-amber)]",
        chill: "border border-[var(--rw-chill)]/30 bg-[var(--rw-chill)]/10 text-[var(--rw-chill)]",
        hard: "border border-[var(--rw-hard)]/30 bg-[var(--rw-hard)]/10 text-[var(--rw-hard)]",
        vanilla: "border border-[var(--rw-vanilla)]/30 bg-[var(--rw-vanilla)]/10 text-[var(--rw-vanilla)]",
        live: "border border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
      },
    },
    defaultVariants: { tone: "default" },
  },
);

export function Badge({
  children,
  className,
  tone,
}: { children: ReactNode; className?: string } & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)}>{children}</span>;
}

/* -------------------------------------------------- Panel (glass card) */

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rw-glass rw-topline rounded-2xl", className)}>{children}</div>
  );
}

/* -------------------------------------------------- Live pill */

export function LivePill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/[0.07] px-3 py-1 text-xs font-medium text-emerald-300", className)}>
      <span className="rw-live-dot h-2 w-2" />
      {children}
    </span>
  );
}
