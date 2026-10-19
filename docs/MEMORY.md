# CasaFit · Memory index

**Read this file first.** It is the entry point for every agent working on this repo. Each row is one line; pull the full file only when you need its detail. This keeps context small.

Updated 19 October 2026.

## Documents

| File | What it holds | When to read it |
|---|---|---|
| [overview.md](overview.md) | What CasaFit is in 10 lines, the main decisions | Always, for context |
| [architecture.md](architecture.md) | The proposed system: layers, services, data flow | Before any backend, API or app-platform work |
| [tech-stack.md](tech-stack.md) | Chosen frameworks, SDKs, libraries, versions, cost estimates | Before you add a dependency or pick a tool |
| [data-model.md](data-model.md) | Account, plan, session, food, step and credit records; retention; what lives on the phone vs the server | Before any schema or data-flow work |
| [glossary.md](glossary.md) | The product vocabulary (free check, lane, 15-minute shape, warm-up, cool-down and so on) | When terminology is unclear |
| [decisions.md](decisions.md) | Short, dated log of design decisions and why they were made | When a decision needs recording, or you want the history |
| [docs-agent.md](docs-agent.md) | How the `docs-keeper` agent reads and updates these files | When you invoke the agent, or want to understand its rules |
| [team.md](team.md) | The agent team: who owns what, how a feature flows, what each specialist can and cannot touch | Before you call any sub-agent, or when designing a new one |

## Source files, outside `docs/`

| Path | What it is |
|---|---|
| `fitness-app-prd.html` | The product requirements document, the main spec |
| `fitness-app-spec.html` | Earlier feature plan the PRD builds on |
| `project/m3-*.dc.html` | 71 Material 3 screen designs |
| `project/canvas.json` | Canvas index for the design artifact |
| `CLAUDE.md` | Repo rules, including lanes and worktrees |
| `tools/check.py` | Design validation |

## Rules for agents (short)

1. Read `MEMORY.md` first. Open other docs only when their row says you need them.
2. Edit at most one doc per task, with a single-sentence note at the top of `decisions.md` for anything new.
3. Keep each doc under 400 lines. Split rather than let one grow large.
4. Never duplicate content between docs. Cross-link instead.
5. When you add, rename or retire a doc, update this file in the same turn.
