# CasaFit · docs-keeper agent

A Claude Code sub-agent that reads and updates the files under `docs/`. The point is to save context tokens: it reads `MEMORY.md` first, opens only the files that index says it needs, and writes any changes back to the same files, so the next turn starts cheap too.

The agent is defined at `.claude/agents/docs-keeper.md`. Claude Code picks it up automatically.

## When to call it

- "What stack are we using for pose?"
- "Add Redis to the stack."
- "Why do we keep a hashed identifier after delete?"
- "We just chose Ktor; record the decision."
- "List what we store on the server versus on the phone."

Anything that reads or writes an architectural fact.

## How to call it

From a Claude Code session:

```
Use the docs-keeper agent to tell me what runs on the phone and what runs on the server.
```

Or in a workflow, use the Agent tool with `subagent_type: "docs-keeper"`.

## What it will and will not do

Will:

- Read `docs/MEMORY.md` first.
- Open at most two memory docs per task, where possible.
- Edit one memory doc per task, where possible.
- Add a one-line entry to `docs/decisions.md` for every change.
- Keep `docs/MEMORY.md` honest when docs are added or renamed.

Will not:

- Edit the PRD, the earlier spec, the Material 3 screens or `project/canvas.json`.
- Commit, push, or publish anything.
- Read the whole PRD if a glossary entry is enough.
- Invent facts. If `docs/` does not answer, it says so and stops.

## Why this saves tokens

Three habits:

1. **One small index.** `docs/MEMORY.md` is a few hundred bytes. Every run starts from there.
2. **One doc per topic.** Each doc is scoped so an agent can read it on its own.
3. **Writes replace, not append.** The docs stay short; the history lives in `decisions.md`.

Combined, a typical lookup opens about 20 KB rather than the 150 KB PRD.

## Reporting shape

Every run ends with a short recap:

- **Read:** files opened.
- **Wrote:** files changed, one line each.
- **Decision log:** title of the entry added, or "no entry".
- **Open questions:** anything the docs cannot answer.
