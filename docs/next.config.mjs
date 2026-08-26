import { fileURLToPath } from "node:url";
import { createMDX } from "fumadocs-mdx/next";

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: "standalone",
  // `ibcs-react` is a file:.. dependency (the repo root); trace from the repo
  // root so the standalone server bundle can reach the linked package.
  outputFileTracingRoot: fileURLToPath(new URL("..", import.meta.url)),
  // AutoTypeTable runs the TypeScript compiler at build time; keep it out of
  // the bundle.
  serverExternalPackages: ["typescript"],
};

export default createMDX()(config);
