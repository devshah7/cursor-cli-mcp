# Testing Strategy: cursor-cli-mcp

**Last updated:** 2026-04-21  
**Status:** Authoritative — agents must write tests in the patterns described here.

---

## 1. Test Layers

| Layer | Location | Requires agent binary | Runs in CI |
|-------|----------|-----------------------|------------|
| Unit | `tests/unit/` | No — uses mock executor | Always |
| Integration | `tests/integration/` | Yes | Only if `CURSOR_AGENT_PATH` secret set |
| Smoke (manual) | Documented below | Yes + MCP host | Per-phase gate |

---

## 2. Unit Test Patterns

### 2.1 Mock Executor

All tool handler unit tests use `tests/fixtures/mockExecutor.ts`:

```typescript
// mockExecutor.ts
export function createMockExecutor(overrides?: Partial<ExecutorResult>): AgentExecutor {
  return {
    run: vi.fn().mockResolvedValue({
      stdout: "mock output",
      stderrExcerpt: "",
      exitCode: 0,
      timedOut: false,
      outputTruncated: false,
      durationMs: 100,
      ...overrides,
    }),
  } as unknown as AgentExecutor;
}
```

### 2.2 Tool Handler Test Structure

Every tool test file MUST cover:

1. **Happy path** — valid input, mock executor returns exitCode 0.
2. **Validation failure** — invalid Zod input returns `VALIDATION` error, executor never called.
3. **Security failure** — path not in allowlist returns `SECURITY` error, executor never called.
4. **Executor error** — executor returns exitCode 1, tool returns `AGENT_ERROR`.
5. **Timeout** — executor returns `timedOut: true`, tool returns `TIMEOUT` error.
6. **Binary not found** — executor throws ENOENT-style error, tool returns `BINARY_NOT_FOUND`.

### 2.3 RingBuffer Unit Tests

```
ringBuffer.test.ts must cover:
- append within capacity → toString returns full content
- append beyond capacity → oldest bytes dropped, truncated=true
- multiple appends within capacity → content concatenated correctly
- empty buffer → toString returns ""
- capacity=0 edge case → all appends truncated immediately
- large single chunk → partial content retained up to capacity
- UTF-8 boundary: append buffer ending mid-multibyte sequence → toString returns valid UTF-8 (no replacement chars, no throw)
- two independent RingBuffer instances → appending to one does not affect the other (isolation)
```

### 2.4 Security Unit Tests

```
security.test.ts must cover:
- path exactly matching allowlist entry → passes
- path that is a subdirectory of allowlist entry → passes
- path with ../ traversal that resolves inside allowlist → passes
- path with ../ traversal that resolves outside allowlist → throws SECURITY
- path not related to any allowlist entry → throws SECURITY
- empty allowlist → all paths throw SECURITY
- allowlist with trailing slash → same behavior as without
- symlink resolution (if OS supports) → resolved path checked, not raw path
```

### 2.5 Config Unit Tests

```
config.test.ts must cover:
- all defaults applied when env vars absent
- each env var overrides its corresponding default
- invalid AGENT_TIMEOUT_MS (non-numeric) → throws on load
- invalid MAX_OUTPUT_BYTES (non-numeric) → throws on load
- WORKSPACE_ALLOWLIST parsing: semicolon-separated → string array
- empty WORKSPACE_ALLOWLIST → empty array (deny all)
```

---

## 3. Integration Test Patterns

### 3.1 Gate Condition

Integration tests are guarded:

```typescript
const AGENT_PATH = process.env.CURSOR_AGENT_PATH;
const describeIfAgent = AGENT_PATH ? describe : describe.skip;
```

### 3.2 Required Integration Tests (Phase 2 gate)

```
agentCli.test.ts must cover:
- agent_status: binary found, returns authenticated boolean
- list_models: returns non-empty array of strings
- run_agent: "print hello world" prompt → stdout contains "hello" (case-insensitive)
- run_agent: invalid workspace path → SECURITY error before subprocess
- run_agent: timeout scenario (set AGENT_TIMEOUT_MS=100) → TIMEOUT error
- run_agent: sandbox flag passes --sandbox to CLI (verify via agent echo)
```

---

## 4. Phase-by-Phase Test Gates

### Phase 0 — Scaffold Gate

**Benchmark:** All of the following must pass with zero errors.

```bash
# Gate commands (must all exit 0):
npm run lint          # eslint src/ tests/
npm run typecheck     # tsc --noEmit
npm run build         # tsc -p tsconfig.build.json
npm run test:unit     # vitest run tests/unit/ (0 tests OK at this phase)
```

**Expected state:** No source files yet, but toolchain is wired and all config files valid.

**CI check:** `ci.yml` lint + typecheck jobs green.

---

### Phase 1 — Infrastructure Gate

**Benchmark:** All of the following must pass.

```bash
npm run lint
npm run typecheck
npm run build
npm run test:unit
```

**Unit test requirements at phase 1 gate:**

| Test file | Min passing tests |
|-----------|------------------|
| `tests/unit/executor.test.ts` | 8 |
| `tests/unit/ringBuffer.test.ts` | 6 |
| `tests/unit/security.test.ts` | 8 |
| `tests/unit/config.test.ts` | 5 |

**Manual smoke test:**

```bash
# Start the MCP server and send a raw initialize message:
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.0.1"}}}' \
  | node dist/index.js

# Expected: valid JSON-RPC initialize response within 500ms
# Benchmark: response time < 500ms (measure with `time`)
```

---

### Phase 2 — Tools Gate

**Benchmark:** All unit tests pass + integration tests pass if agent binary available.

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration  # skipped if CURSOR_AGENT_PATH unset
```

**Unit test requirements at phase 2 gate:**

| Test file | Min passing tests |
|-----------|------------------|
| `tests/unit/tools/runAgent.test.ts` | 6 |
| `tests/unit/tools/listModels.test.ts` | 4 |
| `tests/unit/tools/agentStatus.test.ts` | 4 |
| Session tests (if gated in) | 4 each |

**Integration test requirements (if agent available):**

| Test | Pass condition |
|------|---------------|
| `agent_status` call | Returns JSON with `binaryPath` field and `authenticated` boolean; `isError` is false even if auth fails |
| `agent_status` with no binary | Set `AGENT_BINARY_PATH=/nonexistent`; returns `isError: true` with `errorClass: BINARY_NOT_FOUND` |
| `list_models` call | Returns `models` array with >= 1 string entry |
| `run_agent` hello world | stdout contains any output, exitCode 0 |
| `run_agent` path security | `workspace: "/etc"` with empty allowlist returns `isError: true`, `errorClass: SECURITY` |
| `run_agent` timeout | `AGENT_TIMEOUT_MS=100` on a slow prompt returns `isError: true`, `errorClass: TIMEOUT` |
| **Concurrent calls** | Fire two `run_agent` requests simultaneously (Promise.all); both must complete with independent results, no shared stdout/stderr contamination, no deadlock |

**CLI validation gate (sessions):**

```bash
# Run this manually and record output:
agent session --help
agent session list --help

# If either command exits non-zero or returns "unknown command":
# → Cancel feat/phase-2-tool-sessions and feat/phase-2-tool-session-create/resume
# → Document in TASK_LIST.md as CANCELLED with reason
```

**Manual MCP smoke test (Phase 2):**

From Claude Desktop or Claude Code, call each registered tool and verify:

| Tool | Smoke test prompt | Pass condition |
|------|-----------------|----------------|
| `agent_status` | (no args) | Returns JSON with authenticated field |
| `list_models` | (no args) | Returns list of model strings |
| `run_agent` | `{ prompt: "echo hello" }` | stdout non-empty, exitCode 0 |

---

### Phase 3 — Resources & Prompts Gate

```bash
npm run lint
npm run typecheck
npm run test:unit
```

**Manual smoke test:**

From MCP host, verify resources are readable:
- `cursor-cli-mcp://resources/cli-permissions` → returns markdown content
- `cursor-cli-mcp://resources/rules-discovery` → returns markdown content

Verify prompt templates load:
- `plan-only` prompt → generates valid `run_agent` arguments
- `ask-only` prompt → generates valid `run_agent` arguments with `mode: ask`
- `worktree-isolation` prompt → generates valid `run_agent` arguments with `worktree` set

---

### Phase 4 — Security Hardening Gate

**Benchmark:** All previous gates + security-specific tests pass.

**New unit tests required:**

```
Security regression suite:
- Path traversal via workspace: "../../../../etc/passwd" → SECURITY error
- Path traversal via worktree: "../../../" → SECURITY error  
- Prompt injection via model arg: "foo; rm -rf /" → VALIDATION error (model is a string, not executed)
- Shell metacharacters in prompt: passed safely as spawn arg (no shell expansion)
- LOG_PROMPTS=false: prompt text NOT present in logger output
- LOG_PROMPTS=true: prompt text IS present in logger output at debug level only
```

**Performance benchmark:**

```bash
# Cold start benchmark (run 3 times, take median):
time (echo '{"jsonrpc":"2.0","id":1,"method":"initialize",...}' | node dist/index.js)
# Target: < 500ms
```

---

## 5. Test Naming Convention

```
describe("ToolName", () => {
  describe("happy path", () => {
    it("returns AgentRunResult on exitCode 0", ...)
  });
  describe("validation", () => {
    it("returns VALIDATION error when prompt is empty", ...)
    it("returns VALIDATION error when mode is invalid", ...)
  });
  describe("security", () => {
    it("returns SECURITY error when workspace not in allowlist", ...)
  });
  describe("executor errors", () => {
    it("returns AGENT_ERROR on non-zero exit", ...)
    it("returns TIMEOUT error when timedOut=true", ...)
    it("returns BINARY_NOT_FOUND when executor throws ENOENT", ...)
  });
});
```

---

## 6. Coverage Targets

| Target | Minimum |
|--------|---------|
| Line coverage (`src/`) | 80% |
| Branch coverage (`src/security.ts`) | 100% |
| Branch coverage (`src/errors.ts`) | 100% |
| Branch coverage (`src/executor/`) | 90% |

Run with: `vitest run --coverage tests/unit/`

---

## 7. What NOT to Test

- The `agent` binary's own behavior — that's Cursor's responsibility.
- MCP SDK internals — trust the SDK.
- File system operations in `security.ts` that rely on the OS — use real paths in tests, not mocks.
- Logging output format — too brittle; test that logging does NOT include prompts when `LOG_PROMPTS=false`.
