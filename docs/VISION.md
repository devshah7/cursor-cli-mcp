# VISION.md — cursor-cli-mcp Future Ideas & Roadmap

This document is a living record of product ideas, architectural directions, and feature proposals for cursor-cli-mcp. Nothing here is committed to a sprint — it is a thinking space. Ideas graduate from here into TASK_LIST.md when they are scoped and ready to build.

Add freely. Mark ideas with status tags: `[idea]`, `[scoped]`, `[in-progress]`, `[done]`, `[deferred]`.

---

## Core Vision

> A self-hostable MCP server that gives teams a governed, auditable, GUI-friendly gateway to run Cursor agents against any codebase — without exposing internal paths, credentials, or infrastructure to the model or the user.

---

## Problem This Solves

Current developer tooling (Cursor, GitHub Copilot, Devin) operates at the individual level. There is no clean way to:
- Give a team shared, governed access to an AI coding agent
- Control which codebases the agent can touch
- Audit what the agent did, when, and who asked it
- Hide internal infrastructure details from the model or end user
- Integrate into a hosted / cloud environment without leaking path structure

cursor-cli-mcp is positioned to be that layer — composable, self-hostable, MCP-native, and client-agnostic.

---

## Versioned Roadmap Ideas

### v1.x — Local, single-user, stdio (current)

- [done] Five MCP tools: `run_agent`, `list_models`, `agent_status`, `session_create`, `session_resume`
- [done] WORKSPACE_ALLOWLIST env var as server-side path security gate
- [done] Structured error responses (StructuredError / ErrorClass)
- [done] Streaming stdout via MCP logging notifications
- [done] Phase 5 bug fixes (executor config, session timeout, model regex, binary path defaults, etc.)
- [in-progress] Workspace bypass warning when allowlist is set but no path is supplied
- [in-progress] `supportsStreaming` flag on ToolDescriptor (replaces hardcoded tool name check)

---

### v2 — Workspace Aliases & List Tool `[scoped]`

**The problem:** Full filesystem paths leak into model context, MCP protocol messages, and conversation logs. For hosted/enterprise setups this exposes cloud provider, internal naming conventions, project codenames, and directory structure.

**The solution:** Server-side workspace ID registry. Paths never leave the server.

#### Workspace ID Registry

Server config holds a private mapping:
```
ws_a1b2 → { name: "Cursor CLI MCP",   path: "/Users/devshah/home/automations/cursor-cli-mcp" }
ws_c3d4 → { name: "Payments Service", path: "/internal/secret/path/payments" }
ws_e5f6 → { name: "Auth Platform",    path: "/another/private/path/auth" }
```

The model and user only ever see:
```json
[
  { "id": "ws_a1b2", "name": "Cursor CLI MCP" },
  { "id": "ws_c3d4", "name": "Payments Service" }
]
```

Full paths never appear in tool inputs, tool outputs, or conversation history.

#### `list_workspaces` Tool `[idea]`

- Returns `[{ id, name }]` — no paths, no internal detail
- Empty allowlist → returns empty array with hint to configure `WORKSPACE_ALLOWLIST`
- Duplicate folder names get a one-level parent prefix for disambiguation (e.g. `projects/myapp` vs `personal/myapp`)
- Claude presents the list, asks user to pick one, holds the choice in conversation context

#### `run_agent` workspace_id param `[idea]`

- Accepts `workspace_id` (opaque string) instead of raw filesystem path
- Server resolves ID → path internally — path never travels over the wire
- Eliminates path traversal risk entirely (no path to traverse)
- Backwards-compatible: keep `workspace` (raw path) for local / dev use; `workspace_id` takes precedence if both are supplied

#### Display name conventions `[idea]`

- Default display name: basename of the path (e.g. `cursor-cli-mcp`)
- Configurable override in server config (e.g. `"Cursor CLI MCP"`)
- If two paths share a basename, show `parent/basename` automatically

---

### v3 — Remote Hosting & Multi-User `[idea]`

MCP SDK supports HTTP/SSE transport in addition to stdio. Switching transport unlocks hosting.

- Single server process, multiple developers connecting as clients
- Auth layer: API key or Bearer token per user/team
- Workspace namespacing: team A cannot list or use team B's workspace IDs
- All tool calls authenticated before reaching the pipeline
- No changes needed to the core tool/pipeline layer — auth sits in the transport layer

#### Deployment targets `[idea]`

- Self-hosted on any Linux box or VPS
- Docker image with environment variable configuration
- Railway / Render / Fly.io one-click deploy
- AWS/GCP/Azure — env vars injected via secrets manager, no credentials in image

---

### v4 — Web GUI / Dashboard `[idea]`

A thin local or hosted web UI that wraps the MCP server. Changes the audience from developers-only to any team member.

#### Workspace Picker `[idea]`

- Visual cards for each allowed workspace (name, last-used timestamp, language badge)
- Click to select — chosen workspace ID flows automatically into subsequent agent calls
- No path, no internal detail shown to the user

#### Live Output Panel `[idea]`

- The `sendNotification` streaming pipeline is already built
- A frontend WebSocket consumer can render each chunk in real-time as the agent runs
- Shows agent thinking, file edits, test output as it streams

#### Session History `[idea]`

- List of past sessions: prompt snippet, workspace name, timestamp, success/fail
- Click to resume a session (calls `session_resume` with stored session ID)

#### Status Indicator `[idea]`

- Is the agent binary reachable? (`agent_status`)
- Which models are available? (`list_models`)
- Active sessions count

#### Tech options `[idea]`

- Local: Electron app (bundles server + UI, zero install for end user)
- Hosted: Express static server + React, runs alongside the MCP server on the same box
- Could start as a simple HTML + vanilla JS page before committing to a framework

---

### v5 — Enterprise Features `[idea]`

Features that make this viable for teams and businesses in regulated or security-conscious environments.

#### Role-Based Access Control (RBAC) `[idea]`

- Roles: `viewer` (can list workspaces), `runner` (can run agent), `admin` (can manage config)
- Workspace-level permissions: user X can run against workspace A but not B
- Defined in server config or a connected identity provider

#### Audit Log `[idea]`

- Every tool call logged: timestamp, user identity, workspace ID, tool name, prompt hash, exit code, duration
- Never logs prompt content by default (mirrors existing `logPrompts` pattern)
- Exportable as JSON or forwarded to a SIEM / logging service

#### Rate Limiting `[idea]`

- Per-user and per-workspace limits: max N agent runs per hour
- Prevents runaway costs from a misconfigured client or a loop
- Returns a structured `RATE_LIMITED` error (fits existing ErrorClass pattern)

#### SSO / Identity `[idea]`

- OIDC / SAML integration for enterprise identity providers
- Token maps to a set of allowed workspace IDs
- Session scoped to the authenticated identity

#### Workspace Templates `[idea]`

- Pre-configured prompt templates for common tasks: "write tests", "review this PR", "summarise recent changes"
- Exposed as MCP Prompts (already have a prompts registry)
- Team admins can add/remove templates without redeploying

#### Multi-server Federation `[idea]`

- One GUI, multiple backend MCP servers (e.g. one per environment: dev, staging, prod)
- GUI routes workspace selections to the correct backend
- Prod servers can have stricter rate limits and RBAC

---

## Open Questions

- **Interactive sessions:** `run_agent` is batch/one-shot. Truly interactive back-and-forth (agent asks a clarifying question mid-run, user answers, agent continues) needs a different execution model. How does this fit with the session tools?
- **GUI client vs MCP client:** Should the GUI *be* an MCP client, or should it talk to a thin REST API layer that wraps the MCP tools? The REST layer is simpler to build a UI against.
- **Workspace metadata:** Beyond name and path, what metadata is useful? Language, framework, team owner, last commit? Where does it come from — config, git, filesystem scan?
- **Path confidentiality in existing tools:** The `workspace` raw-path param on `run_agent` currently exposes paths. If we go workspace-ID-only, is backwards compatibility worth maintaining for local dev use?
- **Monetisation:** Open-source core (v1–v3), paid hosted service or enterprise license (v4–v5)? Or fully open?

---

## Ideas Parking Lot

Raw ideas that need more thought before they move up:

- `watch_workspace` tool — run agent on file-change events (inotify / FSEvents), like a CI trigger
- Prompt library resource — shared prompts stored server-side, listed via MCP resources
- Agent chaining — output of one `run_agent` call feeds as context into the next, orchestrated server-side
- Cost estimation — before running, estimate token cost based on workspace size and prompt length
- Diff preview — agent proposes changes, user approves before they are written to disk
- Multi-repo context — agent has read access to N repos but write access to only one (cross-repo awareness)
- Mobile companion app — approve/reject agent actions from your phone while it runs on the server

---

*Last updated: 2026-04-24*
