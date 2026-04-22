# Branch Strategy: cursor-cli-mcp

**Last updated:** 2026-04-21  
**Status:** Authoritative — all agents must follow this branching model exactly.

---

## 1. Core Rules

1. `main` is always deployable. Direct commits to `main` are forbidden.
2. Every branch targets exactly one phase and one concern.
3. PRs require all CI checks green before merge.
4. Integration tests must pass (if agent binary available) before any Phase 2+ branch merges.
5. A branch marked **serial** cannot start until its dependency is merged to `main`.
6. A branch marked **parallel** can be worked simultaneously with other parallel branches in the same group.
7. If a **gated** branch's gate condition fails, the branch is cancelled — document in TASK_LIST.md.

---

## 2. Branch Dependency Graph

```
main
│
├─ feat/phase-0-scaffold  ──────────────────────────────────────── [PARALLEL: none, start any time]
│
│  (merge feat/phase-0-scaffold to main before starting Phase 1)
│
├─ feat/phase-1-mcp-server       ─┐  [PARALLEL: can work simultaneously]
├─ feat/phase-1-agent-executor   ─┘  Both depend on: phase-0-scaffold merged
│
│  (merge BOTH phase-1 branches to main before starting Phase 2)
│
├─ feat/phase-2-tool-run-agent   ─┐
├─ feat/phase-2-tool-models      ─┤  [PARALLEL: all can work simultaneously]
├─ feat/phase-2-tool-health      ─┤  All depend on: both phase-1 branches merged
├─ feat/phase-2-cli-validation   ─┘  (cli-validation gates session branches)
│
├─ feat/phase-2-tool-sessions    ──── [SERIAL after phase-2-cli-validation merged]
│                                      GATED: only proceed if CLI validation passes
│
│  (merge ALL phase-2 branches to main before starting Phase 3)
│
├─ feat/phase-3-resources        ─┐  [PARALLEL: can work simultaneously]
├─ feat/phase-3-prompts          ─┘  Both depend on: all phase-2 branches merged
│
│  (merge BOTH phase-3 branches to main before starting Phase 4)
│
├─ feat/phase-4-security         ─┐  [PARALLEL: can work simultaneously]
└─ feat/phase-4-streaming        ─┘  Both depend on: all phase-3 branches merged
```

---

## 3. Branch Specifications

### Phase 0

#### `feat/phase-0-scaffold`

- **Depends on:** nothing (branch from `main`)
- **Parallel with:** nothing
- **Concerns:** TypeScript project setup, CI pipeline, toolchain config
- **Files touched:** `package.json`, `tsconfig.json`, `tsconfig.build.json`, `.eslintrc.json`, `.prettierrc`, `vitest.config.ts`, `.github/workflows/ci.yml`, `.github/workflows/pr-checks.yml`, `.gitignore`, `src/` (empty stubs), `tests/` (empty stubs)
- **Gate:** `npm run lint && npm run typecheck && npm run build` all exit 0
- **PR title format:** `feat(phase-0): scaffold TypeScript project and CI pipeline`

---

### Phase 1

#### `feat/phase-1-mcp-server`

- **Depends on:** `feat/phase-0-scaffold` merged to `main`
- **Parallel with:** `feat/phase-1-agent-executor`
- **Concerns:** MCP Server instantiation, tool/resource/prompt registration stubs, stdio transport wiring
- **Files touched:** `src/server.ts`, `src/index.ts`, `src/logger.ts`, `src/errors.ts`
- **Does NOT touch:** `src/executor/`, any tool handler implementations
- **Gate:** MCP `initialize` handshake succeeds; server lists 0 tools (stubs not yet wired)
- **PR title format:** `feat(phase-1): MCP server scaffolding and stdio transport`

#### `feat/phase-1-agent-executor`

- **Depends on:** `feat/phase-0-scaffold` merged to `main`
- **Parallel with:** `feat/phase-1-mcp-server`
- **Concerns:** `AgentExecutor` class, `RingBuffer`, `ExecutorOptions`/`ExecutorResult` types, subprocess management, timeout logic
- **Files touched:** `src/executor/index.ts`, `src/executor/ringBuffer.ts`, `src/executor/types.ts`, `src/config.ts`, `src/security.ts`, `tests/unit/executor.test.ts`, `tests/unit/ringBuffer.test.ts`, `tests/unit/security.test.ts`, `tests/unit/config.test.ts`, `tests/fixtures/mockExecutor.ts`
- **Does NOT touch:** `src/server.ts`, any tool handlers
- **Gate:** All unit tests for executor, ringBuffer, security, config pass
- **PR title format:** `feat(phase-1): AgentExecutor, RingBuffer, and security primitives`

---

### Phase 2

#### `feat/phase-2-tool-run-agent`

- **Depends on:** both `feat/phase-1-`* branches merged to `main`
- **Parallel with:** `feat/phase-2-tool-models`, `feat/phase-2-tool-health`, `feat/phase-2-cli-validation`
- **Concerns:** `run_agent` tool — Zod schema, handler, CLI arg builder, wired into server
- **Files touched:** `src/tools/runAgent.ts`, `tests/unit/tools/runAgent.test.ts`, update `src/server.ts` to register tool
- **Gate:** 6 unit tests pass; `run_agent` callable from MCP host
- **PR title format:** `feat(phase-2): run_agent tool implementation`

#### `feat/phase-2-tool-models`

- **Depends on:** both `feat/phase-1-`* branches merged to `main`
- **Parallel with:** `feat/phase-2-tool-run-agent`, `feat/phase-2-tool-health`, `feat/phase-2-cli-validation`
- **Concerns:** `list_models` tool
- **Files touched:** `src/tools/listModels.ts`, `tests/unit/tools/listModels.test.ts`, update `src/server.ts`
- **Gate:** 4 unit tests pass; `list_models` callable from MCP host
- **PR title format:** `feat(phase-2): list_models tool implementation`

#### `feat/phase-2-tool-health`

- **Depends on:** both `feat/phase-1-`* branches merged to `main`
- **Parallel with:** `feat/phase-2-tool-run-agent`, `feat/phase-2-tool-models`, `feat/phase-2-cli-validation`
- **Concerns:** `agent_status` tool
- **Files touched:** `src/tools/agentStatus.ts`, `tests/unit/tools/agentStatus.test.ts`, update `src/server.ts`
- **Gate:** 4 unit tests pass; `agent_status` callable from MCP host
- **PR title format:** `feat(phase-2): agent_status tool implementation`

#### `feat/phase-2-cli-validation`

- **Branch type:** RESEARCH (not a feature branch — produces no compiled code)
- **Depends on:** both `feat/phase-1-`* branches merged to `main`
- **Parallel with:** `feat/phase-2-tool-run-agent`, `feat/phase-2-tool-models`, `feat/phase-2-tool-health`
- **Concerns:** Run `agent session --help`, evaluate against PASS criteria in TASK_LIST.md T2.5, update TASK_LIST.md with gate result and raw command output
- **Files touched:** `docs/TASK_LIST.md` only (gate result + raw output). Do NOT touch `src/` or `tests/`.
- **Gate:** TASK_LIST.md "Session Gate Record" section is fully filled in with `SESSION_GATE: PASS` or `SESSION_GATE: FAIL`
- **PR checklist override:** This branch is exempt from `npm run test:unit` and `npm run build` gate requirements (no code changed). Only `npm run lint` on the markdown file is required.
- **PR title format:** `research(phase-2): CLI session command validation`

#### `feat/phase-2-tool-sessions` — GATED

- **Depends on:** `feat/phase-2-cli-validation` merged AND `SESSION_GATE: PASS`
- **Parallel with:** nothing (serial)
- **Concerns:** `session_list`, `session_create`, `session_resume` tools
- **Files touched:** `src/tools/sessionList.ts`, `src/tools/sessionCreate.ts`, `src/tools/sessionResume.ts`, corresponding test files, update `src/server.ts`
- **CANCELLED IF:** `SESSION_GATE: FAIL` — document cancellation in TASK_LIST.md
- **Gate (if not cancelled):** 4 unit tests each; all three tools callable from MCP host
- **PR title format:** `feat(phase-2): session tools (list, create, resume)`

---

### Phase 3

#### `feat/phase-3-resources`

- **Depends on:** all `feat/phase-2-`* branches merged to `main`
- **Parallel with:** `feat/phase-3-prompts`
- **Concerns:** `cli-permissions-reference` and `rules-discovery` MCP resources
- **Files touched:** `src/resources/cliPermissions.ts`, `src/resources/rulesDiscovery.ts`, update `src/server.ts`
- **Gate:** Both resources readable from MCP host; content is non-empty markdown
- **PR title format:** `feat(phase-3): CLI permissions and rules discovery resources`

#### `feat/phase-3-prompts`

- **Depends on:** all `feat/phase-2-`* branches merged to `main`
- **Parallel with:** `feat/phase-3-resources`
- **Concerns:** `plan-only`, `ask-only`, `worktree-isolation` prompt templates
- **Files touched:** `src/prompts/planOnly.ts`, `src/prompts/askOnly.ts`, `src/prompts/worktreeIsolation.ts`, update `src/server.ts`
- **Gate:** All three prompt templates loadable from MCP host; each generates valid `run_agent` arguments
- **PR title format:** `feat(phase-3): plan-only, ask-only, worktree-isolation prompt templates`

---

### Phase 4

#### `feat/phase-4-security`

- **Depends on:** all `feat/phase-3-`* branches merged to `main`
- **Parallel with:** `feat/phase-4-streaming`
- **Concerns:** Security regression test suite, path traversal hardening, prompt logging audit
- **Files touched:** `tests/unit/security.test.ts` (expanded), `src/security.ts` (if gaps found), docs
- **Gate:** All security regression tests pass; cold start < 500ms benchmark met
- **PR title format:** `feat(phase-4): security regression suite and hardening`

#### `feat/phase-4-streaming`

- **Depends on:** all `feat/phase-3-`* branches merged to `main`
- **Parallel with:** `feat/phase-4-security`
- **Concerns:** Streaming output via MCP notifications for `run_agent`
- **Files touched:** `src/tools/runAgent.ts` (streaming variant), `src/executor/index.ts` (streaming support), new streaming tests
- **Mandatory design review gate (before writing any code):**
  1. Open a GitHub Issue titled `design: streaming output for run_agent` with the proposed design (how chunks flow from executor → tool handler → MCP notifications, how aggregated fallback works, how `isStreaming` capability is detected from the MCP client).
  2. Tag the issue with `design-review`.
  3. The Issue must receive a comment with explicit approval ("LGTM" or "approved") from the repo owner (@devshah) before any code in this branch is written.
  4. Link the approved Issue in the PR description under "Design review."
- **Gate:** Design review approved (Issue linked); first chunk delivered to MCP client < 2s for a typical prompt; all streaming tests pass
- **PR title format:** `feat(phase-4): streaming output via MCP notifications`

---

## 4. PR Checklist (Required for All PRs)

Every PR description MUST include this checklist:

```markdown
## Phase Gate Checklist
- [ ] `npm run lint` exits 0
- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm run test:unit` exits 0 with all tests passing
- [ ] Integration tests pass (or marked skipped with reason)
- [ ] No new `any` types introduced without explicit comment explaining why
- [ ] No `shell: true` in any subprocess call
- [ ] No secrets or tokens in code or test fixtures
- [ ] TASK_LIST.md updated to mark completed tasks
- [ ] This PR targets the correct base branch (main or dependency branch)
```

---

## 5. Merge Order Reference

```
Phase 0:  phase-0-scaffold
Phase 1:  phase-1-mcp-server  (either order)
          phase-1-agent-executor
Phase 2:  phase-2-tool-run-agent   (any order within group)
          phase-2-tool-models
          phase-2-tool-health
          phase-2-cli-validation
          phase-2-tool-sessions    (after cli-validation, if gate passes)
Phase 3:  phase-3-resources   (either order)
          phase-3-prompts
Phase 4:  phase-4-security    (either order)
          phase-4-streaming
```

---

## 6. What to Do When a Merge Conflict Occurs

1. Rebase your branch onto the latest `main`: `git rebase main`.
2. Resolve conflicts by following ARCHITECTURE.md — the architecture doc is the source of truth, not your branch.
3. Run full gate checklist after resolving.
4. Never force-push to `main`. Only force-push to your own feature branch if rebasing.
5. If the conflict is in `src/server.ts` (tool registration): keep all registrations, yours and the incoming branch's.

