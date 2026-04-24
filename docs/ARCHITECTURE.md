# Architecture: cursor-cli-mcp

**Last updated:** 2026-04-21  
**Version:** 3.0 — layered clean architecture, SOLID-compliant  
**Status:** Authoritative — agents must not deviate without a PR to update this doc first.

---

## 1. Design Principles

This codebase is organized around four rules that prevent one change from rippling everywhere:

| Principle | How it applies here |
|-----------|-------------------|
| **Single Responsibility (SRP)** | Each module has exactly one reason to change. Tool handlers contain only business logic. The pipeline owns cross-cutting concerns. The adapter owns subprocess details. |
| **Open/Closed (OCP)** | Adding a new tool means adding one file + one registry line. `server.ts` never changes. |
| **Dependency Inversion (DIP)** | Application-layer tools depend on `IAgentExecutor` (interface in `ports/`), not the concrete `AgentCliExecutor`. The composition root (`index.ts`) wires the concrete implementation. |
| **Separation of Concerns** | CLI flag knowledge lives in one place (`adapters/agentCli/argBuilder.ts`). Validation/security/error-mapping live in the pipeline. Transport lives in `server.ts`. Business logic lives in `tools/`. |

---

## 2. Layer Model

```
╔══════════════════════════════════════════════════════════════════╗
║  LAYER 4 — TRANSPORT                                             ║
║  index.ts · server.ts                                            ║
║  Reads registries, wires MCP SDK to pipeline, handles stdio.     ║
║  Only layer that knows about MCP SDK types.                      ║
╠══════════════════════════════════════════════════════════════════╣
║  LAYER 3 — APPLICATION                                           ║
║  pipeline/ · registry/ · tools/ · resources/ · prompts/         ║
║  Orchestrates use cases. No OS, no subprocess, no SDK types.     ║
║  Depends on ports/ interfaces, never on adapters/ directly.      ║
╠══════════════════════════════════════════════════════════════════╣
║  LAYER 2 — PORTS (Dependency boundary)                           ║
║  ports/agentExecutor.ts                                          ║
║  Pure TypeScript interfaces. No implementation. No imports        ║
║  from any other layer. Arrows point inward — nothing above       ║
║  this line depends on anything below it.                         ║
╠══════════════════════════════════════════════════════════════════╣
║  LAYER 1 — INFRASTRUCTURE / ADAPTERS                             ║
║  adapters/agentCli/                                              ║
║  Implements ports. Knows about child_process, OS paths,          ║
║  ring buffers, CLI flag conventions. Replaceable without         ║
║  touching any code above Layer 2.                                ║
╠══════════════════════════════════════════════════════════════════╣
║  CROSS-CUTTING (all layers may import)                           ║
║  config.ts · security.ts · errors.ts · logger.ts                ║
║  Pure utilities with zero framework dependencies.                ║
╚══════════════════════════════════════════════════════════════════╝
```

**The dependency rule:** imports flow downward (Transport → Application → Ports → Infrastructure) or sideways into Cross-Cutting. No layer imports from a layer above it. `adapters/` does not import from `tools/`. `tools/` does not import from `adapters/`.

---

## 3. Repository Layout

```
cursor-cli-mcp/
├── src/
│   │
│   │   ── LAYER 4: TRANSPORT ──────────────────────────────────
│   ├── index.ts                    # Composition root — DI wiring only
│   ├── server.ts                   # MCP SDK adapter — reads registries, no business logic
│   │
│   │   ── LAYER 3: APPLICATION ─────────────────────────────────
│   ├── pipeline/
│   │   └── toolPipeline.ts         # validate → security → execute → map (one place)
│   ├── registry/
│   │   ├── tools.ts                # ALL_TOOLS: ToolDescriptor[] — server reads this
│   │   ├── resources.ts            # ALL_RESOURCES: ResourceDescriptor[]
│   │   └── prompts.ts              # ALL_PROMPTS: PromptDescriptor[]
│   ├── tools/
│   │   ├── runAgent.ts             # schema + pure handler logic only
│   │   ├── listModels.ts
│   │   ├── agentStatus.ts
│   │   ├── sessionCreate.ts
│   │   └── sessionResume.ts
│   ├── resources/
│   │   ├── cliPermissions.ts
│   │   └── rulesDiscovery.ts
│   ├── prompts/
│   │   ├── planOnly.ts
│   │   ├── askOnly.ts
│   │   └── worktreeIsolation.ts
│   │
│   │   ── LAYER 2: PORTS ─────────────────────────────────────
│   ├── ports/
│   │   ├── agentExecutor.ts        # IAgentExecutor interface — the only thing tools import
│   │   └── executorTypes.ts        # ExecutorOptions, ExecutorResult, AgentCommand
│   │
│   │   ── LAYER 1: INFRASTRUCTURE ─────────────────────────────
│   ├── adapters/
│   │   └── agentCli/
│   │       ├── executor.ts         # AgentCliExecutor implements IAgentExecutor
│   │       ├── argBuilder.ts       # ALL CLI flag knowledge lives here — one file
│   │       ├── ringBuffer.ts       # Output capture primitive
│   │       └── types.ts            # Re-exports executor types from ports/
│   │
│   │   ── CROSS-CUTTING ─────────────────────────────────────
│   ├── config.ts                   # Env var loading + validation
│   ├── security.ts                 # Path allowlist validation (zero external deps)
│   ├── errors.ts                   # ErrorClass enum + StructuredError + buildError()
│   └── logger.ts                   # Structured JSON logger (stderr only)
│
├── tests/
│   ├── unit/
│   │   ├── adapters/
│   │   │   ├── executor.test.ts
│   │   │   └── ringBuffer.test.ts
│   │   ├── pipeline/
│   │   │   └── toolPipeline.test.ts
│   │   ├── security.test.ts
│   │   ├── config.test.ts
│   │   └── tools/
│   │       ├── runAgent.test.ts
│   │       ├── listModels.test.ts
│   │       ├── agentStatus.test.ts
│   │       ├── sessionCreate.test.ts
│   │       └── sessionResume.test.ts
│   ├── integration/
│   │   └── agentCli.test.ts
│   └── fixtures/
│       └── mockExecutor.ts         # Implements IAgentExecutor (not a cast hack)
│
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md             # this file
│   ├── DIAGRAMS.md                 # C4 context, container, component diagrams
│   ├── API_SPEC.md
│   ├── TESTING_STRATEGY.md
│   ├── BRANCH_STRATEGY.md
│   ├── AGENT_RULES.md
│   └── TASK_LIST.md
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── pr-checks.yml
├── CLAUDE.md
├── README.md
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── .eslintrc.json
├── .prettierrc
└── vitest.config.ts
```

---

## 4. Module Responsibilities

### 4.1 `src/index.ts` — Composition Root

The **only** file that knows which concrete implementation wires to which interface. Responsibilities:

1. Load `Config` from env vars.
2. Instantiate `AgentCliExecutor` (the concrete `IAgentExecutor` implementation), passing `Config`.
3. Instantiate `McpServer` (from `server.ts`), passing the executor and registries.
4. Start stdio transport.
5. Register SIGTERM/SIGINT handlers for graceful shutdown.

**Does NOT contain:** business logic, tool handler code, subprocess code.  
**If you add a new adapter** (e.g., HTTP transport, mock executor for dev): only `index.ts` changes.

---

### 4.2 `src/server.ts` — Transport Adapter

Reads `ALL_TOOLS`, `ALL_RESOURCES`, `ALL_PROMPTS` from the registries and registers them with the MCP SDK. The registration loop is generic — it calls `toolPipeline.wrap(descriptor)` for each tool.

**Does NOT contain:** handler logic, Zod schemas, subprocess code.  
**Adding a new tool:** `server.ts` never changes. New tool → new file → one line in `registry/tools.ts`.

---

### 4.3 `src/pipeline/toolPipeline.ts` — Application Pipeline

The cross-cutting pipeline that wraps every tool handler. Executes in this fixed order:

```
1. schema.parse(rawInput)         → throws ZodError  → VALIDATION error
2. security.validatePaths(paths)  → throws SecurityError → SECURITY error
3. handler(validatedInput, exec)  → returns raw result or throws
4. mapResult(raw)                 → returns McpToolResult
5. mapError(err)                  → returns McpToolResult with isError: true
```

This is the **single place** to add cross-cutting concerns. Rate limiting, audit logging, request tracing — all go here, zero tool handler changes required.

**Exports one function:**

```typescript
function wrapTool(descriptor: ToolDescriptor, executor: IAgentExecutor, ctx: PipelineContext): McpToolHandler
```

**`PipelineContext`** — per-request config injected by `server.ts`:

```typescript
interface PipelineContext {
  workspaceAllowlist: string[];
  agentBinaryPath: string;
  agentTimeoutMs: number;
  maxOutputBytes: number;
  sendNotification?: (chunk: string) => void;  // Phase 4 streaming — undefined = aggregated-only fallback
}
```

`sendNotification` is created by `server.ts` (Layer 4) and bound to the MCP transport. Tool handlers receive it through `PipelineContext` and never import the MCP SDK transport directly. When `undefined`, the tool handler takes the aggregated-only path unchanged.

---

### 4.4 `src/registry/`

Self-registration pattern. Each registry file exports an array of descriptors. `server.ts` reads the array — it does not enumerate tools manually.

```typescript
// registry/tools.ts
export const ALL_TOOLS: ToolDescriptor[] = [
  runAgentDescriptor,
  listModelsDescriptor,
  agentStatusDescriptor,
  // sessions added here only if SESSION_GATE passes — no other file changes
];
```

Adding a tool = add one import + one array entry. No `server.ts` change. No `index.ts` change.

---

### 4.5 `src/tools/` — Tool Handlers (Application Logic)

Each tool file exports a `ToolDescriptor`:

```typescript
interface ToolDescriptor {
  name: string;
  description: string;
  schema: ZodSchema;
  pathArgs: (input: unknown) => string[];  // which fields need path validation
  handler: (input: ValidatedInput, executor: IAgentExecutor) => Promise<ToolResult>;
}
```

Rules for tool handlers:
- Import only: `IAgentExecutor` (from `ports/`), `errors.ts`, `logger.ts`, their own Zod schema.
- Do NOT call `security.validatePaths()` — the pipeline does this.
- Do NOT build CLI arg arrays — call `argBuilder` methods if needed, or return a structured input the executor understands.
- Do NOT map `ExecutorResult` to `StructuredError` — the pipeline does this via the error classification guide.

---

### 4.6 `src/ports/agentExecutor.ts` — The Dependency Boundary

```typescript
export interface IAgentExecutor {
  run(options: ExecutorOptions): Promise<ExecutorResult>;
}
```

This is the wall between the application layer and the infrastructure layer. Everything above this line (tools, pipeline, server) depends on this interface. Everything below (AgentCliExecutor, argBuilder, ringBuffer) is free to change without touching application code.

The mock in `tests/fixtures/mockExecutor.ts` implements this interface properly — no `as unknown as` cast.

---

### 4.7 `src/adapters/agentCli/` — Infrastructure

**`executor.ts` — `AgentCliExecutor`**

Implements `IAgentExecutor`. The only module that calls `child_process.spawn`.

Rules:
- ALWAYS `spawn(binary, argsArray, { shell: false })`.
- Captures stdout and stderr into independent `RingBuffer` instances.
- Enforces `AGENT_TIMEOUT_MS`: SIGTERM → 5s grace → SIGKILL.
- Returns `ExecutorResult` on all paths — never throws for subprocess errors.

**`argBuilder.ts` — CLI Flag Knowledge**

The **only** file that knows Cursor CLI flag names. Maps structured `ToolInput` objects to `string[]` arg arrays.

```typescript
export function buildRunAgentArgs(input: RunAgentInput): string[]
export function buildListModelsArgs(): string[]
export function buildSessionCreateArgs(workspace?: string): string[]
export function buildSessionResumeArgs(input: SessionResumeCliInput): string[]
```

If Cursor renames `--mode` → `--run-mode`, change one function in one file. Zero tool handlers change.

**`ringBuffer.ts` — Output Capture Primitive**

Fixed-size byte ring buffer. Per-buffer, not shared between stdout/stderr.

- `append(chunk: Buffer): void` — drops oldest bytes when full.
- `toString(): string` — returns valid UTF-8 (drops incomplete trailing multibyte sequence, never throws, never uses U+FFFD).
- `truncated: boolean` — true if any bytes were dropped.

**`types.ts` — Infrastructure Types**

Canonical definitions live in `src/ports/executorTypes.ts` (dependency boundary). `adapters/agentCli/types.ts` re-exports them.

```typescript
interface ExecutorOptions {
  binary: string;
  args: string[];
  timeoutMs: number;
  maxOutputBytes: number;
  onStdoutChunk?: (chunk: string) => void;  // Phase 4 streaming — called per chunk before process exit
}

interface ExecutorResult {
  stdout: string;
  stderrExcerpt: string;   // last 2 KB
  exitCode: number;
  timedOut: boolean;
  outputTruncated: boolean;
  durationMs: number;
}
```

---

### 4.8 `src/config.ts` — Cross-Cutting Configuration

Loads and validates all configuration from environment variables. Injected into `AgentCliExecutor` and `security.ts` via `index.ts`.

| Env var | Default | Validation |
|---------|---------|-----------|
| `AGENT_BINARY_PATH` | Platform default | `fs.accessSync` X_OK; warn (not fatal) if missing |
| `AGENT_TIMEOUT_MS` | `120000` | Integer > 0; throws `ConfigError` if invalid |
| `SESSION_CREATE_TIMEOUT_MS` | `10000` | Integer > 0; throws `ConfigError` if invalid |
| `MAX_OUTPUT_BYTES` | `524288` | Integer ≥ `1024`; throws `ConfigError` if below minimum or invalid |
| `WORKSPACE_ALLOWLIST` | `""` (deny all) | Split on `:`; empty → deny all; no allow-all mode |
| `LOG_LEVEL` | `info` | One of: `debug`, `info`, `warn`, `error` |
| `LOG_PROMPTS` | `false` | Prompt text logged only if `true`, only at `debug` |

**Platform defaults for `AGENT_BINARY_PATH`:**
- macOS: `~/.local/bin/cursor-agent` → fallback: `/opt/homebrew/bin/cursor-agent`
- Linux: `~/.local/bin/cursor-agent` → fallback: `/usr/local/bin/cursor-agent`

**Shutdown contract:** SIGTERM/SIGINT → complete in-flight requests (already past validation) → SIGTERM all spawned subprocesses → wait up to 10s → `process.exit(0)`.

---

### 4.9 `src/security.ts` — Cross-Cutting Path Validation

Zero external dependencies (Node builtins only: `path`, `fs`).

**`validatePaths(paths: string[], allowlist: string[]): void`**  
Throws `SecurityError` if any path violates the allowlist. Called by the pipeline, not by individual tools.

**Path matching contract:**

1. `path.resolve()` on both candidate and each allowlist entry — normalizes `../`, duplicate slashes, relative paths.
2. Append `/` to both before prefix-matching — prevents `/home/user` matching `/home/user2`.
3. `fs.realpathSync()` on candidate if it exists on disk (symlink resolution for inputs, not for allowlist entries).
4. Empty allowlist → all paths throw `SecurityError`. No allow-all mode.
5. Non-existent paths: string-match only (realpathSync skipped).
6. Relative paths: resolve via `path.resolve()` first, then validate.

**`stderrExcerpt` privacy note:** may contain tokens/credentials. Never log `StructuredError` at INFO or above.

---

### 4.10 `src/errors.ts` — Cross-Cutting Error Taxonomy

```typescript
enum ErrorClass {
  BINARY_NOT_FOUND = "BINARY_NOT_FOUND",
  AUTH_REQUIRED    = "AUTH_REQUIRED",    // run_agent / session tools only
  TIMEOUT          = "TIMEOUT",
  SECURITY         = "SECURITY",
  VALIDATION       = "VALIDATION",
  AGENT_ERROR      = "AGENT_ERROR",
  UNKNOWN          = "UNKNOWN",
}

interface StructuredError {
  errorClass: ErrorClass;
  message: string;
  exitCode?: number;
  stderrExcerpt?: string;
  timedOut?: boolean;
}

function buildError(cls: ErrorClass, message: string, extras?: Partial<StructuredError>): StructuredError
```

Error classification lives in `pipeline/toolPipeline.ts`, not in individual tool handlers.

### 4.11 `src/logger.ts` — Cross-Cutting Logging

Writes JSON lines to `process.stderr` only. `console.log` and `console.error` are ESLint-banned (`no-console: error`). Any write to stdout breaks the MCP JSON-RPC transport.

---

## 5. Data Flow

### 5.1 Happy Path — `run_agent`

```
[MCP Host]
    │  JSON-RPC tools/call { name: "run_agent", arguments: { prompt, model, workspace } }
    ▼
[server.ts]  — looks up tool in ALL_TOOLS registry, delegates to pipeline
    │
    ▼
[toolPipeline.ts]
    ├─ 1. schema.parse(arguments)                → ZodError? → VALIDATION error, stop
    ├─ 2. security.validatePaths([workspace])     → SecurityError? → SECURITY error, stop
    ├─ 3. runAgent.handler(validatedInput, exec)  → calls executor
    │         │
    │         ▼
    │   [argBuilder.ts]  buildRunAgentArgs(input) → ["agent", "-p", prompt, "--model", ...]
    │         │
    │         ▼
    │   [AgentCliExecutor.run(options)]
    │         ├── spawn(binary, args, { shell: false })
    │         ├── RingBuffer[stdout] ← process.stdout chunks
    │         ├── RingBuffer[stderr] ← process.stderr chunks
    │         ├── timeout watchdog (SIGTERM → SIGKILL after 5s)
    │         └── returns ExecutorResult { stdout, stderrExcerpt, exitCode, timedOut, ... }
    │
    ├─ 4. exitCode === 0 → mapResult(ExecutorResult) → McpToolResult (success)
    └─ 5. exitCode !== 0 → classifyError(result) → McpToolResult (isError: true)
    │
    ▼
[MCP Host receives tools/call response]
```

### 5.2 Error Paths — Classification Table

| Condition | Handler | ErrorClass |
|-----------|---------|-----------|
| Zod validation fails | Pipeline step 1 | `VALIDATION` |
| Path not in allowlist | Pipeline step 2 | `SECURITY` |
| spawn throws ENOENT | Executor → pipeline step 5 | `BINARY_NOT_FOUND` |
| `timedOut === true` | Executor → pipeline step 5 | `TIMEOUT` |
| exit non-zero + stderr has "login"/"auth" | pipeline step 5 | `AUTH_REQUIRED` |
| exit non-zero (other) | pipeline step 5 | `AGENT_ERROR` |
| Uncaught JS exception | pipeline step 5 | `UNKNOWN` |

**`agent_status` exception:** non-zero exit → success response `{ authenticated: false }`, never an error. Only ENOENT → `BINARY_NOT_FOUND`.

---

## 6. Import Dependency Rules (Enforced by ESLint)

```
ALLOWED imports:
  Transport    → Application, Ports, Cross-Cutting
  Application  → Ports, Cross-Cutting
  Ports        → (nothing — pure interfaces)
  Adapters     → Ports, Cross-Cutting
  Cross-Cutting → (nothing except Node builtins)

FORBIDDEN imports (will fail ESLint):
  tools/*        → adapters/*         (skip the port boundary)
  tools/*        → tools/*            (tools are siblings, not dependents)
  adapters/*     → tools/*            (upward dependency)
  adapters/*     → server.ts          (upward dependency)
  security.ts    → anything non-builtin
  logger.ts      → anything (writes stderr, no imports needed)
  anywhere       → console.log        (stdout contamination)
  anywhere       → shell: true        (injection risk)
```

---

## 7. CI Pipeline

```yaml
jobs:
  lint:        eslint src/ tests/         # import rule violations caught here
  typecheck:   tsc --noEmit               # interface compliance caught here
  unit:        vitest run tests/unit/
  integration:
    if: CURSOR_AGENT_PATH secret set
    run: vitest run tests/integration/
```

---

## 8. Dependency Diagram (Modules)

```
index.ts (composition root)
  ├── server.ts
  │     ├── registry/tools.ts
  │     ├── registry/resources.ts
  │     └── registry/prompts.ts
  │           ↓ all use
  │     pipeline/toolPipeline.ts
  │           ├── security.ts
  │           ├── errors.ts
  │           └── logger.ts
  │
  ├── tools/runAgent.ts ─────────────┐
  ├── tools/listModels.ts ───────────┤──→ ports/agentExecutor.ts (IAgentExecutor)
  ├── tools/agentStatus.ts ──────────┤         ↑ implemented by
  └── tools/sessions/* ─────────────┘   adapters/agentCli/executor.ts
                                               ├── adapters/agentCli/argBuilder.ts
                                               ├── adapters/agentCli/ringBuffer.ts
                                               └── adapters/agentCli/types.ts

All modules may use:
  ├── config.ts
  ├── errors.ts
  └── logger.ts

tests/fixtures/mockExecutor.ts implements IAgentExecutor (no casts)
```

---

## 9. Architectural Constraints (Non-Negotiable)

1. `adapters/` has zero imports from `tools/`, `server.ts`, or MCP SDK types.
2. `tools/` has zero imports from `adapters/` — only from `ports/`.
3. `ports/` has zero imports from anywhere. Pure interfaces only.
4. `security.ts` has zero external dependencies — Node builtins only.
5. `logger.ts` writes ONLY to `process.stderr`. `console.*` is ESLint-banned.
6. `spawn` is always called with `{ shell: false }`. ESLint custom rule enforces this.
7. Tool handlers do NOT call `security.validatePaths()` — the pipeline does.
8. Tool handlers do NOT build CLI arg arrays directly — `argBuilder.ts` does.
9. Adding a new tool requires changes to: one new file in `tools/` + one line in `registry/tools.ts`. Nothing else.
10. `mockExecutor.ts` implements `IAgentExecutor` as a proper class — no `as unknown as` casts.
