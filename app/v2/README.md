# RUST WAY — Homepage Redesign (v2)

A complete, from-scratch premium redesign of the Rust Way homepage. Dark-futuristic
"Molten Steel" aesthetic (rust/amber on graphite), massive Oswald display type, glass
panels, cinematic Framer Motion. Self-contained and **non-destructive** — it lives at
`/v2` and does not touch the existing site.

**Preview:** run `npm run dev` → open **http://localhost:3000/v2**

## Stack
Next.js App Router · React · TypeScript · Tailwind CSS v4 · Framer Motion · Lucide ·
shadcn-style primitives (cva + clsx + tailwind-merge). All installed.

## Architecture
```
app/v2/
├── layout.tsx              # fonts (Oswald / Inter / JetBrains Mono, cyrillic) + SEO metadata
├── page.tsx                # composes all sections
├── loading.tsx             # branded route loading state
├── v2.css                  # design tokens (CSS vars), keyframes, atmospheric effects
├── lib/
│   ├── cn.ts               # shadcn class combiner
│   └── content.ts          # single source of truth: servers, socials, plugins, FAQ, legal…
└── components/
    ├── Logo.tsx            # custom molten-hex wordmark
    ├── Navbar.tsx          # sticky glass nav, scrollspy, mobile menu
    ├── icons.tsx           # Lucide registry + brand SVGs (Discord/TG/VK/YT/TikTok/Steam)
    ├── motion.tsx          # Reveal, Stagger, CountUp, Tilt, Magnetic, Parallax, Floaty, useCopy
    ├── ui.tsx              # Section, Container, SectionHeading, Button, Badge, Panel, LivePill
    └── sections/
        Hero · Servers · FeaturesBento · LiveStats · Gallery ·
        Trailer · StorePreview · Community · FAQ · FinalCTA · Footer
```

## Content
All copy, server IPs, wipe schedule, socials and the legal entity are the project's real
data (mined from the existing widgets). Live counters (online, cases, Discord) are seeded
with realistic numbers — wire them to `/api/server-status` where marked in `content.ts`.

## Promote to `/` (when ready)
The redesign is isolated so you can review it first. To make it the main homepage:

1. Move the three `next/font` loaders + `import "./v2.css"` from `app/v2/layout.tsx` into
   `app/layout.tsx`, and add the `rw-root` + font variable classes to `<body>`.
2. Replace `app/page.tsx`'s body with the composition from `app/v2/page.tsx`
   (or simply `export { default } from "./v2/page"` and delete the old widgets when happy).
3. Optionally delete `app/v2/` after copying, or keep it as a living style reference.

Keep a backup of the current `app/page.tsx` before swapping.
