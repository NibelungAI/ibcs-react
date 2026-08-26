# ibcs-react agent skills

Portable [SKILL.md](https://agentskills.io) skills that teach coding agents to
build **IBCS® / ISO 24896** business reports — with the
[`ibcs-react`](https://www.npmjs.com/package/ibcs-react) library, or with any
charting tool at all.

## Install

```bash
npx skills add NibelungAI/ibcs-react
```

Works with Claude Code, Cursor, Codex, Copilot, Gemini CLI and ~77 other
agents. Or copy a skill folder into your agent's skills directory
(`.claude/skills/`, `.opencode/skills/`, …).

## The skills

| Skill                                       | What it gives the agent                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`ibcs-react`](./ibcs-react/SKILL.md)       | Using the library correctly: install and RSC/SSR setup, the one scenario data model (`AC` / `PY` / `PL` / `FC`), canonical snippets for variance charts, waterfalls, statement tables and theming, plus references for [charts](./ibcs-react/references/charts.md), [tables](./ibcs-react/references/tables.md) and [theming/export](./ibcs-react/references/theming-and-export.md). |
| [`ibcs-notation`](./ibcs-notation/SKILL.md) | The notation itself — scenario fills, impact-based variance colouring, absolute vs percent panels, zero-baseline and uniform scaling, Who/What/When titles, waterfall conventions, templates C01–C13 / T01–T04. Standalone: useful with D3, Vega, Excel or PowerPoint too.                                                                                                           |

Docs: <https://ibcs-react.com> · agent index: `/llms.txt` · full corpus:
`/llms-full.txt` · any docs page as raw Markdown: append `.mdx` to its URL.

MIT licensed, like the library.
