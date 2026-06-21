---
name: Clerk React gotchas
description: Non-obvious mistakes when wiring @clerk/react in a Vite app
---

# Clerk React (@clerk/react) gotchas

- `localization` is a prop on `<ClerkProvider localization={{...}}>`, NOT a key inside the `appearance` object. Nesting it under `appearance` throws TS2353 ("'localization' does not exist in type 'Appearance<Theme>'").

**Why:** The design subagent (and generic Clerk knowledge) tends to lump all customization into `appearance`. `appearance` only holds `theme`, `variables`, `elements`, `options`, `cssLayerName`. Copy/text overrides live in the separate `localization` prop.

**How to apply:** When customizing Clerk sign-in/sign-up titles/subtitles, add a sibling `localization={{ signIn: {...}, signUp: {...} }}` prop on `<ClerkProvider>`, not inside `appearance`.
