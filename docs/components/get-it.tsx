"use client";

import { useEffect, useRef, useState } from "react";

/**
 * "The install IS a chart" - the landing page's get-it section as a
 * frameless IBCS horizontal bar chart hanging off a hard 2px category axis.
 * The two commands ARE the bars: Install is a solid AC bar with the command
 * reversed out; the agents command is an FC bar (outlined + 45° hatch) -
 * the agent channel is literally the forecast. Bar length is real data
 * (character count in `ch`). Switching a package manager re-plots the AC
 * bar; copying grows a green good-variance underline from the axis. Each
 * bar carries a one-line supporting note.
 */

const PM_KEY = "package-manager";
const COMMANDS = [
  ["npm", "npm install ibcs-react"],
  ["pnpm", "pnpm add ibcs-react"],
  ["yarn", "yarn add ibcs-react"],
  ["bun", "bun add ibcs-react"],
] as const;

type Pm = (typeof COMMANDS)[number][0];
type CopyState = "idle" | "copied" | "failed";

const AGENT_CMD = "npx skills add NibelungAI/ibcs-react";
const HATCH = {
  backgroundImage:
    "repeating-linear-gradient(45deg, color-mix(in srgb, var(--ac) 22%, transparent) 0 2px, transparent 2px 9px)",
};

function useCopy(): [CopyState, (text: string) => void] {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function copy(text: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => setState("copied"))
      .catch(() => setState("failed"))
      .finally(() => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setState("idle"), 1800);
      });
  }
  return [state, copy];
}

function ValueLabel({ state }: { state: CopyState }) {
  if (state === "copied")
    return <span className="shrink-0 font-mono text-xs text-[var(--good)]">▲ copied</span>;
  if (state === "failed")
    return <span className="shrink-0 font-mono text-xs text-[var(--bad)]">▼ failed</span>;
  return (
    <span className="shrink-0 font-mono text-xs text-[var(--dim)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
      ⧉ copy
    </span>
  );
}

function VariancePin({ state }: { state: CopyState }) {
  return (
    <div
      aria-hidden
      className={`absolute -bottom-2 left-0 h-1 w-full origin-left transition-transform duration-[240ms] ease-out motion-reduce:transition-none ${
        state === "idle" ? "scale-x-0" : "scale-x-100"
      } ${state === "failed" ? "bg-[var(--bad)]" : "bg-[var(--good)]"}`}
    />
  );
}

const LABEL =
  "text-sm font-semibold tracking-[0.12em] uppercase text-[var(--ink)] pb-2 sm:pb-0 sm:text-right sm:pr-5 sm:pt-[1.35rem]";

export function GetIt() {
  const [pm, setPm] = useState<Pm>("npm");
  const [acState, copyAc] = useCopy();
  const [fcState, copyFc] = useCopy();

  useEffect(() => {
    const stored = sessionStorage.getItem(PM_KEY) ?? localStorage.getItem(PM_KEY);
    if (stored && COMMANDS.some(([name]) => name === stored)) setPm(stored as Pm);
  }, []);

  function select(next: Pm) {
    setPm(next);
    localStorage.setItem(PM_KEY, next);
    sessionStorage.setItem(PM_KEY, next);
  }

  const command = COMMANDS.find(([name]) => name === pm)?.[1] ?? COMMANDS[0][1];

  return (
    <section className="gi mt-16 w-full text-left">
      {/* Legend doubles as the package-manager switcher. */}
      <div className="mb-5 flex items-center justify-end gap-5">
        {COMMANDS.map(([name]) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={pm === name}
            onClick={() => select(name)}
            className="group/key flex items-center gap-1.5 font-mono text-[12px] tracking-[0.1em] uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-ring"
          >
            <span
              aria-hidden
              className={`size-2 transition-colors ${pm === name ? "bg-[var(--ac)]" : "bg-[var(--py)]"}`}
            />
            <span
              className={
                pm === name
                  ? "text-[var(--ink)]"
                  : "text-[var(--dim)] group-hover/key:text-[var(--ink)]"
              }
            >
              {name}
            </span>
          </button>
        ))}
      </div>

      <div className="relative">
        {/* The category axis the bars hang off. */}
        <div
          aria-hidden
          className="absolute inset-y-[-10px] left-[10rem] hidden w-[2px] bg-[var(--ac)] sm:block"
        />

        {/* Row 1 - AC: the actual. */}
        <div className="items-start gap-0 py-2.5 sm:grid sm:grid-cols-[10rem_1fr]">
          <div className={LABEL}>Install</div>
          <div className="min-w-0">
            <div className="flex items-center gap-3 overflow-x-auto py-1 [scrollbar-width:none]">
              <button
                type="button"
                onClick={() => copyAc(command)}
                aria-label={`Copy: ${command}`}
                className="group relative shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fd-ring"
              >
                <span
                  style={{ width: `calc(${command.length}ch + 2.6em)` }}
                  className="flex items-center bg-[var(--ac)] py-4 pl-[1.3em] font-mono text-[clamp(0.95rem,2.4vw,1.55rem)] leading-none font-medium whitespace-nowrap text-[var(--onac)] transition-[width] duration-[260ms] ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none sm:py-5"
                >
                  {command}
                </span>
                <VariancePin state={acState} />
              </button>
              <ValueLabel state={acState} />
            </div>
          </div>
        </div>

        {/* Row 2 - FC: the forecast (agents). */}
        <div className="items-start gap-0 py-2.5 sm:grid sm:grid-cols-[10rem_1fr]">
          <div className={LABEL}>For AI agents</div>
          <div className="min-w-0">
            <div className="flex items-center gap-3 overflow-x-auto py-1 [scrollbar-width:none]">
              <button
                type="button"
                onClick={() => copyFc(AGENT_CMD)}
                aria-label={`Copy: ${AGENT_CMD}`}
                className="group relative shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fd-ring"
              >
                <span
                  style={HATCH}
                  className="flex items-center border-[1.5px] border-[var(--ac)] py-4 pr-[1.3em] pl-[1.3em] font-mono text-[clamp(0.95rem,2.4vw,1.55rem)] leading-none font-medium whitespace-nowrap text-[var(--ink)] sm:py-5"
                >
                  {AGENT_CMD}
                </span>
                <VariancePin state={fcState} />
              </button>
              <ValueLabel state={fcState} />
            </div>
            <p className="mt-2.5 max-w-xl pl-4 text-[13px] leading-relaxed text-[var(--dim)] sm:pl-5">
              IBCS rules + component recipes for Claude Code, Cursor, Codex and 70+ agents. Docs are
              agent-readable:{" "}
              <a href="/llms.txt" className="underline underline-offset-2 hover:text-[var(--ink)]">
                llms.txt
              </a>
              {" · "}
              <a
                href="/llms-full.txt"
                className="underline underline-offset-2 hover:text-[var(--ink)]"
              >
                llms-full.txt
              </a>
              {" · "}any page as <code className="font-mono text-[12px]">.mdx</code>
            </p>
          </div>
        </div>
      </div>

      <span className="sr-only" role="status">
        {acState === "copied" || fcState === "copied" ? "Copied to clipboard" : ""}
      </span>
    </section>
  );
}
