import defaultMdxComponents from "fumadocs-ui/mdx";

const { CodeBlockTabs, CodeBlockTab, CodeBlockTabsList, CodeBlockTabsTrigger } =
  defaultMdxComponents;

const COMMANDS = [
  ["npm", "npm install ibcs-react"],
  ["pnpm", "pnpm add ibcs-react"],
  ["yarn", "yarn add ibcs-react"],
  ["bun", "bun add ibcs-react"],
] as const;

/**
 * The landing-page install snippet, using the same CodeBlockTabs +
 * "package-manager" persist group the MDX ```npm fences generate — so the
 * choice made here follows the visitor through the whole docs (and vice
 * versa).
 */
export function InstallTabs() {
  return (
    <CodeBlockTabs defaultValue="npm" groupId="package-manager" persist>
      <CodeBlockTabsList>
        {COMMANDS.map(([name]) => (
          <CodeBlockTabsTrigger key={name} value={name}>
            {name}
          </CodeBlockTabsTrigger>
        ))}
      </CodeBlockTabsList>
      {COMMANDS.map(([name, command]) => (
        <CodeBlockTab key={name} value={name}>
          <pre className="overflow-x-auto p-4 text-sm">
            <code>{command}</code>
          </pre>
        </CodeBlockTab>
      ))}
    </CodeBlockTabs>
  );
}
