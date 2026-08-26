import { defineConfig } from "fumadocs-mdx/config";

export default defineConfig({
  mdxOptions: {
    // ```npm fences become npm / pnpm / yarn / bun tabs; the chosen package
    // manager is persisted (localStorage) and synced across every code block
    // on the site under the shared "package-manager" group.
    remarkNpmOptions: {
      persist: { id: "package-manager" },
    },
  },
});
