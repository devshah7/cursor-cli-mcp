# cursor-cli-mcp

A local **Model Context Protocol (MCP) server** that lets Claude Desktop and Claude Code drive Cursor's `agent` CLI — validated inputs, path allowlists, output streaming, and structured errors included.

```
Claude Desktop / Claude Code
        │  MCP (stdio JSON-RPC)
        ▼
  cursor-cli-mcp          ← this repo
        │  spawn (shell: false)
        ▼
  Cursor agent CLI
```

---

## What you get

| MCP Surface | Name | What it does |
|-------------|------|-------------|
| Tool | `run_agent` | Run a prompt in `agent`, `plan`, or `ask` mode — streaming output included |
| Tool | `list_models` | List all model identifiers available to the CLI |
| Tool | `agent_status` | Check CLI authentication and binary version |
| Tool | `session_create` | Create a new chat session and return its ID |
| Tool | `session_resume` | Resume an existing session with a follow-up prompt |
| Resource | `cli-permissions-reference` | What the agent CLI can and cannot do |
| Resource | `rules-discovery` | How to locate `.cursorrules` / `AGENTS.md` files |
| Prompt | `plan-only` | Prompt template that constrains the agent to plan mode |
| Prompt | `ask-only` | Prompt template for read-only Q&A (no file edits) |
| Prompt | `worktree-isolation` | Prompt template for running the agent in an isolated git worktree |

---

## Prerequisites

### Node.js

Install Node.js `>= 20` from [nodejs.org](https://nodejs.org) if you don't have it.

---

### Cursor CLI (`agent` binary)

**1. Open a terminal**

- macOS: Terminal or iTerm2
- Linux: your distro's terminal
- Windows: PowerShell (not Command Prompt)
- WSL: your WSL terminal

**2. Run the installer**

macOS / Linux / WSL:
```bash
curl https://cursor.com/install -fsS | bash
```

Windows (PowerShell):
```powershell
irm 'https://cursor.com/install?win32=true' | iex
```

**3. Ensure `agent` is on your PATH**

If `agent` isn't found after install, add `~/.local/bin` to your PATH:

```bash
# Bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc

# Zsh
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc

# Fish
fish_add_path $HOME/.local/bin
```

Windows sets PATH automatically — restart PowerShell if needed.

**4. Sign in to Cursor, then verify**

Open Cursor and sign in. Then back in your terminal run:
```bash
agent status
```
Should show your Cursor account email. If not, sign in to Cursor first.

**5. Note your binary path — you'll need it during setup**

| Platform | `AGENT_BINARY_PATH` |
|----------|---------------------|
| macOS / Linux / WSL | `~/.local/bin/cursor-agent` |
| Windows | `%LocalAppData%\cursor-agent\cursor-agent.exe` |

---

### Claude Desktop

Download and install from [claude.ai/download](https://claude.ai/download) and sign in. `npm run setup` handles writing the config automatically — just make sure Claude Desktop is installed and closed before running setup.

---

## Quick setup (recommended)

Clone the repo and run one command:

```bash
git clone https://github.com/devshah7/cursor-cli-mcp.git
cd cursor-cli-mcp
npm run setup
```

The interactive script handles everything:

| Step | What happens |
|------|-------------|
| 1 | Checks Node.js `>= 20` |
| 2 | Finds the `agent` binary (checks common paths; prompts if not found) |
| 3 | Runs `npm install` + `npm run build` |
| 4 | Finds (or creates) `claude_desktop_config.json` at the correct OS path |
| 5 | Prompts for the workspace paths you want the agent to be allowed to access |
| 6 | Writes the `cursor-cli-mcp` entry into your Claude Desktop config |
| 7 | Smoke-tests the server with an MCP `initialize` handshake |

Then **restart Claude Desktop** — the tools appear automatically.

---

## Manual setup

If you prefer to configure manually:

### 1. Install and build

```bash
npm install && npm run build
```

### 2. Find your Claude Desktop config file

Open your terminal and navigate to the config directory:

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/Claude/` |
| Linux | `~/.config/Claude/` |
| Windows | `%APPDATA%\Claude\` |

Open it directly from the terminal:

```bash
# macOS
open ~/Library/Application\ Support/Claude/

# Linux
xdg-open ~/.config/Claude/
```

Windows — paste into File Explorer address bar: `%APPDATA%\Claude\`

The file is called `claude_desktop_config.json`. Create it if it doesn't exist yet.

### 3. Add the MCP server entry

**Recommended (always uses latest version)**

```json
{
  "mcpServers": {
    "cursor-cli-mcp": {
      "command": "npx",
      "args": ["-y", "@devshah7/cursor-cli-mcp"],
      "env": {
        "AGENT_BINARY_PATH": "/Users/you/.local/bin/cursor-agent",
        "WORKSPACE_ALLOWLIST": "/Users/you/projects",
        "AGENT_TIMEOUT_MS": "300000"
      }
    }
  }
}
```

**Alternative (local development build)**

```json
{
  "mcpServers": {
    "cursor-cli-mcp": {
      "command": "node",
      "args": ["/path/to/cursor-cli-mcp/dist/index.js"],
      "env": {
        "AGENT_BINARY_PATH": "/Users/you/.local/bin/cursor-agent",
        "WORKSPACE_ALLOWLIST": "/Users/you/projects;/Users/you/work",
        "AGENT_TIMEOUT_MS": "120000",
        "SESSION_CREATE_TIMEOUT_MS": "10000",
        "MAX_OUTPUT_BYTES": "524288",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

Replace `AGENT_BINARY_PATH` with your `cursor-agent` binary path from the table above, and `WORKSPACE_ALLOWLIST` with the semicolon-separated absolute paths the agent is allowed to operate on.

### 4. Restart Claude Desktop

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_BINARY_PATH` | Platform default | Absolute path to the `cursor-agent` binary |
| `WORKSPACE_ALLOWLIST` | `""` (deny all) | Semicolon-separated list of allowed absolute paths. Empty = deny all workspace operations. No allow-all mode. |
| `AGENT_TIMEOUT_MS` | `120000` | Milliseconds before the subprocess is killed |
| `SESSION_CREATE_TIMEOUT_MS` | `10000` | Milliseconds before `session_create` (`create-chat`) subprocess is killed — prevents create-chat hang |
| `MAX_OUTPUT_BYTES` | `524288` | Maximum stdout captured (ring buffer — older bytes are dropped) |
| `PROMPT_MAX_CHARS` | `20000` | Maximum prompt length in characters; `run_agent` returns a `VALIDATION` error before invoking the CLI if exceeded |
| `LOG_LEVEL` | `info` | One of: `debug`, `info`, `warn`, `error` |
| `LOG_PROMPTS` | `false` | Log prompt text — only at `debug` level if `true` |

> **`WORKSPACE_ALLOWLIST` is your primary security control.** Only paths listed here can be passed as `workspace` or `worktree` arguments. The agent binary itself is also invoked with `--trust`, so be deliberate about which paths you allow.

---

## Tools reference

### `run_agent`

Run a prompt through the Cursor agent CLI in non-interactive mode.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prompt` | string | ✅ | — | The prompt to send (max 32,000 chars) |
| `mode` | `agent` \| `plan` \| `ask` | — | `agent` | Agent mode |
| `model` | string | — | CLI default | Model identifier (see `list_models`) |
| `workspace` | string | — | — | Absolute path to the workspace (must be in `WORKSPACE_ALLOWLIST`) |
| `worktree` | string | — | — | Absolute path to a git worktree (must be in `WORKSPACE_ALLOWLIST`) |
| `sandbox` | boolean | — | — | `true` = `--sandbox enabled`, `false` = `--sandbox disabled` |
| `output_format` | `text` \| `json` \| `stream-json` | — | `text` | Output format |
| `approve_mcps` | boolean | — | `false` | Auto-approve MCP tool use inside the agent |

Streaming: when `output_format` is `stream-json` (or when the MCP client supports logging notifications), stdout chunks are forwarded as MCP `logging/message` notifications in real time.

---

### `list_models`

Returns all model identifiers supported by the CLI. No parameters.

---

### `agent_status`

Returns authentication status, binary path, and CLI version. No parameters. Run this first to confirm the server is wired up correctly.

---

### `session_create`

Creates a new empty chat session and returns its ID.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workspace` | string | — | Workspace path (must be in `WORKSPACE_ALLOWLIST`) |

Returns `{ "sessionId": "<uuid>" }`.

> **Known behaviour:** the `create-chat` subprocess occasionally hangs after printing the ID. `SESSION_CREATE_TIMEOUT_MS` (default 10s) is the safety net for `session_create` specifically.

---

### `session_resume`

Resumes an existing session with a follow-up prompt.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `session_id` | string | ✅ | — | ID returned by `session_create` |
| `prompt` | string | ✅ | — | Follow-up prompt (max 32,000 chars) |
| `model` | string | — | CLI default | Model identifier |
| `output_format` | `text` \| `json` | — | `text` | Output format |

> **Note:** combining `--resume` with `--print` (non-interactive mode) is not officially documented by Cursor. The command runs successfully but session context may not be preserved — this is a Cursor CLI limitation, not a bug in this server.

---

## Verification

After setup, confirm the server starts cleanly:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.0.1"}}}' \
  | node dist/index.js
```

You should see a JSON-RPC response with `serverInfo.name: "cursor-cli-mcp"`.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `BINARY_NOT_FOUND` error | `agent` binary not found or not executable | Check `AGENT_BINARY_PATH`; confirm `agent status` works in your terminal |
| `AUTH_REQUIRED` error | CLI not authenticated | Sign in to Cursor, then confirm `agent status` shows your account |
| `SECURITY` error on workspace path | Path not in `WORKSPACE_ALLOWLIST` | Add the path to `WORKSPACE_ALLOWLIST` in your Claude Desktop config and restart |
| Tools don't appear in Claude Desktop | Server not started / config wrong | Check the config path and JSON syntax; run the verification command above |
| `session_create` hangs | Known Cursor CLI bug | Tune `SESSION_CREATE_TIMEOUT_MS` (default 10s); the session ID is usually printed before the hang |

---

## Development

```bash
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm run build       # compile to dist/
npm run test:unit   # vitest unit tests
```

All four must pass before opening a PR.

**Branch model:** `main` is production (v1+). All work targets the `dev` integration branch via a feature branch → PR. When `dev` is stable, a release PR merges it into `main`.

```bash
git checkout dev && git pull origin dev
git checkout -b feat/my-change
# ... make changes ...
gh pr create --base dev
```

See `docs/BRANCH_STRATEGY.md` for the full rules.

---

## License

Apache 2.0 — see [LICENSE](./LICENSE) for the full text.
