/**
 * Theme context: set the IBCS token theme once for a whole subtree instead of
 * threading a `tokens` prop into every component.
 *
 *   <IbcsThemeProvider tokens={tokenPresets["CVD-safe"]}>
 *     <KpiCard … /> <StatementTable … /> <TrendChart … />
 *   </IbcsThemeProvider>
 *
 * Resolution order (nearest wins): a component's own `tokens` prop, merged on
 * top of the nearest provider's theme, merged on top of `defaultTokens`.
 * Providers nest - an inner provider's override composes onto the outer theme.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  defaultTokens,
  mergeTokens,
  type IbcsTokens,
  type IbcsTokensOverride,
} from "../core/tokens";

const IbcsThemeContext = createContext<IbcsTokens>(defaultTokens);

export interface IbcsThemeProviderProps {
  /**
   * A full theme (e.g. a `tokenPresets` entry) or a partial override; either
   * way it is deep-merged onto the parent theme so providers compose.
   */
  tokens?: IbcsTokensOverride;
  children: ReactNode;
}

/** Provide a token theme to every ibcs-react component beneath. */
export function IbcsThemeProvider({ tokens, children }: IbcsThemeProviderProps) {
  const parent = useContext(IbcsThemeContext);
  const value = useMemo(() => mergeTokens(tokens, parent), [tokens, parent]);
  return <IbcsThemeContext.Provider value={value}>{children}</IbcsThemeContext.Provider>;
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
