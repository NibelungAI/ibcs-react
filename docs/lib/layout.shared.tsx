import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

/** Shared chrome for the home and docs layouts: brand, top links, GitHub. */
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/nibelung.svg" alt="" width={20} height={20} />
          <span className="font-semibold">ibcs-react</span>
        </>
      ),
    },
    githubUrl: "https://github.com/NibelungAI/ibcs-react",
    links: [
      { text: "Docs", url: "/docs" },
      { text: "Gallery", url: "/gallery" },
      { text: "Playground", url: "/playground" },
      { text: "Example report", url: "/report" },
    ],
  };
}
