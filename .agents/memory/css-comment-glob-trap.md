---
name: CSS comment glob-token trap
description: Why writing Tailwind glob patterns inside CSS comments can silently break the following rule.
---

Writing patterns like `bg-*/text-*/border-*` (or any text containing `*/`) inside a `/* ... */` CSS comment **prematurely closes the comment** at the first `*/`. The leftover text becomes stray tokens that corrupt the *next* rule's parsing — e.g. it dropped a whole `.poster-card` block, silently breaking card backgrounds/contrast with no build error.

**Why:** CSS/PostCSS comments are not nestable and have no escaping; `*/` always terminates. Vite/Tailwind emit no error — the browser just discards the malformed rule.

**How to apply:** When documenting utility names in CSS comments, never write a literal `*/`. Reword (e.g. "token-based color utilities") or space it out. After editing CSS comments, grep for `\*/` and confirm each one is a real intended terminator.
