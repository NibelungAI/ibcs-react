/**
 * Theme context: set the IBCS token theme - and the components' own words -
 * once for a whole subtree instead of threading `tokens` / `labels` props into
 * every component.
 *
 *   <IbcsThemeProvider tokens={tokenPresets["CVD-safe"]} labels={{ total: "Ukupno" }}>
 *     <KpiCard … /> <StatementTable … /> <TrendChart … />
 *   </IbcsThemeProvider>
 *
 * Resolution order (nearest wins): a component's own `tokens` / `labels` prop,
 * merged on top of the nearest provider's, merged on top of `defaultTokens` /
 * `defaultLabels`. Providers nest - an inner provider's override composes onto
 * the outer one.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  defaultTokens,
  mergeTokens,
  type IbcsTokens,
  type IbcsTokensOverride,
} from "../core/tokens";
import {
  resolveLabels,
  type IbcsLabels,
  type IbcsLabelsComplete,
  type IbcsLabelsOverride,
} from "../core/labels";

const IbcsThemeContext = createContext<IbcsTokens>(defaultTokens);
const IbcsLabelsContext = createContext<IbcsLabelsComplete>(resolveLabels());

export interface IbcsThemeProviderProps {
  /**
   * A full theme (e.g. a `tokenPresets` entry) or a partial override; either
   * way it is deep-merged onto the parent theme so providers compose.
   */
  tokens?: IbcsTokensOverride;
  /**
   * The words components write themselves (scenario codes, "Total", "vs",
   * table column names, button names - see {@link IbcsLabels}), whole or in
   * part; merged onto the parent provider's words.
   */
  labels?: IbcsLabelsOverride;
  children: ReactNode;
}

/** Provide a token theme and a word dictionary to every ibcs-react component beneath. */
export function IbcsThemeProvider({ tokens, labels, children }: IbcsThemeProviderProps) {
  const parent = useContext(IbcsThemeContext);
  const value = useMemo(() => mergeTokens(tokens, parent), [tokens, parent]);
  const parentLabels = useContext(IbcsLabelsContext);
  const words = useMemo(() => resolveLabels(labels, parentLabels), [labels, parentLabels]);
  return (
    <IbcsThemeContext.Provider value={value}>
      <IbcsLabelsContext.Provider value={words}>{children}</IbcsLabelsContext.Provider>
    </IbcsThemeContext.Provider>
  );
}

/**
 * The active theme with an optional per-component override applied - what
 * every component calls internally to resolve its `tokens` prop. Public so
 * custom charts built on `ibcs-react/core` can participate in the same theme.
 */
export function useIbcsTokens(override?: IbcsTokensOverride): IbcsTokens {
  const base = useContext(IbcsThemeContext);
  return useMemo(() => (override ? mergeTokens(override, base) : base), [override, base]);
}

/**
 * The active word dictionary with an optional per-component override applied
 * - what every component calls to resolve its `labels` prop. Public so custom
 * charts speak the same words as the built-in ones. Typed `IbcsLabels`, as in
 * 1.5.0; the value holds every word, those added since included.
 */
export function useIbcsLabels(override?: IbcsLabelsOverride): IbcsLabels {
  return useResolvedLabels(override);
}

/**
 * {@link useIbcsLabels}, typed as the components that write the words added
 * after 1.5.0 read it: every word present.
 *
 * Internal plumbing - not part of the public surface.
 */
export function useResolvedLabels(override?: IbcsLabelsOverride): IbcsLabelsComplete {
  const base = useContext(IbcsLabelsContext);
  return useMemo(() => (override ? resolveLabels(override, base) : base), [override, base]);
}
