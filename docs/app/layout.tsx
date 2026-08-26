import "./global.css";
import { RootProvider } from "fumadocs-ui/provider/next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

// IBM Plex — the business-reporting voice of the site. Loaded as CSS variables
// and mapped to Tailwind's font-sans / font-mono in global.css.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://ibcs-react.com"),
  title: {
    default: "ibcs-react — IBCS · ISO 24896 React components",
    template: "%s | ibcs-react",
  },
  description:
    "Zero-dependency React components for IBCS® business communication — variance charts, waterfalls, statement tables, dashboards and reports following the IBCS notation, the basis of ISO 24896.",
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Old site compatibility: the previous docs were a hash-routed SPA
 * (`/#/guides/theming`, `/#/components/data-table`). Fragments never reach the
 * server, so map them to the new real routes on the client.
 */
const HASH_REDIRECT = `(function(){var h=location.hash;if(!h||h.charAt(1)!=="/")return;var p=h.slice(1);var m=p.match(/^\\/components\\/([\\w-]+)/);if(m){location.replace("/docs/components/"+m[1]);return}m=p.match(/^\\/guides\\/([\\w-]+)/);if(m){location.replace("/docs/"+m[1]);return}if(p.indexOf("/playground")===0){location.replace("/playground");return}if(p.indexOf("/report")===0){location.replace("/report");return}location.replace("/docs")})();`;

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plexSans.variable} ${plexMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: HASH_REDIRECT }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
