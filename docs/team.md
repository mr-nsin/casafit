# CasaFit · The agent team

A small team of Claude Code sub-agents, each with one role. They are defined under `.claude/agents/` and picked up automatically. Each has its own context window and its own tool list, so a specialist does not pollute the main conversation.

## Who's who

| Agent | Owns | Reads only | Must not touch |
|---|---|---|---|
| **team-lead** | nothing (routes) | everything | any file at all |
| **product-manager** | `fitness-app-prd.html`, `fitness-app-spec.html` | screens, docs | screens, docs, `.claude/` |
| **architect** | `docs/architecture.md`, `docs/tech-stack.md`, `docs/data-model.md` | PRD, screens, other docs | PRD, screens, `.claude/` |
| **project-manager** | `docs/plans/*.md` | docs, PRD | screens, code, `.claude/` |
| **ux-designer** | `project/m3-*.dc.html` | docs, PRD | `project/canvas.json`, docs, PRD |
| **content-writer** | visible strings inside `project/m3-*.dc.html` | docs, PRD | layout, markup, icons, links, ARIA |
| **mobile-engineer** | `app/**` (React Native + TypeScript) | docs, plans, screens | `api/`, docs, screens |
| **backend-engineer** | `api/**` (NestJS + Prisma) | docs, plans | `app/`, docs, screens |
| **qa-engineer** | `app/**/*.test.*`, `api/test/`, `api/**/*.spec.*`, `tests/maestro/**` | code, docs, plans | feature code (hands bugs back) |
| **reviewer** | *nothing* (read-only) | everything | any file at all |
| **integrator** | `project/canvas.json`, the publish step | everything | screens, docs, PRD |
| **docs-keeper** | `docs/MEMORY.md`, `docs/*.md` | its own files | everything else |

## How a feature flows

```
  team-lead             ·   routes the request
          │
          ▼
  product-manager       →   PRD edit
          │
          ▼
  architect             →   architecture.md / tech-stack.md / data-model.md, if affected
          │
          ▼
  project-manager       →   docs/plans/<slug>.md with mobile, backend and QA tasks
          │
          ▼
  ux-designer           →   screens on the matching lane
          │
          ▼
  content-writer        →   strings on the same lane
          │
          ▼
  mobile-engineer       →   React Native code under app/
  backend-engineer      →   NestJS code under api/
          │
          ▼
  qa-engineer           →   Jest, Supertest and Maestro tests
          │
          ▼
  reviewer              →   runs tools/check.py and scans the diff
          │
          ▼
  integrator            →   merges the lane, rebuilds canvas.json, publishes
          │
          ▼
  docs-keeper           →   logs a one-line entry in decisions.md
```

Each arrow is a separate sub-agent run with its own context window. The team-lead agent can spawn specialists in parallel for independent work.

## Rules every agent follows

1. **Read `docs/MEMORY.md` first.** It is the index.
2. **Open the smallest set of files the task needs.**
3. **Edit files you own; never files another agent owns.**
4. **Ask `docs-keeper` to record any decision.** Do not write to `decisions.md` yourself.
5. **Never commit, push or publish from a specialist.** Only the integrator publishes the canvas; only the human (or the main session) commits and pushes.

## How to invoke them

- Natural language: "Use the architect subagent to decide on the pose runner for iOS."
- Explicit: `@"architect (agent)" add Redis to the stack`.
- From a workflow: `Agent(subagent_type: "architect", prompt: "…")`.

Project agents live in `.claude/agents/` and are picked up within seconds of being saved. Changes to the files are hot-reloaded.

## Why this saves tokens

Each specialist starts with an empty context window and a short system prompt. The main conversation never sees the files the specialist opened, only its short recap. For a repository with 71 screens and seven docs, this is the difference between loading a few kilobytes and loading over a megabyte.
