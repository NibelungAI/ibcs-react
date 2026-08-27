/**
 * Site footer with the legally-motivated independence / trademark disclaimer
 * (Austrian UWG; agreed legal wording — do not reword without checking; the
 * separate checkIbcs sentence was dropped deliberately as product noise).
 *
 * `variant="page"` (default): full-width card band at the bottom of the
 * standalone pages. `variant="docs"`: transparent continuation of the docs
 * content column, rendered after the article inside the scrolling area.
 */
export function SiteFooter({ variant = "page" }: { variant?: "page" | "docs" }) {
  return (
    <footer
      className={`border-t px-6 py-6 text-sm text-fd-muted-foreground ${
        variant === "page" ? "bg-fd-card" : "mt-8"
      }`}
    >
      <div className="mx-auto flex w-full max-w-fd-container flex-wrap items-center justify-between gap-4">
        <a
          href="https://nibelung.io"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 hover:text-fd-foreground"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/nibelung.svg" alt="Nibelung" width={22} height={22} />
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest">Nibelung</div>
            <div className="mt-0.5 text-[13px]">Built on IBCS notation · ISO 24896:2026</div>
          </div>
        </a>
        <nav className="flex flex-wrap items-center gap-5">
          <a
            href="https://github.com/NibelungAI/ibcs-react"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:text-fd-foreground"
          >
            GitHub
          </a>
          <a
            href="https://www.npmjs.com/package/ibcs-react"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:text-fd-foreground"
          >
            npm
          </a>
          <a
            href="https://www.linkedin.com/company/nibelung-ai/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:text-fd-foreground"
          >
            LinkedIn
          </a>
          <span className="text-xs">© {new Date().getFullYear()} Nibelung</span>
        </nav>
      </div>
      <div className="mx-auto mt-4 w-full max-w-fd-container border-t pt-3 text-[11px] leading-relaxed">
        ibcs-react is an independent open-source library and is not affiliated with, certified by,
        or endorsed by the IBCS Association or ISO. It follows the IBCS® notation rules (the basis
        of ISO 24896); IBCS® is a registered trademark of the IBCS Association.
      </div>
    </footer>
  );
}
