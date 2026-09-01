## What & why

<!-- A short description of the change and the motivation. Link any issue. -->

## Checklist

- [ ] `npm run typecheck` passes (TS strict + noUnusedLocals)
- [ ] `npm test` passes
- [ ] `npm run build` succeeds (ESM + CJS + types) and `npm run verify-dist` is green
- [ ] `npm run check-format` passes (`npm run format` fixes what you touched)
- [ ] No new **runtime** dependencies (dev-only deps are fine)
- [ ] SSR-safe (no `window`/`document` at module load or first render)
- [ ] IBCS-correct where applicable (AC solid · PY grey · PL frame · FC hatch; variance coloured by impact, not sign)
- [ ] Added/updated tests for the change
- [ ] Updated docs (component page / README) if user-facing
- [ ] Added a changeset (`npx changeset`) if user-facing - `CHANGELOG.md` is
      generated at release time, don't edit it by hand
