"use client";

import { useEffect, useRef, useState } from "react";

/**
 * "Copy page" split button under every docs title - the pattern the better
 * libraries use: primary action copies the page as Markdown, the attached
 * chevron opens a menu with View as Markdown / Open in ChatGPT / Open in
 * Claude. Hand-rolled (no popover deps), fumadocs design tokens.
 */

const SEGMENT =
  "inline-flex items-center gap-1.5 border py-1.5 text-xs font-medium text-fd-muted-foreground " +
  "transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground";

function absoluteUrl(path: string) {
  // Prompts open in the visitor's browser - always target the public site.
  return `https://ibcs-react.com${path}`;
}

function CopyIcon({ done }: { done: boolean }) {
  return done ? (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ) : (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function PageActions({ markdownUrl }: { markdownUrl: string }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Outside tap / Escape dismissal for the menu.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function copy() {
    try {
      const res = await fetch(markdownUrl);
      if (!res.ok) throw new Error(`${res.status}`);
      await navigator.clipboard.writeText(await res.text());
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore - button label simply stays put */
    }
  }

  const prompt = `Read ${absoluteUrl(markdownUrl)} - the ibcs-react docs page - so I can ask questions about it.`;
  const items = [
    {
      label: "View as Markdown",
      href: markdownUrl,
      icon: (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        </svg>
      ),
    },
    {
      label: "Open in ChatGPT",
      href: `https://chatgpt.com/?hints=search&q=${encodeURIComponent(prompt)}`,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654 2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
        </svg>
      ),
    },
    {
      label: "Open in Claude",
      href: `https://claude.ai/new?q=${encodeURIComponent(prompt)}`,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="border-b pb-6">
      <div ref={rootRef} className="relative inline-flex">
        <button type="button" onClick={copy} className={`${SEGMENT} rounded-l-md pr-2.5 pl-3`}>
          <CopyIcon done={copied} />
          {copied ? "Copied" : "Copy Markdown"}
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="More ways to use this page"
          className={`${SEGMENT} -ml-px rounded-r-md px-1.5`}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {open && (
          <div
            role="menu"
            className="absolute top-full left-0 z-40 mt-1.5 w-52 rounded-lg border bg-fd-popover p-1 shadow-lg"
          >
            {items.map((item) => (
              <a
                key={item.label}
                role="menuitem"
                href={item.href}
                target="_blank"
                rel="noreferrer noopener"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-fd-popover-foreground transition-colors hover:bg-fd-accent"
              >
                {item.icon}
                {item.label}
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                  className="ml-auto text-fd-muted-foreground"
                >
                  <path d="M7 7h10v10" />
                  <path d="M7 17 17 7" />
                </svg>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
