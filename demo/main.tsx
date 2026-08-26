import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

// The demo app is the DEV playground: `npm run demo` hot-reloads straight from
// `src/`. The public documentation site lives in `docs/` (Next + fumadocs,
// deployed to ibcs-react.com) and consumes the built package instead.
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
