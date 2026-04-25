# API Specification: cursor-cli-mcp MCP Tools

**Last updated:** 2026-04-21  
**Status:** Authoritative — all tool implementations must match these schemas exactly.

---

## 1. Conventions

- All tool inputs validated with Zod before any side effects.
- All tool responses are JSON-serializable objects.
- All errors use the `StructuredError` shape (section 2).
- Paths in arguments must pass `security.validatePaths()` before subprocess invocation.
- MCP SDK error responses use `isError: true` with content being `JSON.stringify(StructuredError)`.

---

## 2. Shared Types

### 2.1 StructuredError

```typescript
{
  errorClass: 
    | "BINARY_NOT_FOUND"   // agent binary not found at configured path
    | "AUTH_REQUIRED"      // agent reports login required
    | "TIMEOUT"            // subprocess exceeded AGENT_TIMEOUT_MS
    | "OUTPUT_TRUNCATED"   // output exceeded MAX_OUTPUT_BYTES (non-fatal, included in success response)
    | "SECURITY"           // path allowlist violation
    | "VALIDATION"         // Zod schema validation failure
    | "AGENT_ERROR"        // agent exited non-zero for other reasons
    | "UNKNOWN";           // unclassified error
  message: string;         // human-readable description
  exitCode?: number;       // subprocess exit code, if applicable
  stderrExcerpt?: string;  // last 2 KB of stderr, if applicable
  timedOut?: boolean;      // true if TIMEOUT class
}
```

### 2.2 AgentRunResult

```typescript
{
  stdout: string;            // captured stdout content (may be truncated)
  stderrExcerpt: string;     // last 2 KB of stderr
  exitCode: number;
  timedOut: boolean;
  outputTruncated: boolean;  // true if ring buffer dropped bytes
  durationMs: number;        // wall-clock time of subprocess
}
```

### 2.3 Mode Enum

```typescript
type AgentMode = "agent" | "plan" | "ask";
```

### 2.4 OutputFormat Enum

```typescript
type OutputFormat = "text" | "json" | "stream-json";
// Note: "stream-json" returns aggregated output in MVP; streaming behavior in Phase 3.
```

---

## 3. Tools

### 3.1 `run_agent` (FR-M1)

Executes Cursor's agent in non-interactive (print) mode with the given prompt and options.

**Input Schema (Zod):**

```typescript
z.object({
  prompt: z.string().min(1).max(32_000),
  model: z.string().optional(),
  mode: z.enum(["agent", "plan", "ask"]).optional().default("agent"),
  workspace: z.string().optional(),      // must pass path allowlist
  worktree: z.string().optional(),       // must pass path allowlist
  sandbox: z.boolean().optional(),  // omitted = no `--sandbox` flag; true/false → enabled/disabled
  output_format: z.enum(["text", "json", "stream-json"]).optional().default("text"),
  approve_mcps: z.boolean().optional().default(false),
})
```

**CLI mapping:**

| Input field | CLI flag |
|-------------|----------|
| _(always)_ | `--trust` (workspace trust; allowlist enforced server-side) |
| `prompt` | `-p "<prompt>"` |
| `model` | `--model <model>` |
| `mode=plan` | `--mode=plan` |
| `mode=ask` | `--mode=ask` |
| `workspace` | `--workspace <path>` |
| `worktree` | `--worktree <path>` |
| `sandbox=true` | `--sandbox enabled` |
| `sandbox=false` | `--sandbox disabled` |
| `output_format` | `--output-format <format>` |
| `approve_mcps=true` | `--approve-mcps` |

**Success Response:**

```typescript
{
  content: [{
    type: "text",
    text: JSON.stringify(AgentRunResult)
  }]
}
```

**Error Response:**

```typescript
{
  content: [{
    type: "text",
    text: JSON.stringify(StructuredError)
  }],
  isError: true
}
```

**Security gate:** `workspace` and `worktree` paths MUST pass `security.validatePaths()`. If either fails, return `SECURITY` error before spawning subprocess.

---

### 3.2 `list_models` (FR-M2)

Returns available model identifiers from the Cursor agent CLI.

**Input Schema:**

```typescript
z.object({})  // no inputs
```

**CLI invocation:** `agent models` (or equivalent — validate against actual CLI during Phase 2 task T2.2).

**Success Response:**

```typescript
{
  content: [{
    type: "text",
    text: JSON.stringify({
      models: string[]   // array of model identifier strings
    })
  }]
}
```

**Error Response:** `StructuredError` with `isError: true`.

---

### 3.3 `session_list` (FR-M3) — **CANCELLED**

There is **no** `session_list` MCP tool in this server. Cursor’s `agent ls` is an interactive TUI only — it does not produce machine-readable stdout suitable for MCP. Do not implement or document a live `session_list` contract here.

---

### 3.4 `session_create` (FR-M4) — Gated

Creates a new empty session and returns its id.

**Gate condition:** Same redesign as FR-M3. Use `agent create-chat`.

**Input Schema:**

```typescript
z.object({
  workspace: z.string().optional(),  // path allowlist enforced
})
```

**CLI invocation:** `agent create-chat` (non-interactive)
- argBuilder: `buildSessionCreateArgs(workspace?)` → `['create-chat']`, plus `['--workspace', '<path>']` when `workspace` is provided (path allowlist enforced before spawn).
- Parse stdout for chat ID (expected: single line or JSON with the ID).

**Success Response:**

```typescript
{
  content: [{
    type: "text",
    text: JSON.stringify({
      sessionId: string;   // chat ID returned by create-chat
    })
  }]
}
```

---

### 3.5 `session_resume` (FR-M5) — Gated

Resumes an existing session with an additional prompt.

**Gate condition:** Same redesign as FR-M3. Use `agent -p <prompt> --resume <chatId>`.

**Input Schema:**

```typescript
z.object({
  session_id: z.string().min(1),
  prompt: z.string().min(1).max(32_000),
  model: z.string().optional(),
  output_format: z.enum(["text", "json"]).optional().default("text"),
})
```

**CLI invocation:** `agent -p "<prompt>" --resume <session_id>`
- argBuilder: `buildSessionResumeArgs({ sessionId, prompt })` → `['-p', prompt, '--resume', sessionId]`

**Success Response:** Same shape as `run_agent` (`AgentRunResult`).

---

### 3.6 `agent_status` (FR-M6)

Returns authentication status, version, and binary path.

**Input Schema:**

```typescript
z.object({})  // no inputs
```

**CLI invocation:** `agent status` and/or `agent about` (whichever is available).

**Success Response:**

```typescript
{
  content: [{
    type: "text",
    text: JSON.stringify({
      authenticated: boolean;
      version?: string;
      binaryPath: string;       // resolved path used by executor
      agentCliVersion?: string; // from agent --version or about
    })
  }]
}
```

**Special behavior and error contract for `agent_status` (authoritative — resolves contradiction with error taxonomy):**

`agent_status` has unique error handling that differs from all other tools:

| Condition | Response type | `isError` | Notes |
|-----------|--------------|-----------|-------|
| Binary not found (ENOENT on spawn) | Error | `true` | `errorClass: BINARY_NOT_FOUND` |
| Subprocess exits non-zero for any reason | Success | `false` | Return `{ authenticated: false, binaryPath }` |
| Subprocess exits 0 | Success | `false` | Return `{ authenticated: true, binaryPath, ... }` |
| JS exception (not spawn ENOENT) | Error | `true` | `errorClass: UNKNOWN` |

`AUTH_REQUIRED` is **never** returned by `agent_status`. It is only valid for `run_agent` and session tools. The rationale: `agent_status` is a diagnostic tool — it must report "not authenticated" gracefully, not fail, so operators can detect auth problems without getting an error response they need to handle.

`OUTPUT_TRUNCATED` is NOT an error class for error responses — it is a boolean field in `AgentRunResult` returned on success. Output truncation is expected behavior, not a failure.

---

## 4. Resources

### 4.1 `cli-permissions-reference` (FR-R1)

**URI:** `cursor-cli-mcp://resources/cli-permissions`  
**MIME type:** `text/markdown`  
**Content:** Static markdown explaining `~/.cursor/cli-config.json` and `.cursor/cli.json` permission shapes (`Shell`, `Read`, `Write`, `WebFetch`, `Mcp`). Updated manually as Cursor docs evolve.

### 4.2 `rules-discovery` (FR-R2)

**URI:** `cursor-cli-mcp://resources/rules-discovery`  
**MIME type:** `text/markdown`  
**Content:** Static markdown explaining that CLI loads `.cursor/rules`, `AGENTS.md`, `CLAUDE.md` — how instructions enter the agent without being passed per-request.

---

## 5. Prompt Templates

### 5.1 `plan-only` (FR-P1)

**Description:** Pre-filled for `--mode=plan` runs.  
**Arguments:** `prompt` (required), `workspace` (optional).  
**Generates:** `run_agent` call with `mode: "plan"`.

### 5.2 `ask-only` (FR-P2)

**Description:** Pre-filled for read-only `--mode=ask` runs.  
**Arguments:** `prompt` (required), `workspace` (optional).  
**Generates:** `run_agent` call with `mode: "ask"`.

### 5.3 `worktree-isolation` (FR-P3)

**Description:** Pre-filled for isolated runs using a Git worktree.  
**Arguments:** `prompt` (required), `workspace` (required), `worktree` (required).  
**Generates:** `run_agent` call with `worktree` set and `sandbox: true`.

---

## 6. Error Classification Guide

When implementing tool handlers, use this decision tree to assign `errorClass`:

Use this decision tree for all tools **except `agent_status`** (see section 3.6 for its unique contract):

```
subprocess spawn fails with ENOENT?
  → BINARY_NOT_FOUND

timedOut === true?
  → TIMEOUT

Zod parse throws ZodError?
  → VALIDATION

security.validatePaths() throws?
  → SECURITY

subprocess exits non-zero AND stderr contains "login" or "auth" (case-insensitive)?
  → AUTH_REQUIRED

any other non-zero exit?
  → AGENT_ERROR

unexpected JS exception (not spawn ENOENT)?
  → UNKNOWN
```

`OUTPUT_TRUNCATED` is NOT an error class. It is the `outputTruncated: boolean` field on `AgentRunResult` — set to `true` when the ring buffer dropped bytes. Truncation is surfaced in the success response, never as an error.

---

## 7. MCP Server Identity

```json
{
  "name": "cursor-cli-mcp",
  "version": "0.1.0",
  "description": "MCP server for controlling Cursor's agent CLI"
}
```

### 7.1 Environment variables (operator reference)

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_BINARY_PATH` | Platform default | Absolute path to the `cursor-agent` binary |
| `AGENT_TIMEOUT_MS` | `120000` | Default subprocess timeout for most tools (ms) |
| `SESSION_CREATE_TIMEOUT_MS` | `10000` | Timeout for `session_create` / `create-chat` only (ms) |
| `MAX_OUTPUT_BYTES` | `524288` | Ring buffer cap for captured stdout |
| `WORKSPACE_ALLOWLIST` | `""` | Colon-separated allowed workspace paths |

Example `mcp.json` entry for Claude Desktop:

```json
{
  "mcpServers": {
    "cursor-cli-mcp": {
      "command": "node",
      "args": ["/path/to/cursor-cli-mcp/dist/index.js"],
      "env": {
        "AGENT_BINARY_PATH": "/Users/you/.local/bin/cursor-agent",
        "WORKSPACE_ALLOWLIST": "/Users/you/projects:/Users/you/work",
        "AGENT_TIMEOUT_MS": "120000",
        "SESSION_CREATE_TIMEOUT_MS": "10000",
        "MAX_OUTPUT_BYTES": "524288"
      }
    }
  }
}
```
