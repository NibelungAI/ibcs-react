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
  // The raw skill-file routes read ../skills at request time; trace the folder
  // into the standalone server bundle.
  outputFileTracingIncludes: {
    "/skills/[skill]/[[...file]]": ["../skills/**/*"],
  },
  // Raw-Markdown twin of every docs page for AI agents: /docs/foo.mdx → the
  // llms.mdx route handler (see app/llms.mdx/docs/[[...slug]]/route.ts).
  async rewrites() {
    return [
      { source: "/docs.mdx", destination: "/llms.mdx/docs" },
      { source: "/docs/:path*.mdx", destination: "/llms.mdx/docs/:path*" },
    ];
  },
  // llms.txt v2 discovery: advertise the agent index on the pages themselves.
  async headers() {
    const llmsLink = {
      key: "Link",
      value: '<https://ibcs-react.com/llms.txt>; rel="describedby"; type="text/plain"',
    };
    return [
      { source: "/", headers: [llmsLink] },
      { source: "/docs/:path*", headers: [llmsLink] },
    ];
  },
};

export default createMDX()(config);
