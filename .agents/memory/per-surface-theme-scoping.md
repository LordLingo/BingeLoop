---
name: Per-surface inverted theme scoping
description: How to make one surface (e.g. cards) use an inverted/different palette from the rest of a token-driven theme.
---

When a token-driven (shadcn/Tailwind-v4 `@theme inline`) app needs ONE surface to use a different/inverted palette (e.g. a light page with dark navy cards), redefine the design-token CSS vars (`--foreground`, `--muted-foreground`, `--background`, `--muted`, `--border`, `--card-foreground`, `--badge-outline`, etc.) **on that surface's own class** rather than overriding each child component.

**Why:** Tailwind utilities resolve `hsl(var(--token))` lazily at the element where they're used, and CSS custom properties inherit. So every descendant using `text-foreground`, `text-muted-foreground`, `bg-background`, `border-border`, badges, buttons, etc. automatically picks up the scoped values — no per-component edits, and new child components stay correct for free.

**How to apply:** Put the scoped `--token: ...;` overrides plus the surface background on the wrapper class (in this repo: `.poster-card` for show cards). Keep `--primary`/accent unscoped if the accent color should stay the same across surfaces. Pick token values that read well on the surface's background.
