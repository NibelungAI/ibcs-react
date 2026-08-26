import type { Preview } from "@storybook/react";

const preview: Preview = {
  parameters: {
    layout: "padded",
    backgrounds: {
      default: "ibcs",
      values: [
        { name: "ibcs", value: "#faf9f6" },
        { name: "white", value: "#ffffff" },
      ],
    },
    controls: { matchers: { color: /(background|color)$/i } },
  },
};

export default preview;
