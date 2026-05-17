# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [1.0.2] - 2026-05-16

Documentation and tooling release. No runtime changes.

### Added
- `CONTRIBUTING.md` — contributor guide covering dev setup, branch model, issue/PR guidelines, code standards, and project structure
- `CHANGELOG.md` — this file; backfilled for v1.0.0 and v1.0.1
- Release workflow documented in `docs/BRANCH_STRATEGY.md` (changelog update, version bump, tagging, GitHub Release steps)

### Fixed
- `package-lock.json` package name and version out of sync with `package.json` (no dependency changes)
- README `## Development` section condensed; full contributor guide moved to `CONTRIBUTING.md`

---

## [1.0.1] - 2026-05-16

Documentation-only release.

### Fixed
- README: `WORKSPACE_ALLOWLIST` example now shows multiple paths separated by `;`
- README: `npx` promoted as the primary setup method; clone-based flow moved to the Development section

---

## [1.0.0] - 2026-05-16

Initial public release — published to npm as [`@devshah7/cursor-cli-mcp`](https://www.npmjs.com/package/@devshah7/cursor-cli-mcp).

### Added

**MCP Tools**
- `run_agent` — run a prompt through the Cursor agent CLI in `agent`, `plan`, or `ask` mode with real-time streaming output
- `list_models` — list all model identifiers available to the CLI
- `agent_status` — check CLI authentication status and binary version
- `session_create` — create a new chat session and return its ID
- `session_resume` — resume an existing session with a follow-up prompt

**MCP Resources**
- `cli-permissions-reference` — what the agent CLI can and cannot do
- `rules-discovery` — how to locate `.cursorrules` / `AGENTS.md` files

**MCP Prompts**
- `plan-only` — constrains the agent to plan mode only
- `ask-only` — read-only Q&A, no file edits
- `worktree-isolation` — run the agent in an isolated git worktree

**Server**
- Layered architecture with a strict dependency boundary (`tools/` → `ports/` → `adapters/`) preventing layer violations
- `WORKSPACE_ALLOWLIST` path allowlist as the primary security control — empty list denies all workspace operations, no allow-all mode
- `child_process.spawn` with `shell: false` for all subprocess invocations
- Zod validation on all tool inputs
- Structured errors (`StructuredError`) returned for all failure modes
- Ring buffer output capture with configurable `MAX_OUTPUT_BYTES` ceiling
- `stdout` reserved exclusively for MCP JSON-RPC transport; all logging to stderr
- Real-time stdout streaming forwarded as MCP `logging/message` notifications
- `SESSION_CREATE_TIMEOUT_MS` safety net for `session_create` (Cursor CLI `create-chat` can hang after printing the ID)
- `--trust` flag always passed; `--sandbox` takes `enabled` / `disabled` values
- `--max-turns` intentionally absent — not supported by this CLI version

**Tooling**
- TypeScript ~5.4, Node.js >= 20
- Vitest unit test suite
- ESLint + `tsc --noEmit` gate check
- GitHub Actions CI (`lint`, `typecheck`, `build`, `test:unit`)
- `npm run setup` for one-command Claude Desktop config installation

[Unreleased]: https://github.com/devshah7/cursor-cli-mcp/compare/v1.0.2...HEAD
[1.0.2]: https://github.com/devshah7/cursor-cli-mcp/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/devshah7/cursor-cli-mcp/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/devshah7/cursor-cli-mcp/releases/tag/v1.0.0
