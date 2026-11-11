Efficiency improvement opportunities

1. Consolidate mutation test files (biggest win)

binary, unary, literal, and null-return each import parseSourceFile + findAllMutations and have the same ~120ms fixed overhead. Merging them into a
single mutations.test.ts eliminates 3 × ~120ms = ~360ms on individual runs, and likely much more at the suite level where isolation multiplies the
cost.

2. Share SourceFile instances within a describe block

binary.test.ts calls parseSourceFile 18 times — once per test, each with a distinct short snippet. Most test a single-operator snippet in
isolation. Where the snippet is the same logical file (e.g., testing multiple mutations on the same expression), a beforeAll-scoped parse would
collapse repeated parses into one.

3. runner.test.ts timeout test is irreducible but bounded

The sleep 10 test uses a 100ms timeout — already at the floor. No optimization available here, but it's correctly bounded.

4. 66ms/test on unary.test.ts

2 tests, 132ms — entirely fixed overhead. Merging into a consolidated mutations file (point 1) resolves this automatically.

---

Recommended action

Merge src/mutations/{binary,unary,literal,null-return}.test.ts into a single src/mutations/mutations.test.ts. This is the single highest-leverage
change: 4 module-load costs → 1, saving an estimated 300–400ms on the full suite with no test changes needed.
