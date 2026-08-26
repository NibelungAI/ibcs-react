import type { ReactNode } from "react";

export const metadata = {
  title: "ibcs-react — Next.js example",
  description:
    "Instant-try Next.js (App Router) starter for ibcs-react: IBCS / ISO 24896 charts and KPI cards.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#f7f8fa",
          color: "#1a1a1a",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}
