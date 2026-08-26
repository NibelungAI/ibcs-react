---
"ibcs-react": patch
---

Fix the screen-reader data table inflating ancestor `scrollHeight` by its full height (~340px per chart). The visually-hidden style used to sit directly on the `<table>`, but CSS table layout treats `width`/`height` as a minimum — the box stayed full-size (invisible, clipped) and any ancestor with `overflow` set grew a phantom scrollbar. The hiding style now sits on a wrapper `<div>`, which honours the 1×1 clamp; the table stays in the accessibility tree exactly as before. If you use the exported `srOnly` style yourself, apply it to a `div`/`span` — never directly to a table.
