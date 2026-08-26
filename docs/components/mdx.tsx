import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { createGenerator } from "fumadocs-typescript";
import { AutoTypeTable } from "fumadocs-typescript/ui";
import { Frame } from "./frame";

/**
 * One shared TypeScript generator for AutoTypeTable: prop tables are generated
 * from the library's REAL types at build time, so they cannot drift from src.
 */
const generator = createGenerator({
  tsconfigPath: "../tsconfig.json",
});

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    AutoTypeTable: (props: Omit<React.ComponentProps<typeof AutoTypeTable>, "generator">) => (
      <AutoTypeTable {...props} generator={generator} />
    ),
    Frame,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;
