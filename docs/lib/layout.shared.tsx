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
      { text: "Skills", url: "/skills" },
      {
        type: "icon",
        label: "npm package",
        text: "npm",
        icon: (
          // The npm box glyph (Simple Icons), currentColor like the GitHub icon.
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z" />
          </svg>
        ),
        url: "https://www.npmjs.com/package/ibcs-react",
        external: true,
      },
    ],
  };
}
