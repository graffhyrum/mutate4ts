---
"mutate4ts": major
---

Exit codes changed. Usage errors now exit 2 (they exited 1 before, the same as surviving mutants).
Errored mutations now exit 3. Timed-out mutations now count as killed.
When a run has both survivors and errors, the exit code is the highest one (3).
See docs/adr/0001-mutation-exit-codes.md.
