---
name: Test/build CPU throttle in this container
description: Why vitest/tsc suddenly stall on an idle box, and how to recover instead of hammering.
---

# Test/build CPU throttle (cgroup burst credits)

Symptom: vitest stalls forever at the `RUN v4.x` banner, and even a single `tsc --noEmit` times out (>100s for a ~20s job) — while the box looks IDLE (top shows no busy node/esbuild), DB is clean (no locks/idle-in-transaction), memory is free (~10GB), and inotify limits are huge (65536). Not a code defect; not the DB; not a crash-looping workflow.

**Cause:** the container has a cgroup CPU quota with *burst credits*. Many heavy runs in a row (e.g. ~12 vitest invocations) exhaust the credits, after which everything is throttled to a low baseline so heavy jobs crawl. Credits refill only during quiet periods.

**Do NOT** keep re-running the test/build — repeats make it worse and burn budget. Instead:
- Stop launching heavy jobs; do non-CPU work for a few minutes (model calls like architect, `executeSql`, file reads/edits) to let credits refill, THEN run ONCE.
- Run the smallest scope (one test file, single `--filter` typecheck), with a GENEROUS internal timeout so it can finish naturally instead of being SIGKILLed mid-optimization.

**Process-management traps learned here:**
- `pkill -f vitest` SELF-KILLS the running shell (its own argv contains "vitest") → exit 137. Use the bracket trick: `pkill -f '[v]itest'`.
- Backgrounded/detached processes (`&`, `nohup`, `setsid`) do NOT survive a tool-call return.
- SIGKILLing a forks-pool run orphans esbuild-service/node children that can keep eating the quota; verify with `ps -eo pid,pcpu,etimes,comm --sort=-pcpu` before assuming the box is clean.
- `--pool=threads` did not help vs the default forks pool; the throttle hit both equally.
