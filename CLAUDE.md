# CLAUDE.md — cursor-cli-mcp

This file is loaded automatically by Claude Code and Claude Desktop into every agent session on this project. Read it before doing anything else.

---

## What This Project Is

A local MCP server (TypeScript + Node.js) that lets external MCP clients (Claude Desktop, Claude Code) invoke Cursor's `agent` CLI with validated inputs, safety guardrails, and structured output. It is a thin, well-typed bridge — not a reimplementation of Cursor's agent.

---

## Mandatory Reading Before Writing Code

Read these docs in order:

1. `docs/AGENT_RULES.md` — non-negotiable rules for all agents
2. `docs/ARCHITECTURE.md` — module layout, constraints, dependency rules
3. `docs/API_SPEC.md` — exact schemas for every tool, resource, and prompt
4. `docs/BRANCH_STRATEGY.md` — which branch to use and what it may touch
5. `docs/TASK_LIST.md` — the authoritative task list; find your task here

Do not write code until you have read all five documents.

---

## Tech Stack (Non-Negotiable)

- TypeScript ~5.4, Node.js >= 20
- `@modelcontextprotocol/sdk` for MCP server
- `zod` for all input validation
- `vitest` for all tests
- `child_process.spawn` (never `exec`, never `shell: true`) for subprocess
- GitHub Actions for CI

---

## Project State

- **Current version:** v1.1 fixes are merged on `dev`; release promotion is a `dev → main` PR when ready. **v1.2** work is Phase 6 (post-audit) — see `docs/TASK_LIST.md`.
- **Branch model:** `main` = production; `dev` = integration; all work branches off `dev` and PRs back to `dev`; release PRs promote `dev` → `main`
- **Phase 5 branches:** merged to `dev` via PRs (see repo history / `docs/TASK_LIST.md` Phase 5 checkboxes). Further hardening is tracked under Phase 6.
- **MCP tools live:** `run_agent`, `list_models`, `agent_status`, `session_create`, `session_resume` — all tested against real binary
- **Known CLI behaviours (confirmed 2026-04-22):**
  - `--trust` is always passed by the server (WORKSPACE_ALLOWLIST is the real security gate)
  - `--max-turns` does not exist in this CLI version — removed from schema
  - `agent ls` is a TUI only — `session_list` tool was removed; no headless session listing available
  - `agent create-chat` may hang after printing ID — dedicated `SESSION_CREATE_TIMEOUT_MS` (default 10s) is the safety net (v1.1 fix)
  - `--sandbox` takes a value: `enabled` or `disabled` (not a bare boolean flag)
  - `agentCliVersion` in `agent_status` output comes from a dedicated `agent --version` call, not from `agent status` stdout (which is login/auth text, not a version string) — fixed 2026-07-25, see `buildAgentVersionArgs()` in `argBuilder.ts`

---

## Layer Model (read ARCHITECTURE.md for full detail)

```
Layer 4 — Transport:      index.ts · server.ts
Layer 3 — Application:    pipeline/ · registry/ · tools/ · resources/ · prompts/
Layer 2 — Ports:          ports/agentExecutor.ts  ← the dependency boundary
Layer 1 — Infrastructure: adapters/agentCli/
Cross-Cutting:            config.ts · security.ts · errors.ts · logger.ts
```

**The dependency rule:** layers only import downward or into cross-cutting. `tools/` imports from `ports/` — NEVER from `adapters/`. `adapters/` imports from `ports/` — NEVER from `tools/`. `ports/` imports nothing.

## Key Architectural Constraints

1. `stdout` is the MCP transport. NEVER write to stdout. Use `logger.ts` (stderr only).
2. All subprocess invocations: `spawn(binary, argsArray, { shell: false })`. No exceptions.
3. Path arguments MUST pass `security.validatePaths()` — called by `pipeline/toolPipeline.ts`, NOT by individual tool handlers.
4. All tool errors return a `StructuredError` (see `src/errors.ts`). Never return raw exception messages.
5. `src/adapters/agentCli/` has no dependency on MCP SDK types or `src/tools/`.
6. Tool handlers have no dependency on each other or on `src/adapters/`.
7. CLI flag names (`--mode`, `--workspace`, etc.) live ONLY in `src/adapters/agentCli/argBuilder.ts`.
8. Adding a new tool: create `src/tools/newTool.ts` + register it in `buildToolDescriptors()` in `src/registry/tools.ts`. Nothing else changes.

---

## What Each Module Owns

| Module | Layer | Responsibility |
|--------|-------|---------------|
| `src/index.ts` | Transport | Composition root — DI wiring only |
| `src/server.ts` | Transport | MCP SDK adapter — reads registries, no business logic |
| `src/pipeline/toolPipeline.ts` | Application | validate → security → execute → map (one place for cross-cutting) |
| `src/registry/tools.ts` | Application | `buildToolDescriptors(config)` — server registers tools from config, never hardcodes handlers |
| `src/tools/*.ts` | Application | One file per MCP tool: schema + pure handler only |
| `src/resources/*.ts` | Application | Static MCP resource content |
| `src/prompts/*.ts` | Application | MCP prompt templates |
| `src/ports/agentExecutor.ts` | Port | IAgentExecutor interface — the only thing tools import from infra boundary |
| `src/adapters/agentCli/executor.ts` | Infrastructure | AgentCliExecutor implements IAgentExecutor |
| `src/adapters/agentCli/argBuilder.ts` | Infrastructure | ALL CLI flag knowledge — one flag rename = one file change |
| `src/adapters/agentCli/ringBuffer.ts` | Infrastructure | Output capture primitive |
| `src/config.ts` | Cross-cutting | Env var loading + validation |
| `src/security.ts` | Cross-cutting | Path allowlist validation (zero external deps) |
| `src/errors.ts` | Cross-cutting | ErrorClass enum + StructuredError + buildError() |
| `src/logger.ts` | Cross-cutting | Structured stderr logging |

---

## How to Run the Gate Check

Before pushing any branch:

```bash
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm run build       # tsc -p tsconfig.build.json
npm run test:unit   # vitest run tests/unit/
```

All four must exit 0.

---

## Env Vars (Quick Reference)

| Var | Default | Description |
|-----|---------|-------------|
| `AGENT_BINARY_PATH` | Platform default | Path to `agent` binary |
| `AGENT_TIMEOUT_MS` | `120000` | Subprocess timeout |
| `MAX_OUTPUT_BYTES` | `524288` | Ring buffer size |
| `WORKSPACE_ALLOWLIST` | `""` | Semicolon-separated allowed paths |
| `LOG_LEVEL` | `info` | Logging level |
| `LOG_PROMPTS` | `false` | Log prompt text at debug |

---

## Forbidden

- `console.log` / `console.error` anywhere in `src/`
- `shell: true` in any spawn call
- `exec()` or `execSync()`
- Floating promises
- `any` type without inline justification comment
- Committing to `main` directly
- Touching files outside your branch's stated scope
- Logging prompt text at INFO level
- Importing from `adapters/` inside `tools/` (layer violation)
- Importing from `tools/` inside `adapters/` (upward dependency)
- Calling `security.validatePaths()` inside a tool handler (pipeline does this)
- Hardcoding CLI flags (`--mode`, `--workspace`, etc.) outside `adapters/agentCli/argBuilder.ts`
- Using `as unknown as SomeType` to cast mocks (implement the interface properly)

---

## When You're Unsure

- If two docs contradict each other → stop and report, don't guess
- If a task is ambiguous → implement the simpler interpretation and document your choice
- If a CLI flag doesn't exist → do not fake it; document the gap and report
- If a merge conflict can't be resolved following ARCHITECTURE.md → flag it for human review
