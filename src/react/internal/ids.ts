/**
 * Id-collection helpers shared by the controlled-state components.
 *
 * Every table (and `useStatement`) accepts its controlled sets as either an
 * array or a `Set` — friendlier for callers keeping the ids in URL state or in
 * a store. They all normalized that the same way, in four private copies; this
 * is the one implementation.
 *
 * Internal module: not part of the public API surface.
 */

/** Normalize a controlled id collection (array or Set) to a Set. */
export function toIdSet(ids: ReadonlySet<string> | readonly string[]): Set<string> {
  return new Set(ids as Iterable<string>);
}
