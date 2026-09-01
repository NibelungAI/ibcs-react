import type React from "react";
import { Skeleton, type SkeletonVariant } from "./Skeleton";
import { useIbcsTokens } from "./theme";
import type { IbcsTokens } from "../core/tokens";

export interface ChartStateProps {
  /** Show the loading placeholder. */
  loading?: boolean;
  /** A truthy value (e.g. an `Error`) switches to the error state. */
  error?: unknown;
  /** Show the empty state. Ignored while `loading`. */
  empty?: boolean;
  /** Width of the default placeholders. Default "100%". */
  width?: number | string;
  /** Height of the default placeholders. Default 240. */
  height?: number;
  /** Shape of the default loading skeleton. Default "chart". */
  variant?: SkeletonVariant;
  /** Replace the default loading skeleton with your own node. */
  renderLoading?: () => React.ReactNode;
  /** Replace the default error message. Receives the `error` value. */
  renderError?: (error: unknown) => React.ReactNode;
  /** Replace the default empty message. */
  renderEmpty?: () => React.ReactNode;
  /** When set, the default error state shows a "Try again" button. */
  onRetry?: () => void;
  /** Text for the default empty state. Default "No data". */
  emptyMessage?: string;
  className?: string;
  style?: React.CSSProperties;
  /** The real content, shown once not loading / error / empty. */
  children?: React.ReactNode;
}

/**
 * The shared centred message box. `role` distinguishes the two very different
 * meanings: an **error** replaces the content and is announced assertively
 * (`alert`), while an empty / idle message is a polite `status`.
 */
function centered(
  tokens: IbcsTokens,
  height: number | undefined,
  body: React.ReactNode,
  role: "status" | "alert" = "status",
  extra?: React.CSSProperties,
): React.ReactElement {
  return (
    <div
      role={role}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        minHeight: height ?? 240,
        padding: 16,
        textAlign: "center",
        fontFamily: tokens.font.family,
        color: "#8a8a84",
        fontSize: 13,
        ...extra,
      }}
    >
      {body}
    </div>
  );
}

/**
 * A small state machine for any chart or table: show a loading **skeleton**, an
 * **error** message (optionally with a retry button), an **empty** state, or the
 * real content - and override any of them with your own node. Pairs directly
 * with `useAsyncData` (`{ data, loading, error, refetch }`).
 *
 * Resolution order: `error` → `loading` → `empty` → `children`. Zero-dependency
 * and SSR-safe.
 *
 * @example
 * ```tsx
 * const { data, loading, error, refetch } = useAsyncData(fetchRows);
 * <ChartState loading={loading} error={error} empty={!data?.length}
 *             height={320} variant="table" onRetry={refetch}>
 *   <StatementTable lines={data ?? []} />
 * </ChartState>
 * ```
 */
export function ChartState({
  loading,
  error,
  empty,
  width = "100%",
  height,
  variant = "chart",
  renderLoading,
  renderError,
  renderEmpty,
  onRetry,
  emptyMessage = "No data",
  className,
  style,
  children,
}: ChartStateProps): React.ReactElement {
  const tokens = useIbcsTokens();
  const wrap = (node: React.ReactNode): React.ReactElement => (
    <div className={className} style={{ width, ...style }}>
      {node}
    </div>
  );

  if (error) {
    if (renderError) return wrap(renderError(error));
    const message = error instanceof Error ? error.message : "Something went wrong";
    return wrap(
      // An error that replaces the chart is an alert, not a status update.
      centered(
        tokens,
        height,
        <>
          <div style={{ fontWeight: 600, color: tokens.color.textMuted }}>Couldn’t load data</div>
          <div style={{ maxWidth: 360 }}>{message}</div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              style={{
                marginTop: 4,
                fontFamily: "inherit",
                fontSize: 12.5,
                fontWeight: 600,
                padding: "5px 12px",
                borderRadius: 6,
                border: "1px solid #dcdbd5",
                background: tokens.color.surface,
                color: "#444",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          )}
        </>,
        "alert",
      ),
    );
  }

  if (loading) {
    if (renderLoading) return wrap(renderLoading());
    return wrap(<Skeleton variant={variant} width="100%" height={height} />);
  }

  if (empty) {
    if (renderEmpty) return wrap(renderEmpty());
    return wrap(centered(tokens, height, <div>{emptyMessage}</div>));
  }

  return wrap(children);
}
