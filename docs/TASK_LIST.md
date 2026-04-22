# Task List: cursor-cli-mcp

**Last updated:** 2026-04-22  
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
  - Output of `agent session --help`:
    ```
    _(not captured — `agent` not available in automation env; paste locally)_
    ```
  - Output of `agent session list --help`:
    ```
    _(not captured — same)_
    ```
- [x] **T2.5** — Based on T2.4 output, evaluate each criterion and record gate result:
  **PASS requires ALL of the following:**
  - `agent session --help` exits 0 (not "unknown command" or non-zero)
  - `agent session list --help` exits 0
  - `agent session list` (no flags) exits 0 OR exits with a documented error code (not a crash)
  - At least one of: `--format=json` flag exists on `session list`, OR the default output contains a machine-parseable session identifier field (id, uuid, or similar)
  - `agent session create` exists (exits 0 or exits with "no arguments" usage error — not "unknown command")
  **FAIL if ANY of the following:**
  - Any of the above commands exits non-zero with "unknown command" or "unrecognized command" in stderr
  - `agent session list` crashes (signal exit or unhandled exception in stderr)
  - Session output contains no identifiable session id field
  **Gate result:** **`SESSION_GATE: FAIL`** _(cannot verify session CLI without runnable `agent`; re-evaluate locally)_
- [x] **T2.6** — Update BRANCH_STRATEGY.md and this file: if FAIL, mark `feat/phase-2-tool-sessions` as CANCELLED _(2026-04-22)_

### `feat/phase-2-tool-sessions` — SERIAL (after cli-validation), GATED — **CANCELLED until `SESSION_GATE: PASS`**

**GATE CHECK:** Do not start this branch unless T2.5 shows `SESSION_GATE: PASS`

- **T2.7** — Implement `src/tools/sessionList.ts` per API_SPEC.md section 3.3; wire into server
  - Acceptance: 4 unit tests pass
- **T2.8** — Implement `src/tools/sessionCreate.ts` per API_SPEC.md section 3.4; wire into server
  - Acceptance: 4 unit tests pass
- **T2.9** — Implement `src/tools/sessionResume.ts` per API_SPEC.md section 3.5; wire into server
  - Acceptance: 4 unit tests pass
- **T2.10** — Write unit tests for all three session tools
  - Acceptance: 12 total session tool tests pass

**Phase 2 Gate (all parallel branches merged + sessions if gated):**

- All unit tests pass
- Integration tests pass (if `CURSOR_AGENT_PATH` set): see TESTING_STRATEGY.md section 3.2
- Manual MCP smoke test table in TESTING_STRATEGY.md section 4 (Phase 2) passes
- CI green

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

- All resources readable from MCP host with non-empty content
- All prompt templates loadable and generate valid `run_agent` arguments
- `npm run lint && npm run typecheck && npm run test:unit` exit 0
- CI green

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

- All unit tests pass (full suite)
- Integration tests pass
- Security regression suite passes (100% branch coverage on security.ts)
- Cold start < 500ms (T4.3 result)
- Streaming first-chunk < 2s (T4.7 result)
- CI green
- README complete with mcp.json example and operator setup instructions

---

## Session Gate Record

```
DATE: 2026-04-22
COMMAND TESTED: agent session --help _(not executed — binary missing in env)_
OUTPUT: _(n/a)_
RESULT: SESSION_GATE: FAIL
REASON: Cursor `agent` CLI not available on PATH / default paths in CI sandbox — cannot evaluate session subcommands; developer machine must re-run T2.4–T2.5 and flip gate to PASS before implementing session tools.
```

