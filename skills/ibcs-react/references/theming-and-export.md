# Theming, sizing, export, tooltips

## Tokens

```ts
interface IbcsTokens {
  color: {
    neutral;
    total; // actual step bars · emphasised subtotal bars
    good;
    bad;
    zero; // favorable · unfavorable · no change (impact, not sign)
    axis;
    gridline;
    text;
    textMuted;
    rowBorder;
    surface;
    surfaceMuted; // opaque card/menu/tooltip/sticky-cell background,
    // also the fill of hollow PL shapes → dark mode works
    onFill; // ink drawn ON a solid bar (in-bar value labels)
  };
  scenario: Record<
    "AC" | "PY" | "PL" | "FC",
    { fill; stroke; variant: "solid" | "frame" | "hatch" }
  >;
  font: { family: string };
}
```

Defaults encode the notation: `AC` solid dark, `PY` solid light grey, `PL`
transparent + stroke (`variant: "frame"`), `FC` hatched. Change hues, not the
grammar — scenarios are distinguished by _fill_, so a report stays readable in
greyscale.

## Presets

`tokenPresets` is a `Record<string, IbcsTokens>` with all eight, ready for a
theme switcher; each is also exported by name.

| Key            | Export           | Notes                                                    |
| -------------- | ---------------- | -------------------------------------------------------- |
| `Default`      | `defaultTokens`  | neutral warm greys, muted green/red                      |
| `Ocean`        | `oceanTokens`    | navy actuals, IBCS semantic green/red                    |
| `Azure`        | `azureTokens`    | monochromatic bright blue                                |
| `Green / Red`  | `greenRedTokens` | strict business look, vivid variance                     |
| `Vivid`        | `vividTokens`    | teal/blue actuals                                        |
| `CVD-safe`     | `cvdTokens`      | colour-vision-deficiency safe (teal/orange impact)       |
| `Mono / print` | `monoTokens`     | greyscale for B/W printing                               |
| `Dark`         | `darkTokens`     | dark `color.surface` + `onFill`, cards/tooltips included |

## Provider and resolution order

```tsx
import {
  IbcsThemeProvider,
  tokenPresets,
  darkTokens,
  mergeTokens,
  useIbcsTokens,
} from "ibcs-react";

<div style={{ background: darkTokens.color.surface }}>
  <IbcsThemeProvider tokens={darkTokens}>
    <StatementTable lines={lines} />
    {/* nearest wins — this one chart departs from the theme */}
    <TrendChart data={monthly} tokens={{ color: { bad: "#c62828" } }} />
  </IbcsThemeProvider>
</div>;
```

Nearest first: component `tokens` prop → nearest provider theme → `defaultTokens`.
Providers nest and compose. `mergeTokens(override, base = defaultTokens)`
resolves a partial into a full set (`mergeTokens({ color: { good: "#2e7d32" } }, darkTokens)`).
`IbcsTokensOverride` is the partial type. Building your own SVG on
`ibcs-react/core`? `useIbcsTokens(override?)` resolves exactly what the built-ins
resolve, so custom marks join the same theme.

## Sizing

Charts draw at explicit pixel sizes — nothing measures itself — and the wrappers
re-render the chart at the resolved size (text and strokes stay crisp; no
bitmap scaling). All are SSR-safe: nothing draws before the container is
measured, so a chart never gets `0` / `NaN`.

```tsx
<ChartBox width={760} height={300} fit="scale" minWidth={680}>
  {(w, h) => <TrendChart width={w} height={h} data={monthly} />}
</ChartBox>
```

- `ChartBox` — **the one to reach for**. `fit`: `"scale"` (default: fill the
  available width at the chart's aspect ratio, stop shrinking at `minWidth` and
  scroll) · `"fixed"` (intrinsic size + scroll) · `"contain"` (letterbox) ·
  `"fill"` (stretch). Plus `minWidth`/`maxWidth`/`maxHeight`, `align`
  (`left|center|right`), `verticalAlign` (`top|middle|bottom`), `padding`,
  `background`, `scroll` (`auto|none`).
- `ResponsiveChart` — minimal ResizeObserver render-prop: `aspect`, `minWidth`,
  `minHeight`, `maxHeight`, `debounce`.
- `ScrollChart` — one dimension fills, the other scrolls (`height` **or**
  `width`, `minWidth`, `maxHeight`). Good for a 13-period trend on a phone.
- `ChartFrame` — deprecated preset of `ChartBox`; just swap the tag name.
- `useElementSize` sizes a chart from its container directly.

### bandPadding

Every categorical chart takes
`bandPadding?: number | { inner?: number; outer?: number }` (core helper:
`bandScale` / `resolveBandPadding`, D3 `scaleBand` semantics). `inner` is the
gap between columns (default `0.2`), `outer` the lead-in/out gutter (mirrors
`inner` when omitted). `bandPadding={{ outer: 0 }}` puts the first/last column
flush to the plot edge.

## Export

```tsx
<ExportMenu
  filename="net-sales"
  data={rows}
  csv={csvText}
  pngScale={2}
  onError={(err, action) => notify(action)}
>
  <TrendChart data={monthly} width={640} height={300} />
</ExportMenu>
```

- SVG / PNG act on the first `<svg>` inside the children (disabled if none).
- CSV / JSON entries appear only when `csv` / `data` are passed.
- Also Copy SVG / Copy PNG / Print. Failures call
  `onError(error, action: ExportMenuAction)` (`"svg" | "png" | "csv" | "json" |
"copy-svg" | "copy-png" | "print"`) — never an unhandled rejection.
- Fully keyboard-operable menu (arrows rove, Home/End, Escape returns focus).
  All DOM work happens in click handlers, so it is SSR-safe.

Helpers for a custom UI: `serializeSvg`, `downloadSVG`, `svgToPngBlob`,
`downloadPNG`, `downloadCSV`, `downloadTextFile`, `copySvgToClipboard`,
`copyPngToClipboard`, `printSvg`, `canCopyImage`; plus `statementToCSV` /
`toCSV` from `ibcs-react/core`. Every chart forwards its `ref` to the `<svg>`:

```tsx
const ref = useRef<SVGSVGElement>(null);
<TrendChart ref={ref} data={monthly} width={640} height={300} />;
if (ref.current) downloadSVG(ref.current, "trend.svg");
```

## Tooltips

Built in on every chart, `tooltip` defaults to `true`.

- Trigger within ~8 px of a _visible mark_, not anywhere in the category band.
- Print the exact figure (`30,123,457` where the chart label says `30.1M`) plus
  the comparison and the signed Δ with percent.
- Keyboard focus shows the same tooltip (WCAG 1.4.13); touch shows a sticky
  mark-anchored tooltip; Escape or an outside tap dismisses.
- Rendered into a `document.body` portal (the only `react-dom` use), flipping at
  viewport edges; inks come from the token theme, so they stay legible on dark.
- Wiring your own? Pass `onHover` (pairs with `useChartHover` + `ChartTooltip`)
  and set `tooltip={false}`. On very large `StatementTable`s, `tooltip={false}`
  removes hover state tracking entirely (zero re-renders on mouse move).
