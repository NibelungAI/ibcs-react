---
"ibcs-react": minor
---

`tokenPresets` is now keyed by stable code ids (`default`, `ocean`, `azure`, `greenRed`, `vivid`, `cvd`, `mono`, `dark` — the new `TokenPresetId` type) instead of display strings, with display names in the new `tokenPresetLabels` map. Lookups autocomplete and typos fail to compile, and UI copy can change without breaking saved theme ids.

The v1.0 display-string keys (`"Default"`, `"Green / Red"`, `"CVD-safe"`, `"Mono / print"`, …) still resolve at **runtime** as non-enumerable aliases — existing JavaScript keeps working, and `Object.keys`/`Object.entries` iteration sees each preset exactly once — but they are gone from the **type**: TypeScript code doing `tokenPresets.Dark` or `tokenPresets["Green / Red"]` must switch to `tokenPresets.dark` / `tokenPresets.greenRed`.
