# Product Requirements Document: Cursor CLI Local MCP

**Document status:** Active  
**Last updated:** 2026-04-21  
**Owner:** Dev Shah  
**Version:** 2.0

---

## 1. Summary

This product is a **local Model Context Protocol (MCP) server** written in TypeScript that lets **external MCP clients** (Claude Desktop, Claude Code, or any MCP-compliant host) trigger and control **Cursor's terminal agent** (`agent` CLI) with explicit prompts, model selection, safety boundaries, and session-oriented workflows.

The server runs as a **stdio MCP process**, is configured once per host, and exposes a small stable tool surface that maps 1:1 to documented `agent` CLI capabilities.

---

## 2. Problem Statement

Teams and power users want to orchestrate Cursor's coding agent from tools that speak MCP — not only from the Cursor UI. Without a dedicated bridge, every integration reimplements subprocess calls, flag combinations, output capture, and auth handling ad hoc.

Specific pain points:
- No standard way to invoke `agent -p` with validated, consistent flags from an MCP host.
- No operator-level guardrails (workspace scope, sandbox, shell allowlists) when automation runs unattended.
- No reusable session continuity across agent invocations from external tools.

---

## 3. Goals

| ID | Goal |
|----|------|
| G1 | Expose a **small, stable set of MCP tools** that map to documented `agent` CLI capabilities. |
| G2 | Allow callers to specify **prompt**, **model**, **mode** (agent / plan / ask), **workspace**, optional **worktree** isolation, **output format**, and **sandbox** behavior. |
| G3 | Document and support **operator-level limits** via Cursor's CLI permission configuration (`cli-config.json` / `.cursor/cli.json`). |
| G4 | **Local-first**: stdio MCP by default; secrets in env and config files, never in tool arguments. |
| G5 | Provide a **validated test path** using Claude or any MCP host without requiring Cursor IDE for day-to-day orchestration. |
| G6 | **Aggregated output for MVP**: all tool responses return complete output; streaming via MCP notifications is a Phase 3 feature. |

---

## 4. Non-Goals

| ID | Non-goal | Rationale |
|----|----------|-----------|
| NG1 | Reimplement Cursor's agent or models | Delegates to installed `agent` binary. |
| NG2 | Replace ACP for full session UX | ACP handles streaming, permission RPC, extension methods — this MCP layer wraps CLI only. |
| NG3 | Guarantee parity with Cursor IDE MCP consumption | External clients only; Cursor's own MCP config is a separate concern. |
| NG4 | Team dashboard MCP policies | Out of scope until explicitly required. |
| NG5 | Remote MCP (HTTP/SSE) transport | stdio only for MVP; HTTP/SSE transport deferred to Phase 4+. |
| NG6 | Streaming output to MCP clients | MVP returns aggregated output; streaming deferred to Phase 3. |

---

## 5. Resolved Design Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Streaming vs. aggregated output | **Aggregated for MVP** | Simplifies state management; streaming via MCP notifications added in Phase 3 once tool surface is stable. |
| Session commands (FR-M3–M5) scope | **Gated behind CLI validation task** | If `agent session` commands are not reliably documented, session branches are cancelled without blocking Phase 2. |
| CI target | **GitHub Actions** | Standard, agent-compatible, free for public repos. |
| Language & runtime | **TypeScript + Node.js** | MCP SDK is TS-first; Zod gives schema-derived types; most community MCP server examples are TS. |
| Test framework | **Vitest** | Fast, ESM-native, good TS support, watch mode. |
| Input validation | **Zod** | Schemas generate both runtime validators and TypeScript types; used for all tool input validation. |
| Path allow-listing | **Required for workspace/worktree args** | Prevents path traversal attacks via malicious MCP prompts. |
| Error format | **Structured error taxonomy** | All errors surface exit code, stderr excerpt, error class — defined in API_SPEC.md. |

---

## 6. Users and Personas

### 6.1 Personas

- **Automation engineer:** Wires Claude or internal bots to run repo-scoped tasks in CI-like flows.
- **Developer:** Uses the MCP server from a desktop MCP host to kick off `agent -p` runs with known flags.
- **Operator:** Owns `cli.json` permissions, API keys, sandbox defaults, and path allowlists.

### 6.2 Representative Scenarios

1. **One-shot task:** "Run agent in print mode with JSON output, fixed model, sandbox enabled, scoped workspace."
2. **Session continuity:** List sessions, create chat, resume by id — contingent on CLI validation gate.
3. **Safety-first:** Deny broad `Shell`/`Write` via CLI permissions; use Git worktree for isolation.
4. **Downstream MCP:** Agent run must approve or use other MCP servers — operator configures `--approve-mcps` and `Mcp(server:tool)` permissions intentionally.

---

## 7. Conceptual Architecture

### 7.1 Layer Map

| Layer | Direction | Role |
|-------|-----------|------|
| **MCP server (this product)** | External MCP host → this server → spawns `agent` | Primary deliverable. |
| **Cursor Agent (`agent`)** | Cursor's runtime executes tasks | Invoked locally via subprocess with documented flags. |
| **ACP** | External client ↔ `agent acp` | Optional Phase 3+ companion for streaming sessions. |

### 7.2 High-Level Flow

```
[MCP host: Claude Desktop / Claude Code]
    → stdio MCP
        → [cursor-cli-mcp server]
            → Zod validation
            → path allow-list check
            → subprocess: `agent` / `agent -p` / session helpers
                → ring-buffer output capture (configurable max bytes)
                → structured error on non-zero exit
            → MCP tool result (aggregated)
```

### 7.3 Output Capture Strategy

- Uses `child_process.spawn` (never `exec` or `shell: true`).
- stdout and stderr captured independently into ring buffers.
- Configurable `MAX_OUTPUT_BYTES` (default: 512 KB); older bytes dropped when limit hit.
- Configurable `AGENT_TIMEOUT_MS` (default: 120,000 ms); SIGTERM on timeout, then SIGKILL after 5s.
- Final result includes: stdout content, stderr excerpt (last 2 KB), exit code, timed_out flag.

---

## 8. Functional Requirements

### 8.1 MVP — MCP Tools

| Req ID | Tool name | Description |
|--------|-----------|-------------|
| FR-M1 | `run_agent` | Accept prompt + optional CLI params: model, mode (agent/plan/ask), workspace (allow-listed), worktree (allow-listed), sandbox, output format (text/json), approve_mcps. Execute via `agent -p`. Return aggregated result. |
| FR-M2 | `list_models` | Invoke `agent models` or equivalent; return array of available model identifiers. |
| FR-M3 | `session_list` | List prior chats/sessions. **Gated:** only implemented if `agent session list` confirmed in CLI validation task. |
| FR-M4 | `session_create` | Create a new empty chat/session id. **Gated:** same condition as FR-M3. |
| FR-M5 | `session_resume` | Resume a specified session or continue previous per CLI flags. **Gated:** same condition as FR-M3. |
| FR-M6 | `agent_status` | Invoke `agent status` / `agent about` or equivalent; return auth status, version, and binary path. |

### 8.2 MCP Resources

| Req ID | Resource | Description |
|--------|----------|-------------|
| FR-R1 | `cli-permissions-reference` | Static doc pointing operators to `~/.cursor/cli-config.json` and `.cursor/cli.json` permission shapes. |
| FR-R2 | `rules-discovery` | Documents that CLI loads `.cursor/rules`, `AGENTS.md`, `CLAUDE.md`; explains how instructions enter agent without overloading each request. |

### 8.3 MCP Prompt Templates

| Req ID | Prompt | Description |
|--------|--------|-------------|
| FR-P1 | `plan-only` | Pre-filled user flow for `--mode=plan`. |
| FR-P2 | `ask-only` | Pre-filled for read-only `--mode=ask`. |
| FR-P3 | `worktree-isolation` | Pre-filled template including `--worktree` and workspace path. |

### 8.4 Configuration and Environment

| Req ID | Requirement |
|--------|-------------|
| FR-C1 | Configurable path to `agent` binary; default to Cursor install locations for macOS and Linux. |
| FR-C2 | No secrets in MCP tool arguments; use env vars (`CURSOR_API_KEY`, etc.). |
| FR-C3 | Clear structured errors when `agent` is missing, login required, or subprocess fails. |
| FR-C4 | Configurable `MAX_OUTPUT_BYTES` and `AGENT_TIMEOUT_MS` via env vars. |
| FR-C5 | Configurable path allowlist for `workspace` and `worktree` arguments; default deny all paths not explicitly listed. |

### 8.5 Security and Safety

| Req ID | Requirement |
|--------|-------------|
| FR-S1 | Document that non-interactive print mode is powerful; pair with sandbox, CLI permissions, and optional worktree. |
| FR-S2 | Do not encourage disabling approvals without documenting risk (`--approve-mcps`, `--force`/`--yolo`, `--trust`). |
| FR-S3 | Recommend minimal `Mcp(server:tool)` and `Shell` allowlists in CLI config for automated profiles. |
| FR-S4 | Validate and allow-list `workspace` and `worktree` path arguments before passing to subprocess. |
| FR-S5 | Never use `shell: true` in subprocess invocation. |
| FR-S6 | Never log prompt text at INFO level; log at DEBUG only with explicit opt-in env var. |

---

## 9. Non-Functional Requirements

| Req ID | Category | Requirement |
|--------|----------|-------------|
| NFR-1 | Reliability | Subprocess timeouts configurable; ring-buffer output capture with configurable max. |
| NFR-2 | Observability | Structured JSON logging to stderr for server lifecycle and each `agent` invocation. |
| NFR-3 | Packaging | Published as stdio MCP server; `mcp.json` snippet documented for consumers. |
| NFR-4 | Testing | Unit tests with mocked executor; integration tests against real `agent` binary; smoke test matrix per phase. |
| NFR-5 | CI | GitHub Actions: lint → typecheck → unit tests → integration tests (if agent binary available). |
| NFR-6 | Cold start | Server must respond to MCP `initialize` within 500ms on standard hardware. |

---

## 10. Dependencies and Assumptions

- Cursor CLI (`agent`) installed and authenticated (`agent login`, `CURSOR_API_KEY`, or documented alternative).
- Callers understand the two permission systems: Cursor IDE `~/.cursor/permissions.json` vs CLI `cli.json`.
- MCP hosts maintain their own server configuration; this repo provides example entries only.
- Node.js >= 20 installed on host machine.
- TypeScript toolchain available for development (not required at runtime — server ships compiled JS).

---

## 11. Success Metrics

| Metric | Target |
|--------|--------|
| Time to first successful `agent -p` from MCP host | < 15 minutes for a prepared user following README |
| MVP tool coverage | FR-M1, M2, M6 callable from Claude Desktop or Claude Code |
| Session tool coverage | FR-M3–M5 callable if CLI validation gate passes |
| Security incident | Zero default configs that enable unrestricted `Shell`/`Write` without documented opt-in |
| Cold start | MCP `initialize` response < 500ms |
| Output capture | No OOM on 512 KB output; truncation logged clearly |

---

## 12. Phasing

| Phase | Branch prefix | Scope |
|-------|--------------|-------|
| **Phase 0** | `feat/phase-0-scaffold` | TypeScript project scaffold, CI, lint, build pipeline |
| **Phase 1** | `feat/phase-1-*` | MCP server boilerplate + agent executor (subprocess wrapper) |
| **Phase 2** | `feat/phase-2-*` | All FR-M tools; CLI validation gate for session tools |
| **Phase 3** | `feat/phase-3-*` | FR-R resources, FR-P prompt templates, streaming MCP notifications |
| **Phase 4** | `feat/phase-4-*` | Security hardening pass, ACP-adjacent utilities |

---

## 13. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Cursor CLI flags change between versions | Pin tested version in CI; integration tests run `agent --help` diff on each CI run. |
| Session CLI commands not reliably available | CLI validation gate in Phase 2; session branches cancelled if unconfirmed. |
| Confusion between MCP and ACP | Architecture section in ARCHITECTURE.md kept prominent; Cursor docs linked. |
| Credential exposure | Env-based auth; no token logging; FR-C5 path allowlist. |
| Prompt injection via `workspace` arg | Path allow-list validation (FR-S4) required before any subprocess call. |
| Unbounded output causing OOM | Ring buffer with configurable cap (FR-C4). |

---

## 14. Open Questions (Resolved)

| Question | Resolution |
|----------|-----------|
| Streaming vs aggregated? | Aggregated for MVP; streaming in Phase 3. |
| Sessions in MVP? | Gated behind CLI validation task. |
| CI target? | GitHub Actions. |
| Language? | TypeScript + Vitest. |
| Minimum `agent` version? | Document tested version in README; warn on mismatch. |
| Remote MCP? | Out of scope (NG5); stdio only. |
| Naming / identifier? | `cursor-cli-mcp` — used in `mcp.json` and npm package name. |

---

## 15. References

- [Cursor CLI MCP](https://cursor.com/docs/cli/mcp)
- [Using Agent in CLI](https://cursor.com/docs/cli/using)
- [CLI parameters](https://cursor.com/docs/cli/reference/parameters)
- [Model Context Protocol overview](https://cursor.com/docs/mcp)
- [CLI permissions](https://cursor.com/docs/cli/reference/permissions)
- [ACP](https://cursor.com/docs/cli/acp)
- [permissions.json (IDE)](https://cursor.com/docs/reference/permissions)

---

## 16. Document History

| Date | Version | Change |
|------|---------|--------|
| 2026-04-21 | 1.0 | Initial PRD draft |
| 2026-04-21 | 2.0 | Resolved all open questions; added security reqs FR-S4–S6; added NFR-5/6; aligned with confirmed tech stack |
