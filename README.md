# cursor-cli-mcp

This repository implements a **local MCP (Model Context Protocol) server** in TypeScript that forwards validated requests to Cursor’s **`agent`** CLI and returns structured results. It is deliberately thin: orchestration, validation, path allowlists, and timeouts live here; the Cursor agent remains the authority for running work.

---

## Prerequisites

- **Node.js** `>= 20`
- Cursor **`agent`** CLI installed, on your `PATH` or reachable via **`AGENT_BINARY_PATH`**, and authenticated with Cursor where required

---

## Installation

From the repository root:

```bash
npm install && npm run build
```

Compiled output is written to **`dist/`**.

---

## Configuration

Environment variables (**`docs/ARCHITECTURE.md`** § 4.8).

| Env var               | Default          | Validation                                                |
| --------------------- | ---------------- | --------------------------------------------------------- |
| `AGENT_BINARY_PATH`   | Platform default | `fs.accessSync` `X_OK`; warn (not fatal) if missing       |
| `AGENT_TIMEOUT_MS`    | `120000`         | Integer `> 0`; throws **`ConfigError`** if invalid        |
| `MAX_OUTPUT_BYTES`    | `524288`         | Integer `> 0`; throws **`ConfigError`** if `0` or invalid |
| `WORKSPACE_ALLOWLIST` | `""` (deny all)  | Split on **`:`**; empty → deny all; **no allow-all mode** |
| `LOG_LEVEL`           | `info`           | One of: `debug`, `info`, `warn`, `error`                  |
| `LOG_PROMPTS`         | `false`          | Prompt text logged only if `true`, only at **`debug`**    |

Platform defaults for **`AGENT_BINARY_PATH`**: macOS **`/usr/local/bin/agent`** with fallback **`/Applications/Cursor.app/Contents/Resources/app/bin/agent`**; Linux **`/usr/local/bin/agent`**.

---

## MCP client setup (`mcp.json`)

Example entry for Claude Desktop (**`docs/API_SPEC.md`** § 7):

```json
{
  "mcpServers": {
    "cursor-cli-mcp": {
      "command": "node",
      "args": ["/path/to/cursor-cli-mcp/dist/index.js"],
      "env": {
        "AGENT_BINARY_PATH": "/usr/local/bin/agent",
        "WORKSPACE_ALLOWLIST": "/Users/you/projects:/Users/you/work",
        "AGENT_TIMEOUT_MS": "120000",
        "MAX_OUTPUT_BYTES": "524288"
      }
    }
  }
}
```

Replace **`/path/to/cursor-cli-mcp`** with your checkout and **`AGENT_BINARY_PATH`** / **`WORKSPACE_ALLOWLIST`** with paths appropriate for your machine.

---

## Verification

After **`npm run build`**, smoke-test the MCP handshake (**`docs/TASK_LIST.md`** T1A.7):

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.0.1"}}}' \
  | node dist/index.js
```

**Phase 0 expectations:** running **`node dist/index.js`** before the MCP server exists may not yet return a JSON-RPC **`initialize`** result; this command is the gate used once **`src/index.ts`** wires **`stdio`** MCP transport (**Phase 1**).

---

## Troubleshooting

| Symptom                                                                                      | Meaning                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Structured error **`BINARY_NOT_FOUND`**                                                      | The configured **`agent`** binary path does not exist or cannot be executed (`ENOENT` / missing file). Fix **`AGENT_BINARY_PATH`** or install the CLI.                                                              |
| Structured error **`AUTH_REQUIRED`** (`run_agent` / sessions)                                | The CLI reported authentication or login failure (typically non-zero exit and auth-related **`stderr`**). Sign in via Cursor / `agent` auth flow until **`agent_status`** succeeds.                                 |
| **`SECURITY`** failures or confusing path denials when **`WORKSPACE_ALLOWLIST`** is **`""`** | An empty allowlist **denies every workspace/worktree path** by design (see **`docs/ARCHITECTURE.md`** § 4.9). Set **`WORKSPACE_ALLOWLIST`** to colon-separated absolute roots you trust (no global allow-all mode). |
