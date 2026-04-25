## What's New

This is a hardening + maintainability release. No user-visible feature changes — but the validator surface that protects against malicious or malformed CSS color values is now meaningfully more robust, and there's a 53-test jest suite locking in the contract so future edits can't silently regress it.

### Validator Hardening

- **Pathology-guard length cap on `validateColorValue`.** Inputs longer than 4096 characters short-circuit before any regex tests run. The regex matrix already constrains the allowed grammar with anchored, linear-time patterns — this cap exists for genuine 10kb+ payloads only. 4096 is set far above any realistic CSS color value (and well above the longest plausible `var(--wp--preset--gradient--<long-slug>)`) so verbose design-token namespaces are unaffected.
- **Deterministic `validateStringInput` against stateful regexes.** `RegExp.prototype.test()` advances `lastIndex` on `/g` and `/y` regexes, which would make repeated validations alternate pass/fail in non-obvious ways. All current in-repo callers use non-stateful patterns, so behavior is unchanged in practice — this is a defense-in-depth fix on the public named-export contract.

### Refactor

- Input validators (`validateNumericInput`, `validateStringInput`, `validateId`, `validateColorValue`, `debugLog`) are now in their own module at `src/validators.js`. Named exports, zero call-site changes, bundle size unchanged.

### Tests

- 53 new jest unit tests at `src/__tests__/validators.test.js`:
  - Numeric: in-range/boundary/clamp behavior, NaN/Infinity handling, type coercion, the unclamped-`defaultValue` quirk
  - String: truncation-then-pattern ordering, custom maxLength, deterministic with `/g` and `/y` regexes
  - ID: alphanumeric/dash/underscore allowlist, 50-char limit
  - Color: every accept/reject path including the 4096 boundary, plus security-relevant rejection cases for `var()` namespace smuggling, `url()` whitespace tricks, `javascript:` / `expression()` / `<script>` payloads
  - debugLog: `NODE_ENV` gating

### Quality

- Wrapped the `squiggleHeight` switch-case body in a block to satisfy Biome's `noSwitchDeclarations` lint rule.
- Test cleanup uses `delete process.env.NODE_ENV` instead of `= undefined` (which Node.js coerces to the literal string `"undefined"`).

### Full Changelog

See [changelog.txt](https://github.com/edequalsawesome/awesome-squiggle/blob/main/changelog.txt).

**Pull requests merged:**
- [#6](https://github.com/edequalsawesome/awesome-squiggle/pull/6) — Validator extraction + jest test suite
- [#8](https://github.com/edequalsawesome/awesome-squiggle/pull/8) — Pathology-guard length cap on `validateColorValue`
