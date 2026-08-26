import type { CSSProperties, ReactNode } from "react";

/**
 * A live-example frame for chart embeds in MDX. Charts are printable
 * light-surface artifacts by design, so the frame pins a white card even in
 * the site's dark mode — except when demonstrating a dark token preset, where
 * `dark` paints the card with the Dark theme's surface instead.
 */
export function Frame({
  children,
  dark,
  center,
  style,
}: {
  children: ReactNode;
  /** Paint the card with the Dark preset's surface (for dark-theme demos). */
  dark?: boolean;
  /** Center the content horizontally. */
  center?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      className="not-prose my-4 overflow-x-auto rounded-lg border p-4"
      style={{
        background: dark ? "#1b1b19" : "#fff",
        ...(center ? { display: "flex", justifyContent: "center" } : null),
        ...style,
      }}
    >
      {children}
    </div>
  );
}
