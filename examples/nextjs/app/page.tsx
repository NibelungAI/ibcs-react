import Demo from "./Demo";

// This is a React Server Component (no "use client"): it renders static intro
// markup on the server and mounts the interactive charts via the <Demo/> client
// component below. That split is the recommended pattern — the charts use hooks
// (hover/animation) and so must live in a "use client" boundary.
export default function Page() {
  return (
    <main
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "48px 24px 80px",
      }}
    >
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 30, margin: "0 0 8px", letterSpacing: -0.5 }}>
          ibcs-react × Next.js
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.55, color: "#444", margin: 0 }}>
          A minimal App Router starter showing{" "}
          <a href="https://www.npmjs.com/package/ibcs-react" style={{ color: "#1858c2" }}>
            ibcs-react
          </a>{" "}
          — zero-dependency, SSR-safe IBCS / ISO&nbsp;24896 business charts and KPI cards. The
          components below are rendered from inline sample data inside a{" "}
          <code>&quot;use client&quot;</code> component.
        </p>
      </header>

      <Demo />
    </main>
  );
}
