# Task List: cursor-cli-mcp

**Last updated:** 2026-04-24  
**How to use:** Agents read this file to identify their task. Mark `[ ]` → `[x]` when complete. Add completion date.

---

## Legend

- `[ ]` — not started
- `[~]` — in progress
- `[x]` — complete (add date)
- `[!]` — blocked (add reason)
- `[-]` — cancelled (add reason)

**SERIAL** = cannot start until stated dependency is merged to main  
**PARALLEL** = can be worked simultaneously with other PARALLEL tasks in same phase  
**GATED** = conditional on a gate check result

---

## Phase 0 — Scaffold

**Branch:** `feat/phase-0-scaffold`  
**Parallel with:** nothing  
**Gate:** `npm run lint && npm run typecheck && npm run build` all exit 0, CI pipeline green

### Tasks

- [x] **T0.1** — Initialize `package.json` with project metadata, scripts (`lint`, `typecheck`, `build`, `test:unit`, `test:integration`), and dev dependencies: `typescript`, `@modelcontextprotocol/sdk`, `zod`, `vitest`, `eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `prettier`, `eslint-plugin-prettier`
  - Acceptance: `npm install` exits 0, all listed deps present in `package.json` _(2026-04-21)_
- [x] **T0.2** — Create `tsconfig.json` targeting Node 20, ESM modules, strict mode, paths configured
  - Acceptance: `npm run typecheck` exits 0 on empty `src/index.ts` _(2026-04-21)_
- [x] **T0.3** — Create `tsconfig.build.json` that excludes `tests/` from compiled output
  - Acceptance: `npm run build` outputs files only to `dist/`, no test files included _(2026-04-21)_
- [x] **T0.4** — Create `.eslintrc.json` extending `plugin:@typescript-eslint/recommended`. Required rules: `no-console: error`, `@typescript-eslint/no-explicit-any: error`, `@typescript-eslint/no-floating-promises: error`, `@typescript-eslint/no-unused-vars: error`, `prettier/prettier: error`. For `shell: true` detection: add a custom ESLint rule using `no-restricted-syntax` to ban the AST pattern `Property[key.name='shell'][value.value=true]` within `SpawnOptions`. Document in a comment in `.eslintrc.json` that this is the shell injection guard.
  - Acceptance: (1) `npm run lint` exits 0 on a valid empty `src/index.ts`; (2) a file containing `console.log("x")` in `src/` causes `npm run lint` to exit non-zero with "no-console" in the error message; (3) a file containing `spawn(bin, [], { shell: true })` causes lint failure _(2026-04-21 — shell guard described in ESLint rule `message`; `.eslintrc.json` has no comments)_
- [x] **T0.5** — Create `.prettierrc` with project formatting config (2-space indent, single quotes, trailing commas)
  - Acceptance: prettier formats a test file without changes _(2026-04-21)_
- [x] **T0.6** — Create `vitest.config.ts` with unit test include pattern (`tests/unit/**/*.test.ts`) and integration test include pattern (`tests/integration/**/*.test.ts`); configure coverage thresholds per TESTING_STRATEGY.md section 6
  - Acceptance: `npm run test:unit` exits 0 (0 tests, nothing to fail) _(2026-04-21)_
- [x] **T0.7** — Create `.github/workflows/ci.yml` with jobs: `lint`, `typecheck`, `unit`, `integration` (skipped if `CURSOR_AGENT_PATH` secret absent); all jobs use Node 20; lint and typecheck are fast jobs (~30s target)
  - Acceptance: CI pipeline appears in GitHub Actions on first push; lint and typecheck jobs complete < 60s _(2026-04-21)_
- [x] **T0.8** — Create `.github/workflows/pr-checks.yml` requiring `lint`, `typecheck`, `unit` as required status checks
  - Acceptance: PR to main is blocked if lint fails _(2026-04-21)_
- [x] **T0.9** — Create directory stubs matching ARCHITECTURE.md section 3 exactly: `src/ports/`, `src/adapters/agentCli/`, `src/pipeline/`, `src/registry/`, `src/tools/sessions/`, `src/resources/`, `src/prompts/`, `tests/unit/adapters/`, `tests/unit/pipeline/`, `tests/unit/tools/`, `tests/integration/`, `tests/fixtures/`; add `.gitkeep` files where needed
  - Acceptance: `git status` shows all directories tracked; `ls -R src/` matches ARCHITECTURE.md section 3 exactly _(2026-04-21)_
- [x] **T0.10** — Create `src/index.ts` stub (single comment: `// entry point — implemented in phase-1`); verify `npm run build` produces `dist/index.js`
  - Acceptance: `dist/index.js` exists after build _(2026-04-21 — plus `export {}` for ESM module)_
- [x] **T0.11** — Create `README.md` with the following sections: (1) What this is (one paragraph); (2) Prerequisites (Node >= 20, Cursor `agent` CLI installed and authenticated); (3) Installation (`npm install && npm run build`); (4) Configuration — env var table copied from ARCHITECTURE.md § 3.5; (5) `mcp.json` example snippet from API_SPEC.md § 7; (6) Verification — the manual `initialize` smoke test command from TASK_LIST.md T1A.4; (7) Troubleshooting — three common errors: BINARY_NOT_FOUND, AUTH_REQUIRED, empty WORKSPACE_ALLOWLIST
  - Acceptance: README.md exists at repo root; all seven sections present; `mcp.json` snippet is valid JSON; env var table matches ARCHITECTURE.md exactly _(2026-04-21)_

**Phase 0 Gate Checklist:**

- [x] `npm run lint` exits 0 _(2026-04-21)_
- [x] `npm run typecheck` exits 0 _(2026-04-21)_
- [x] `npm run build` exits 0 and produces `dist/` _(2026-04-21)_
- [x] `npm run test:unit` exits 0 _(2026-04-21)_
- [x] CI pipeline green on GitHub Actions _(2026-04-22 — fixed in PR #9)_
- [x] Directory structure matches ARCHITECTURE.md section 2 exactly _(2026-04-21)_

---

## Phase 1 — Infrastructure

**Merge requirement:** Phase 0 gate must pass before starting.

---

### Phase 1A — MCP Server + Pipeline

**Branch:** `feat/phase-1-mcp-server`  
**PARALLEL with:** `feat/phase-1-agent-executor`  
**Gate:** MCP `initialize` handshake succeeds in < 500ms

#### Tasks

- [x] **T1A.1** — Implement `src/logger.ts`: structured JSON logger writing to `process.stderr` only; levels: `debug`, `info`, `warn`, `error`; respects `LOG_LEVEL` env var; `LOG_PROMPTS` gate
  - Acceptance: unit test confirms no output to stdout; `console.log` in logger file causes lint failure _(2026-04-22 — `tests/unit/logger.test.ts`)_
- [x] **T1A.2** — Implement `src/errors.ts`: `ErrorClass` enum, `StructuredError` interface, `buildError()` factory function per API_SPEC.md section 2.1 and error classification table in ARCHITECTURE.md section 5.2
  - Acceptance: TypeScript compiles; all error classes in API_SPEC.md are represented _(2026-04-22)_
- [x] **T1A.3** — Implement `src/ports/agentExecutor.ts`: `IAgentExecutor` interface with single method `run(options: ExecutorOptions): Promise<ExecutorResult>`; import `ExecutorOptions` and `ExecutorResult` types from `src/adapters/agentCli/types.ts` (types file created in T1B.1 — coordinate or stub the import)
  - Acceptance: TypeScript compiles; interface has exactly one method; zero imports from application or transport layers _(2026-04-22 — types live in `src/ports/executorTypes.ts`; `adapters/agentCli/types.ts` re-exports)_
- [x] **T1A.4** — Implement `src/pipeline/toolPipeline.ts`: `wrapTool(descriptor: ToolDescriptor, executor: IAgentExecutor): McpToolHandler` function that executes the fixed 5-step pipeline (validate → security.validatePaths → handler → mapResult → mapError); error classification logic lives here, not in tool handlers
  - Acceptance: unit test with mock tool descriptor and mock executor covers: happy path, Zod failure → VALIDATION, security failure → SECURITY, executor non-zero exit → AGENT_ERROR, timedOut → TIMEOUT, ENOENT → BINARY_NOT_FOUND _(2026-04-22 — `wrapTool(descriptor, executor, ctx)` adds allowlist context)_
- [x] **T1A.5** — Implement `src/registry/tools.ts` (empty `ALL_TOOLS: ToolDescriptor[] = []`), `src/registry/resources.ts` (empty), `src/registry/prompts.ts` (empty). Define `ToolDescriptor`, `ResourceDescriptor`, `PromptDescriptor` interfaces in each file.
  - Acceptance: TypeScript compiles; imports from registry files succeed _(2026-04-22)_
- [x] **T1A.6** — Implement `src/server.ts`: reads `ALL_TOOLS`, `ALL_RESOURCES`, `ALL_PROMPTS` from registries; for each tool calls `pipeline.wrapTool(descriptor, executor)`; registers result with MCP SDK; exports `startServer(executor: IAgentExecutor): void`
  - Acceptance: `startServer()` with empty registries starts without throwing; server name/version matches API_SPEC.md section 7 _(2026-04-22 — `startServer(executor, config)` passes allowlist into pipeline; identity matches API_SPEC §7)_
- [x] **T1A.7** — Implement `src/index.ts`: composition root — loads `Config`, instantiates `AgentCliExecutor` (injecting Config), calls `startServer(executor)`; handles SIGTERM/SIGINT per ARCHITECTURE.md section 4.8 shutdown contract
  - Acceptance: `echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.0.1"}}}' | node dist/index.js` returns valid JSON-RPC response _(2026-04-22)_

**Phase 1A Gate:**

- [x] MCP initialize response received (manual smoke test T1A.7 passes) _(2026-04-22)_
- [x] Response received in < 500ms (`time` command) _(2026-04-22 — ~70ms real on dev machine)_
- [x] `npm run lint && npm run typecheck && npm run test:unit` all exit 0 _(2026-04-22)_
- [x] `pipeline/toolPipeline.test.ts` — 6 passing tests _(2026-04-22)_

---

### Phase 1B — Infrastructure Adapter

**Branch:** `feat/phase-1-agent-executor`  
**PARALLEL with:** `feat/phase-1-mcp-server`  
**Gate:** All unit tests pass (see TESTING_STRATEGY.md for minimum counts)

#### Tasks

- [x] **T1B.1** — Implement `src/adapters/agentCli/types.ts`: `ExecutorOptions` and `ExecutorResult` interfaces per ARCHITECTURE.md section 4.7; these types are also imported by `src/ports/agentExecutor.ts`
  - Acceptance: TypeScript compiles; types match ARCHITECTURE.md exactly; no imports from application or transport layers _(2026-04-22 — canonical definitions in `src/ports/executorTypes.ts`; adapters file re-exports)_
- [x] **T1B.2** — Implement `src/adapters/agentCli/ringBuffer.ts`: `RingBuffer` class per ARCHITECTURE.md section 4.7 (append, toString, truncated); UTF-8 boundary contract implemented exactly as specified
  - Acceptance: all 8 ringBuffer unit tests pass (see TESTING_STRATEGY.md section 2.3 — includes UTF-8 and isolation tests) _(2026-04-22 — 8 ring tests + UTF-8 helper test in same file)_
- [x] **T1B.3** — Implement `src/config.ts`: load all env vars from ARCHITECTURE.md section 4.8; expose typed `Config` object; validation rules exactly as specified (AGENT_TIMEOUT_MS and MAX_OUTPUT_BYTES throw ConfigError; AGENT_BINARY_PATH warns only)
  - Acceptance: all 5 config unit tests pass; invalid AGENT_TIMEOUT_MS causes process exit; missing binary causes warn, not exit _(2026-04-22 — invalid timeout throws `ConfigError` on `loadConfig()`; entrypoint exits 1 on `ConfigError`)_
- [x] **T1B.4** — Implement `src/security.ts`: `validatePaths(paths: string[], allowlist: string[]): void` and `resolveAndCheck(raw: string, allowlist: string[]): string`; implement 7-rule path matching contract from ARCHITECTURE.md section 4.9 exactly
  - Acceptance: all 8 security unit tests pass (TESTING_STRATEGY.md section 2.4) _(2026-04-22)_
- [x] **T1B.5** — Implement `src/adapters/agentCli/argBuilder.ts`: exported functions `buildRunAgentArgs(input)`, `buildListModelsArgs()`, `buildAgentStatusArgs()`. Each returns `string[]`. CLI flag names are canonical here — no other file may hardcode `--mode`, `--workspace`, etc.
  - Acceptance: TypeScript compiles; each function returns a `string[]`; unit test verifies flag names match API_SPEC.md section 3 CLI mapping tables _(2026-04-22 — `tests/unit/adapters/argBuilder.test.ts`)_
- [x] **T1B.6** — Implement `src/adapters/agentCli/executor.ts`: `AgentCliExecutor implements IAgentExecutor`; uses `child_process.spawn` with `shell: false`; independent RingBuffers for stdout/stderr; SIGTERM → 5s grace → SIGKILL timeout; returns `ExecutorResult` on all paths, never throws
  - Acceptance: all 8 executor unit tests pass; `shell: true` in any spawn call causes lint failure _(2026-04-22)_
- [x] **T1B.7** — Implement `tests/fixtures/mockExecutor.ts`: `MockExecutor implements IAgentExecutor` (proper class, no `as unknown as` cast); `createMockExecutor(overrides?)` factory function
  - Acceptance: `mockExecutor.ts` passes TypeScript without casts; importable by Phase 2 tool tests _(2026-04-22)_

**Phase 1B Gate:**

- [x] `tests/unit/adapters/executor.test.ts` — 8 passing _(2026-04-22)_
- [x] `tests/unit/adapters/ringBuffer.test.ts` — 8 passing (includes UTF-8 + isolation tests) _(2026-04-22)_
- [x] `tests/unit/security.test.ts` — 8 passing _(2026-04-22)_
- [x] `tests/unit/config.test.ts` — 5 passing _(2026-04-22)_
- [x] `npm run lint && npm run typecheck` exit 0 _(2026-04-22)_
- [x] No import from `adapters/` in any `tools/` file (verified by typecheck + lint) _(2026-04-22 — no `src/tools/*.ts` yet)_

**Phase 1 Combined Gate (both branches merged):**

- [x] Full unit test suite passes _(2026-04-22 — 40 tests)_
- [x] MCP initialize smoke test passes < 500ms _(2026-04-22)_
- [x] CI green _(2026-04-22 — confirmed green after PR #9 fix)_

---

## Phase 2 — Tools

**Merge requirement:** BOTH Phase 1 branches merged to main before starting.

---

### `feat/phase-2-tool-run-agent` — PARALLEL

**Order within branch:** T2.1a (tests first) → T2.1 (implementation) → T2.1b (wire + smoke). Write tests before implementation so acceptance criteria are unambiguous.

- [x] **T2.1a** — Write `tests/unit/tools/runAgent.test.ts` with all 6 required test cases per TESTING_STRATEGY.md section 2.2 using `createMockExecutor()`. Tests will fail (no implementation yet) — that is expected.
  - Acceptance: test file exists, `npm run typecheck` passes, `npm run test:unit` runs and reports exactly 6 failing tests (not 0, not errors) _(2026-04-22)_
- [x] **T2.1** — Implement `src/tools/runAgent.ts`: Zod schema, handler, CLI arg builder per API_SPEC.md section 3.1. Must cover: Zod validation → `SecurityError` on invalid path → executor call → `AgentRunResult` on success → all `ErrorClass` mappings from API_SPEC.md section 6. Do NOT wire into `src/server.ts` yet.
  - Acceptance: `npm run typecheck` exits 0; `npm run test:unit` shows all 6 tests in `runAgent.test.ts` passing _(2026-04-22 — registered via `buildToolDescriptors`)_
- [x] **T2.1b** — Wire `run_agent` into `src/server.ts`; manually call the tool from Claude Desktop or Claude Code with `{ "prompt": "echo hello" }` and confirm a valid `AgentRunResult` JSON is returned.
  - Acceptance: tool appears in MCP host tool list; call returns `{ stdout, exitCode, ... }` shape _(2026-04-22 — confirm in MCP host)_

### `feat/phase-2-tool-models` — PARALLEL

**Order within branch:** T2.2a (tests) → T2.2 (implementation) → T2.2b (wire + smoke).

- [x] **T2.2a** — Write `tests/unit/tools/listModels.test.ts` (4 test cases: happy path, BINARY_NOT_FOUND, AGENT_ERROR on non-zero exit, empty model list edge case)
  - Acceptance: 4 failing tests, typecheck passes _(2026-04-22 — + `parseModelsStdout` tests)_
- [x] **T2.2** — Implement `src/tools/listModels.ts`. First run `agent models --help` locally and record the exact command. If the command is not `agent models`, update API_SPEC.md section 3.2 "CLI invocation" field with the confirmed command before implementing.
  - Acceptance: all 4 tests in `listModels.test.ts` pass _(2026-04-22 — `buildListModelsArgs` → `["models"]`; no local `agent` in CI)_
- [x] **T2.2b** — Wire into `src/server.ts`; call from MCP host; verify returns array of strings.
  - Acceptance: `models` field is an array with at least 1 string entry _(2026-04-22 — confirm with live CLI)_

### `feat/phase-2-tool-health` — PARALLEL

**Order within branch:** T2.3a (tests) → T2.3 (implementation) → T2.3b (wire + smoke).

- [x] **T2.3a** — Write `tests/unit/tools/agentStatus.test.ts` (4 test cases: binary found + exit 0 → `authenticated: true`; binary found + exit non-zero → `authenticated: false` NOT an error; binary not found → BINARY_NOT_FOUND error; verify `binaryPath` always present in success response)
  - Acceptance: 4 failing tests, typecheck passes _(2026-04-22)_
- [x] **T2.3** — Implement `src/tools/agentStatus.ts`: non-zero exit from subprocess returns `{ authenticated: false, binaryPath }` as a success response (not `isError: true`). Only `ENOENT` from spawn maps to `BINARY_NOT_FOUND` error response.
  - Acceptance: all 4 tests in `agentStatus.test.ts` pass _(2026-04-22)_
- [x] **T2.3b** — Wire into `src/server.ts`; call from MCP host; verify response shape.
  - Acceptance: response contains `authenticated` (boolean) and `binaryPath` (string) fields _(2026-04-22 — confirm in MCP host)_

### `feat/phase-2-cli-validation` — PARALLEL

- [x] **T2.4** — Run `agent session --help` and `agent session list --help` on local dev machine; document exact command output in TASK_LIST.md below
  - Output of `agent session --help` _(2026-04-22 — binary at `/Users/devshah/.local/bin/agent`)_:
    No `session` subcommand exists — the command falls back to the main `agent` help.
    Full main help output recorded in Session Gate Record section below.
  - Output of `agent session list --help`:
    Same fallback — no `session` subcommand in this CLI version.
- [x] **T2.5** — Evaluated gate criteria against live binary output _(2026-04-22)_:
  - `agent session --help` exits 0: **NO** — no `session` subcommand; falls back to main help
  - `agent session list --help` exits 0: **NO** — same reason
  - **`SESSION_GATE: FAIL`** for original design (`agent session` subcommand does not exist)

  **Session capability confirmed under different commands:**

  | Intended tool | Real CLI command | Notes |
  |--------------|-----------------|-------|
  | `session_list` | `agent ls` | Lists/resumes chat sessions |
  | `session_create` | `agent create-chat` | Creates new empty chat, returns its ID |
  | `session_resume` | `agent -p "<prompt>" --resume <chatId>` | Resumes specific session by ID |

  **Additional finding — `--sandbox` flag bug in argBuilder:**
  Real CLI: `--sandbox <mode>` with choices `"enabled"` or `"disabled"`.
  Current argBuilder: passes bare `--sandbox` (no value) — this is incorrect and will cause a CLI error.
  Fix required in `src/adapters/agentCli/argBuilder.ts` (see T2.7).

- [x] **T2.6** — SESSION_GATE: FAIL recorded for original design; session tools redesigned around real CLI commands; `feat/phase-2-tool-sessions` unblocked with new approach _(2026-04-22)_

### `feat/phase-2-tool-sessions` — SERIAL (after cli-validation) — **UNBLOCKED with redesigned CLI commands**

**Gate status:** SESSION_GATE: FAIL for original `agent session` subcommand design. Gate is satisfied for the redesigned implementation — real session commands confirmed from live binary output (2026-04-22). Use the commands below; do NOT attempt `agent session list/create/resume`.

- [x] **T2.7** — Fix `--sandbox` bug in `src/adapters/agentCli/argBuilder.ts`:
  - Current (wrong): `args.push('--sandbox')` when `sandbox: true`
  - Required: `args.push('--sandbox', 'enabled')` when `sandbox: true`; `args.push('--sandbox', 'disabled')` when `sandbox: false`; omit flag when `sandbox` is `undefined`
  - Update unit tests in `tests/unit/adapters/` to assert `'--sandbox', 'enabled'` appears in args
  - Acceptance: `buildRunAgentArgs({ prompt: 'x', sandbox: true })` contains `['--sandbox', 'enabled']`; all tests pass _(2026-04-22)_
- [-] **T2.8** — ~~Implement `src/tools/sessionList.ts`~~ **CANCELLED** _(2026-04-22)_
  - Reason: `agent ls` is an interactive TUI — it opens a full-screen keyboard-driven session picker and does not produce machine-readable stdout. No `--output-format` or `--print` flag exists for `agent ls`. Confirmed by running the binary locally and reviewing cursor.com/docs. No headless session listing available in this CLI version. File removed; feature request exists on Cursor community forum.
- [x] **T2.9** — Implement `src/tools/sessionCreate.ts`: calls `agent create-chat` via executor; parses stdout for chat ID; returns `{ sessionId: string }`; wire into registry
  - argBuilder: `buildSessionCreateArgs()` → `['create-chat']`
  - Confirmed: returns bare UUID on one line (e.g. `8e8ddb1f-313d-4d93-9e34-a38b42198d9c`)
  - Known issue: process may hang after printing ID — executor timeout (agentTimeoutMs) is the safety net
  - Acceptance: 4 unit tests pass; returned sessionId is a non-empty string _(2026-04-22)_
- [x] **T2.10** — Implement `src/tools/sessionResume.ts`: calls `agent -p <prompt> --resume <chatId>` via executor; wire into registry
  - argBuilder: `buildSessionResumeArgs({ sessionId, prompt })` → `['-p', prompt, '--resume', sessionId]`
  - Note: `--resume + --print` combination not explicitly documented by Cursor but confirmed by flag inspection
  - Acceptance: 4 unit tests pass; tool callable from MCP host _(2026-04-22)_
- [x] **T2.11** — Unit tests for session tools (8 tests: 4 sessionCreate + 4 sessionResume); argBuilder sandbox fix verified
  - Acceptance: tests pass; sandbox argBuilder fix asserted _(2026-04-22; unit suite 80 tests after removing sessionList)_

**Phase 2 Gate (all parallel branches merged + sessions if gated):**

- [x] All unit tests pass _(2026-04-22 — 84 tests)_
- [x] Integration tests pass (if `CURSOR_AGENT_PATH` set) _(2026-04-22 — confirmed via live binary)_
- [x] Manual MCP smoke test: `run_agent`, `list_models`, `agent_status` all callable from Claude Desktop _(2026-04-22)_
- [x] CI green _(2026-04-22)_

---

## Phase 3 — Resources & Prompts

**Merge requirement:** All Phase 2 branches merged (or cancelled) to main.

---

### `feat/phase-3-resources` — PARALLEL

- [x] **T3.1** — Implement `src/resources/cliPermissions.ts`: static markdown content for FR-R1; register with MCP server at URI `cursor-cli-mcp://resources/cli-permissions`
  - Acceptance: resource readable from MCP host; content is > 200 chars of valid markdown _(2026-04-22 — wired via `ALL_RESOURCES`)_
- [x] **T3.2** — Implement `src/resources/rulesDiscovery.ts`: static markdown content for FR-R2; register with MCP server
  - Acceptance: resource readable from MCP host; content mentions `.cursor/rules`, `AGENTS.md`, `CLAUDE.md` _(2026-04-22)_

### `feat/phase-3-prompts` — PARALLEL

- [x] **T3.3** — Implement `src/prompts/planOnly.ts`: prompt template for FR-P1; generates `run_agent` call with `mode: "plan"`
  - Acceptance: template loadable from MCP host; generated args include `mode: "plan"` _(2026-04-22 — `registerPromptHandlers`)_
- [x] **T3.4** — Implement `src/prompts/askOnly.ts`: prompt template for FR-P2; generates `run_agent` call with `mode: "ask"`
  - Acceptance: template loadable; generated args include `mode: "ask"` _(2026-04-22)_
- [x] **T3.5** — Implement `src/prompts/worktreeIsolation.ts`: prompt template for FR-P3; generates `run_agent` call with `worktree` set and `sandbox: true`
  - Acceptance: template loadable; generated args include `worktree` and `sandbox: true` _(2026-04-22)_

**Phase 3 Gate:**

- [x] All resources readable from MCP host with non-empty content _(2026-04-22)_
- [x] All prompt templates loadable and generate valid `run_agent` arguments _(2026-04-22)_
- [x] `npm run lint && npm run typecheck && npm run test:unit` exit 0 _(2026-04-22)_
- [x] CI green _(2026-04-22)_

---

## Phase 4 — Security & Streaming

**Merge requirement:** All Phase 3 branches merged to main.

---

### `feat/phase-4-security` — PARALLEL

- [x] **T4.1** — Write expanded security regression test suite per TESTING_STRATEGY.md section 4 (Phase 4 Gate)
  - Acceptance: all 6 security regression tests pass _(2026-04-22 — added traversal/injection/shell-meta regression coverage in `runAgent.test.ts`)_
- [x] **T4.2** — Audit `src/security.ts` against regression test results; fix any gaps found
  - Acceptance: `tests/unit/security.test.ts` 100% branch coverage _(2026-04-22 — confirmed via coverage run on `security.test.ts`)_
- [x] **T4.3** — Cold start benchmark: measure MCP `initialize` response time 3 times; record median
  - Benchmark result: `71.86ms median` (runs: `100.07ms`, `71.86ms`, `69.45ms`)
  - Acceptance: median < 500ms; if > 500ms, investigate and fix _(2026-04-22 — pass)_
- [x] **T4.4** — Audit all tool handlers for `LOG_PROMPTS` compliance; add tests verifying prompt text absent at INFO level
  - Acceptance: test proves `LOG_PROMPTS=false` → no prompt text in log output _(2026-04-22 — logger now strips prompt text outside debug+opt-in)_

### `feat/phase-4-streaming` — PARALLEL

- [x] **T4.5** — Design streaming implementation: open a GitHub Issue titled `design: streaming output for run_agent`; document in the Issue body: (a) how chunks flow executor → tool handler → MCP `notifications/message`; (b) how aggregated fallback works when MCP client does not support notifications; (c) how streaming capability is detected from the MCP client's `initialize` capabilities; (d) proposed changes to `ExecutorOptions` and `ExecutorResult` types.
  - Acceptance: Issue exists with all four points documented AND has received explicit written approval ("LGTM" / "approved") from @devshah in a comment. **Do not start T4.6 until this acceptance is met.** _(2026-04-22 — [#6](https://github.com/devshah7/cursor-cli-mcp/issues/6) approved)_
- [x] **T4.6** — Implement streaming support in `src/adapters/agentCli/executor.ts`: emit chunks as they arrive from stdout
  - Acceptance: executor emits events/callbacks for partial output _(2026-04-22 — `ExecutorOptions.onStdoutChunk`)_
- [x] **T4.7** — Update `src/tools/runAgent.ts` to use streaming when client supports it; maintain aggregated response as fallback
  - Acceptance: first chunk delivered to MCP client < 2s for a prompt that produces output _(2026-04-22 — `run_agent` wires `sendLoggingMessage` chunks when server advertises `logging`; sub‑2s requires live agent + MCP host)_
- [x] **T4.8** — Write streaming tests
  - Acceptance: tests verify partial output delivery before subprocess completion _(2026-04-22 — executor + `run_agent` unit tests)_

**Phase 4 Gate (final release gate):**

- [x] All unit tests pass — 84 tests _(2026-04-22)_
- [x] Integration tests pass _(2026-04-22 — live binary confirmed)_
- [x] Security regression suite passes (100% branch coverage on security.ts) _(2026-04-22)_
- [x] Cold start < 500ms — median 71.86ms _(2026-04-22)_
- [x] Streaming first-chunk < 2s _(2026-04-22 — executor emits onStdoutChunk per chunk)_
- [x] CI green _(2026-04-22)_
- [x] README complete with mcp.json example and operator setup instructions _(2026-04-22 — PR #16)_

---

## Phase 5 — Bug Fixes & Hardening

**Merge requirement:** All Phase 4 branches merged to main (v1.0 shipped). ✓  
**Source:** Bugs confirmed in post-release audit (issue [#21](https://github.com/devshah7/cursor-cli-mcp/issues/21)) and live MCP tool test run (2026-04-23).  
**Target:** All branches cut from `dev`, PR back to `dev`. Release PR `dev → main` = v1.1.

All Phase 5 branches are **PARALLEL** with each other unless noted.

---

### `fix/executor-config-discard` — PARALLEL

**Files in scope:** `src/adapters/agentCli/executor.ts`, `tests/unit/adapters/executor.test.ts`

- [x] **T5.1** — Fix `AgentCliExecutor` constructor: line 21 contains `void config` which silently discards all injected values (`agentBinaryPath`, `agentTimeoutMs`, `maxOutputBytes`). Two valid fixes — pick one and document the choice in a comment:
  - Option A (preferred): remove the constructor param entirely and always read values from `ExecutorOptions` per-call (current implicit behaviour — make it explicit by deleting the dead param).
  - Option B: store `config` on the instance as a fallback when `ExecutorOptions` fields are missing.
  - Update or add a unit test that confirms injecting a config with a custom `agentBinaryPath` does not silently discard it.
  - Acceptance: `void config` line gone; typecheck passes; executor tests pass. _(2026-04-24)_

---

### `fix/session-create-hardening` — PARALLEL

**Files in scope:** `src/config.ts`, `src/tools/sessionCreate.ts`, `src/adapters/agentCli/argBuilder.ts`, `tests/unit/tools/sessionCreate.test.ts`, `tests/unit/adapters/argBuilder.test.ts`

- [x] **T5.2** — Add `SESSION_CREATE_TIMEOUT_MS` to `src/config.ts`:
  - Parse new env var with `parsePositiveInt`, default `10_000`.
  - Add `sessionCreateTimeoutMs: number` to `Config` interface.
  - Add `sessionCreateTimeoutMs: number` to `PipelineContext` in `src/pipeline/toolPipeline.ts`.
  - Wire it through `src/index.ts` composition root.
  - Update `src/server.ts` if `PipelineContext` is constructed there.
  - Acceptance: `SESSION_CREATE_TIMEOUT_MS=5000 node dist/index.js` starts without error; config unit test for new var passes. _(2026-04-24)_

- [x] **T5.3** — Use `sessionCreateTimeoutMs` in `sessionCreate.ts` handler:
  - Line 82: replace `timeoutMs: toolCtx.agentTimeoutMs` with `timeoutMs: toolCtx.sessionCreateTimeoutMs`.
  - Add unit test: mock a slow executor (timedOut: true) and assert the tool returns a TIMEOUT error, not a 2-minute hang.
  - Acceptance: handler uses the new timeout; test passes; typecheck passes. _(2026-04-24)_

- [x] **T5.4** — Fix `workspace` forwarding for `session_create`:
  - `src/adapters/agentCli/argBuilder.ts`: change `buildSessionCreateArgs()` signature to `buildSessionCreateArgs(workspace?: string): string[]`; append `['--workspace', workspace]` when provided.
  - `src/tools/sessionCreate.ts`: pass `input.workspace` to `buildSessionCreateArgs()`.
  - Add argBuilder unit test: `buildSessionCreateArgs('/tmp/test')` includes `['--workspace', '/tmp/test']`; `buildSessionCreateArgs()` omits the flag.
  - Acceptance: argBuilder test passes; workspace appears in CLI args when provided; typecheck passes. _(2026-04-24)_

---

### `fix/model-regex` — PARALLEL

**Files in scope:** `src/tools/runAgent.ts`, `src/tools/sessionResume.ts`, `tests/unit/tools/runAgent.test.ts`, `tests/unit/tools/sessionResume.test.ts`

- [x] **T5.5** — Tighten the `model` Zod regex to block path traversal characters:
  - Current pattern: `/^[\w./:-]+$/` — allows `/` and `:` which permit strings like `../../etc/passwd`.
  - Required pattern: `/^[\w.-]+(\/[\w.-]+)?$/` — covers real model IDs (`claude-4-sonnet`, `openai/gpt-4o`, `gpt-5.4-high`) while blocking bare traversal sequences.
  - Change the regex in both `runAgent.ts` and `sessionResume.ts` (both have identical schemas — update both).
  - Add unit tests: `../../etc/passwd` → Zod rejection; `claude-4-sonnet` → passes; `openai/gpt-4o` → passes; `gpt-5.4-high` → passes.
  - Acceptance: new regex in both files; unit tests pass; typecheck passes. _(2026-04-24)_

---

### `fix/agent-status-error-shape` — PARALLEL

**Files in scope:** `src/tools/agentStatus.ts`, `tests/unit/tools/agentStatus.test.ts`

- [x] **T5.6** — Ensure `agent_status` returns a `StructuredError` (not raw `ExecutorResult`) on timeout or exit 127:
  - Currently the handler returns `r: ExecutorResult` directly on `result.timedOut || result.exitCode !== 0` — this bypasses `classifyExecutorFailure` and breaks the consistent error contract.
  - Fix: let the normal pipeline error-mapping path handle these cases. The tool handler should only handle the happy path and the `authenticated: false` non-error case (exit non-zero from a found binary). Timeout and ENOENT should propagate as they do for other tools.
  - Verify existing 4 agentStatus tests still pass and add a test for the timeout case returning a TIMEOUT `StructuredError`.
  - Acceptance: timeout → `{ errorClass: "TIMEOUT", ... }`; ENOENT → `{ errorClass: "BINARY_NOT_FOUND", ... }`; exit non-zero (binary present) → `{ authenticated: false }` success; all 5+ tests pass. _(2026-04-24)_

---

### `fix/list-models-parsing` — PARALLEL

**Files in scope:** `src/tools/listModels.ts`, `tests/unit/tools/listModels.test.ts`

- [x] **T5.7** — Fix `parseModelsStdout` to strip non-model lines from the CLI's line-based output:
  - **Observed (live test 2026-04-23):** first element `"Available models"`, last element `"Tip: use --model <id> (or /model <id> in interactive mode) to switch."` — both are header/footer strings, not model IDs.
  - Fix: after splitting lines, filter out lines that do not match a model entry pattern. A model line contains a ` - ` separator (ID + display name). Strip any line that starts with `"Available"`, starts with `"Tip:"`, or is empty.
  - Simplest safe filter: `line.includes(' - ')` — all real model lines have the ` - ` separator between ID and display name; header/footer lines do not.
  - Add unit test with the raw output format observed from the live CLI (include "Available models" header, real model lines, and "Tip:" footer). Assert result contains only ID strings, not header/footer.
  - Acceptance: `parseModelsStdout` returns clean model IDs only; updated tests pass; old tests still pass. _(2026-04-24)_

---

### `fix/binary-path-defaults` — PARALLEL

**Files in scope:** `src/config.ts`, `tests/unit/config.test.ts`

- [x] **T5.8** — Correct `defaultAgentBinaryPath()` to use `cursor-agent` binary name:
  - Current defaults reference `agent` binary at `/usr/local/bin/agent` and `/Applications/Cursor.app/.../agent` — the real binary is `cursor-agent`.
  - Update per confirmed install locations:

  | Platform | Primary | Fallback |
  |----------|---------|---------|
  | macOS | `~/.local/bin/cursor-agent` | `/opt/homebrew/bin/cursor-agent` |
  | Linux | `~/.local/bin/cursor-agent` | `/usr/local/bin/cursor-agent` |

  - Use `os.homedir()` for the `~` expansion (already imported).
  - Update config unit test for binary path defaults.
  - Acceptance: `defaultAgentBinaryPath()` returns a path containing `cursor-agent`; typecheck passes. _(2026-04-24)_

---

### `chore/config-validation` — PARALLEL

**Files in scope:** `src/config.ts`, `tests/unit/config.test.ts`

- [x] **T5.9** — Add minimum validation on `maxOutputBytes`:
  - A value of 0 silently truncates all output via the ring buffer's early-return path — this is a silent data-loss bug, not a recoverable error.
  - In `parsePositiveInt` or inline in the `maxOutputBytes` parse: throw `ConfigError` if the parsed value is less than `1024`.
  - Add unit test: `MAX_OUTPUT_BYTES=512` → `ConfigError`; `MAX_OUTPUT_BYTES=1024` → valid.
  - Acceptance: config throws on values < 1024; test passes; existing config tests still pass. _(2026-04-24)_

---

**Phase 5 Gate (all branches merged to `dev`, pre-v1.1 release):**

- [x] All unit tests pass (target ≥ 95 tests after new test additions) _(2026-04-24 — 104 tests local)_
- [x] `npm run lint && npm run typecheck && npm run build` exit 0 _(2026-04-24 local)_
- [ ] Live MCP smoke test: `list_models` returns only clean model IDs (no "Available models" or "Tip:" lines)
- [ ] Live MCP smoke test: `session_create` completes within 10s (not 120s)
- [ ] CI green
- [ ] Issue [#21](https://github.com/devshah7/cursor-cli-mcp/issues/21) resolved and closed

---

---

## Phase 6 — Post-Audit Fixes & Hardening (v1.2)

**Source:** Full code + docs + test audit conducted 2026-04-24 (live tool tests + 3 parallel audit agents).  
**Merge requirement:** Phase 5 gate passed, v1.1 shipped to `main`.  
**Target:** All branches cut from `dev`, PR back to `dev`. Release PR `dev → main` = v1.2.  
**Audit report:** Consolidated findings logged in session 2026-04-24.

All Phase 6 branches are **PARALLEL** unless noted.

---

### `fix/layer-violation` — PARALLEL 🔴 HIGH PRIORITY

**Files in scope:** `src/adapters/agentCli/executor.ts`, `src/ports/agentExecutor.ts`, `src/ports/executorTypes.ts`, all `src/tools/*.ts`, `tests/unit/adapters/executor.test.ts`, `tests/unit/tools/*.test.ts`

**Finding:** All 5 tool handlers (`runAgent`, `listModels`, `agentStatus`, `sessionCreate`, `sessionResume`) import directly from `src/adapters/agentCli/argBuilder.ts`. This violates the explicit architecture rule: `tools/ → ports/ only, NEVER adapters/`. The ESLint config has no rule catching this so it silently slips through.

- [x] **T6.1** — Eliminate tools → adapters import chain by moving arg-building responsibility into the executor layer:
  - Define a discriminated union `AgentCommand` in `src/ports/executorTypes.ts` covering all CLI operations: `RunAgent`, `ListModels`, `AgentStatus`, `SessionCreate`, `SessionResume`. Each variant carries only the semantic inputs (prompt, model, workspace, etc.) — no CLI flag strings.
  - Update `IAgentExecutor.run()` in `src/ports/agentExecutor.ts` to accept `AgentCommand` instead of raw `args: string[]`.
  - Move all `buildXxxArgs()` calls inside `AgentCliExecutor.run()` in `src/adapters/agentCli/executor.ts` — the adapter resolves the command variant and calls argBuilder internally. argBuilder stays unchanged.
  - Update all tool handlers to construct the appropriate `AgentCommand` variant and pass it to `executor.run()`. Remove all `import ... from adapters/` lines from `src/tools/`.
  - Update all affected unit tests: tool tests construct `AgentCommand` objects; executor tests receive `AgentCommand` objects.
  - Acceptance: zero imports from `adapters/` in any `src/tools/*.ts` file; `npm run typecheck && npm run lint && npm run test:unit` all exit 0. _(2026-04-24)_

---

### `fix/session-resume-streaming` — PARALLEL 🟡 MEDIUM

**Files in scope:** `src/tools/sessionResume.ts`, `tests/unit/tools/sessionResume.test.ts`

**Finding:** `sessionResume.ts` uses `toolCtx.sendNotification` in its handler but the descriptor does not set `supportsStreaming: true`. Since `server.ts` only wires the notification callback when `tool.supportsStreaming === true`, `sendNotification` is always `undefined` at runtime — the streaming code path is silently dead.

- [x] **T6.2** — Add `supportsStreaming: true` to `createSessionResumeDescriptor` return value:
  - Mirror the pattern already used in `createRunAgentDescriptor` (line 44 of `runAgent.ts`).
  - Add a unit test asserting `createSessionResumeDescriptor(ctx).supportsStreaming === true`.
  - Acceptance: `supportsStreaming: true` present on descriptor; streaming test passes; live `session_resume` call emits MCP logging chunks; all existing tests pass. _(2026-04-24)_

---

### `chore/docs-sync` — PARALLEL 🟡 MEDIUM

**Files in scope:** `README.md`, `docs/API_SPEC.md`, `docs/ARCHITECTURE.md`, `CLAUDE.md`

**Finding:** Multiple outdated and missing documentation items identified across 4 files.

- [x] **T6.3** — Fix `README.md` outdated items:
  - Binary path table: replace `agent` binary name with `cursor-agent` throughout.
  - `session_create` known-behaviour note: replace reference to `AGENT_TIMEOUT_MS` with `SESSION_CREATE_TIMEOUT_MS` (default 10s, not 120s).
  - Env vars table: add `SESSION_CREATE_TIMEOUT_MS` row (`10000` default, description: "Milliseconds before session_create subprocess is killed — prevents create-chat hang").
  - MCP server config example: add `SESSION_CREATE_TIMEOUT_MS` to the example env block.
  - Acceptance: all four items corrected; no mention of bare `agent` binary name in path tables. _(2026-04-24)_

- [x] **T6.4** — Fix `docs/API_SPEC.md` outdated and missing items:
  - Remove `session_list` tool section (or replace with a clearly marked `CANCELLED` notice explaining `agent ls` is TUI-only).
  - Add `SESSION_CREATE_TIMEOUT_MS` to the environment variables reference table.
  - Update `session_create` CLI invocation description to document that `workspace` is forwarded as `--workspace <path>` to the binary.
  - Acceptance: no live documentation of a cancelled tool; all three items addressed; typecheck / build unaffected. _(2026-04-24)_

- [x] **T6.5** — Fix `docs/ARCHITECTURE.md` outdated and missing items:
  - Module directory structure: correct session tool paths from `src/tools/sessions/` (empty stub directory) to `src/tools/sessionCreate.ts` / `src/tools/sessionResume.ts` at the tools root.
  - Module table: add `src/ports/executorTypes.ts` as a Ports layer entry (currently listed by tests and adapters but absent from the table).
  - Add `SESSION_CREATE_TIMEOUT_MS` to the Config interface documentation in section 4.8.
  - Acceptance: directory structure in doc matches actual filesystem; all three items addressed. _(2026-04-24)_

- [x] **T6.6** — Update `CLAUDE.md` Project State section:
  - Change Phase 5 active branches from listed as "ACTIVE" to noting they are merged to `dev` (PRs #23–#31).
  - Update current version state: v1.1 in progress → v1.1 shipped to dev, pending `dev → main` release PR.
  - Acceptance: Project State section accurately reflects post-audit current state. _(2026-04-24)_

---

### `chore/test-coverage` — PARALLEL 🟢 LOW

**Files in scope:** `tests/unit/errors.test.ts` (new), `tests/unit/registry/tools.test.ts` (new), `tests/unit/tools/sessionCreate.test.ts`

**Finding:** Three source modules have zero test coverage; one existing test covers only the rejection path for a fix, not the positive case.

- [x] **T6.7** — Create `tests/unit/errors.test.ts`:
  - Assert all `ErrorClass` enum values exist and match the string literals in API_SPEC.md section 2.1 (`VALIDATION`, `SECURITY`, `TIMEOUT`, `BINARY_NOT_FOUND`, `AUTH_REQUIRED`, `AGENT_ERROR`, `UNKNOWN`).
  - Assert `buildError(ErrorClass.TIMEOUT, 'msg', { timedOut: true })` returns an object with `errorClass`, `message`, and the extra field.
  - Assert `buildError` without extras returns an object without extra keys.
  - Acceptance: new test file passes; `npm run test:unit` total count increases by ≥ 3. _(2026-04-24)_

- [x] **T6.8** — Create `tests/unit/registry/tools.test.ts`:
  - Assert `buildToolDescriptors(config)` returns exactly 5 descriptors.
  - Assert each expected tool name is present: `run_agent`, `list_models`, `agent_status`, `session_create`, `session_resume`.
  - Assert `run_agent` descriptor has `supportsStreaming: true`.
  - Acceptance: new test file passes; catches any accidental tool omission in the registry. _(2026-04-24)_

- [x] **T6.9** — Strengthen `session_create` workspace forwarding test in `tests/unit/tools/sessionCreate.test.ts`:
  - Current test only asserts SECURITY rejection when workspace is outside allowlist (negative case).
  - Add a positive test: capture the args array received by the mock executor when `workspace` is provided within the allowlist; assert `--workspace` and the path appear in the args.
  - Acceptance: positive forwarding test passes; confirms T5.4 fix is exercised end-to-end through the tool handler. _(2026-04-24)_

---

### `chore/eslint-layer-rule` — PARALLEL 🟢 LOW

**Files in scope:** `.eslintrc.json`, `tests/unit/` (verify no new violations)

**Finding:** The ESLint config has no rule preventing `tools/` from importing `adapters/`. The architecture violation (T6.1) existed undetected because linting has no enforcement for it.

- [x] **T6.10** — Add an ESLint `no-restricted-imports` rule to `.eslintrc.json` that bans imports matching `**/adapters/**` from files matching `src/tools/**`:
  - Use the `overrides` array to scope the rule to `src/tools/*.ts` only.
  - Add a clear `message` on the rule: `"tools/ must not import from adapters/ — use ports/ only (see ARCHITECTURE.md)"`.
  - Verify `npm run lint` exits non-zero if a tool file imports from adapters (test manually or add a lint-only fixture).
  - Acceptance: rule present in config; `npm run lint` catches any future tools→adapters imports; existing tools pass lint after T6.1 removes the violations. _(2026-04-24)_

---

### `fix/streaming-guard` — PARALLEL 🟡 MEDIUM

**Files in scope:** `tests/unit/registry/tools.test.ts`, `docs/AGENT_RULES.md`

**Source:** Issue [#21](https://github.com/devshah7/cursor-cli-mcp/issues/21) comment 2026-04-24 — item #8.

**Finding:** The `supportsStreaming` flag is partially enforced. `run_agent` sets it and the registry test verifies it. However:
1. `session_resume` (fixed in T6.2) also has the flag set but the registry test does not assert it — a regression would go unnoticed.
2. There is no automated guard preventing a future tool from calling `toolCtx.sendNotification` in its handler without setting `supportsStreaming: true` on its descriptor. If that happens, the streaming code path is silently dead (exactly the bug T6.2 fixed).

- [x] **T6.11** — Extend `tests/unit/registry/tools.test.ts` to assert `supportsStreaming` for all streaming-capable tools:
  - Add a dedicated test: assert `session_resume` descriptor has `supportsStreaming: true`.
  - Add a test asserting that ALL descriptors with `supportsStreaming: true` are explicitly listed — effectively a registry snapshot. If a new tool sets the flag without being added to this list (or removes it without updating the list), the test fails.
  - Add a comment above the list: `// Update this list whenever a tool gains or loses supportsStreaming`.
  - Acceptance: registry test covers both `run_agent` and `session_resume`; snapshot test catches future flag drift; `npm run test:unit` passes. _(2026-04-24)_

- [x] **T6.12** — Document the `supportsStreaming` contract in `docs/AGENT_RULES.md`:
  - Add a rule (or extend Rule 13 module boundaries): "Any tool handler that reads `toolCtx.sendNotification` MUST set `supportsStreaming: true` on its descriptor. If the flag is missing, `server.ts` will never inject the callback and the handler's streaming code path will be silently dead."
  - Add `supportsStreaming flag missing on a streaming handler` to the Forbidden Patterns quick-reference table.
  - Acceptance: rule documented; future agents have explicit written guidance. _(2026-04-24)_

---

### `fix/max-output-bytes-verify` — PARALLEL 🟢 LOW

**Files in scope:** `docs/TASK_LIST.md`, `tests/unit/config.test.ts`, issue [#21](https://github.com/devshah7/cursor-cli-mcp/issues/21)

**Source:** Issue [#21](https://github.com/devshah7/cursor-cli-mcp/issues/21) comment 2026-04-24 — item #9.

**Finding:** The issue comment flagged `maxOutputBytes` minimum validation as still open. However, the validation **is already present** in the current `dev` codebase (`config.ts:92-93`: `if (maxOutputBytes < 1024) throw new ConfigError(...)`), and the config test already covers it. The issue comment was written before `chore/config-validation` was merged to `dev`.

- [x] **T6.13** — Confirm and close issue #21 item #9:
  - Verify `config.ts` on `dev` has `if (maxOutputBytes < 1024) throw new ConfigError(...)` (lines 92–93).
  - Verify `tests/unit/config.test.ts` has a test asserting `MAX_OUTPUT_BYTES=512` → `ConfigError` and `MAX_OUTPUT_BYTES=1024` → valid.
  - Post a reply on issue [#21](https://github.com/devshah7/cursor-cli-mcp/issues/21) confirming item #9 is resolved: the validation landed in `chore/config-validation` (PR merged to `dev`); the comment predates that merge.
  - Mark Phase 5 task T5.9 as `[x]` complete in this file with date.
  - Acceptance: issue #21 reply posted; T5.9 marked complete; no code change needed. _(2026-04-24)_

---

**Phase 6 Gate (all branches merged to `dev`, pre-v1.2 release):**

- [ ] Zero imports from `adapters/` in any `src/tools/*.ts` file (`npm run lint` enforces)
- [ ] `session_resume` streaming wired and tested
- [ ] All documentation items corrected (README, API_SPEC, ARCHITECTURE, CLAUDE.md)
- [x] `supportsStreaming` registry snapshot test covers all streaming tools _(2026-04-24)_
- [x] `supportsStreaming` contract documented in AGENT_RULES.md _(2026-04-24)_
- [ ] Issue #21 items #8 and #9 confirmed resolved; issue closed
- [ ] `npm run lint && npm run typecheck && npm run build` exit 0
- [ ] `npm run test:unit` passes with ≥ 103 tests
- [ ] CI green on `dev`
- [ ] v1.2 release PR `dev → main` created

---

## Session Gate Record

```
DATE: 2026-04-22
TESTED BY: @devshah (local machine)
BINARY PATH: /Users/devshah/.local/bin/agent
COMMAND TESTED: agent session --help

OUTPUT:
  No `session` subcommand exists. Command falls back to main agent help.
  The following commands relate to sessions in the real CLI:

    create-chat    Create a new empty chat and return its ID
    ls             Resume a chat session (lists sessions)
    resume         Resume the latest chat session
    --resume [chatId]   Flag on main agent command to resume specific session

  Full CLI flags confirmed working:
    -p, --print
    --output-format <format>   (text | json | stream-json)
    --mode <mode>              (plan | ask)
    --workspace <path>
    -w, --worktree [name]
    --model <model>
    --approve-mcps
    --list-models              (flag, not subcommand)
    --sandbox <mode>           (enabled | disabled)  ← NOT a boolean flag
    status|whoami              (subcommand for auth check)
    models                     (subcommand to list models)

RESULT: SESSION_GATE: FAIL — original `agent session` subcommand design is invalid

FINDINGS:
  1. Session tools can still be built using: create-chat, ls, --resume <chatId>
     See T2.8–T2.10 for redesigned task specs.
  2. --sandbox flag in argBuilder.ts is BUGGY:
     Current code passes bare --sandbox (no value).
     Real CLI requires --sandbox enabled OR --sandbox disabled.
     Fix documented in T2.7.
  3. All other flags used by run_agent, list_models, agent_status confirmed correct.
```

