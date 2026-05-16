# Contributing to cursor-cli-mcp

Thank you for your interest in contributing! This guide covers everything you need to get started — from setting up a local development environment to opening your first pull request.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Ways to Contribute](#ways-to-contribute)
- [Reporting Issues](#reporting-issues)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Opening a Pull Request](#opening-a-pull-request)
- [Code Standards](#code-standards)
- [Project Structure](#project-structure)

---

## Code of Conduct

Be respectful and constructive. We welcome contributors of all backgrounds and experience levels. Harassment or hostile behaviour in issues, PRs, or discussions will not be tolerated.

---

## Ways to Contribute

- **Bug reports** — found something broken? Open an issue.
- **Feature requests** — have an idea? Open an issue to discuss it before building.
- **Bug fixes** — pick up an open issue labelled `bug` and submit a fix.
- **Documentation** — improve clarity, fix typos, add examples.
- **Tests** — increase coverage or add regression tests for known edge cases.

If you want to work on something substantial, open an issue first so we can align before you invest time in it.

---

## Reporting Issues

Before opening an issue, please:

1. Search [existing issues](https://github.com/devshah7/cursor-cli-mcp/issues) to avoid duplicates.
2. Run `agent_status` via Claude Desktop to confirm the server is running — this rules out most config problems.
3. Check the [Troubleshooting section](./README.md#troubleshooting) in the README.

### Bug reports

Use the **Bug report** template and include:

- **Environment:** OS, Node.js version (`node --version`), package version
- **Steps to reproduce:** exact steps, minimal prompt or config
- **Expected behaviour:** what should have happened
- **Actual behaviour:** what actually happened, including any error codes
- **Logs:** set `LOG_LEVEL=debug` in your MCP server env and paste the relevant stderr output

### Feature requests

Use the **Feature request** template and include:

- The problem you're trying to solve (not just the solution you have in mind)
- Your proposed approach and any alternatives you considered
- Any known limitations of the Cursor CLI that affect feasibility

---

## Development Setup

### Prerequisites

- **Node.js >= 20** — [nodejs.org](https://nodejs.org)
- **Cursor CLI (`agent` binary)** — see [README prerequisites](./README.md#cursor-cli-agent-binary)
- **git**

### Clone and install

```bash
git clone https://github.com/devshah7/cursor-cli-mcp.git
cd cursor-cli-mcp
npm install
```

### Point Claude Desktop at your local build

Instead of using the npm package, update your Claude Desktop config to run your compiled output:

```json
{
  "mcpServers": {
    "cursor-cli-mcp": {
      "command": "node",
      "args": ["/path/to/cursor-cli-mcp/dist/index.js"],
      "env": {
        "AGENT_BINARY_PATH": "/Users/you/.local/bin/cursor-agent",
        "WORKSPACE_ALLOWLIST": "/Users/you/projects"
      }
    }
  }
}
```

Run `npm run build` after any change to recompile before restarting Claude Desktop.

### Gate check

All four commands must exit 0 before you open a PR:

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run build       # compile to dist/
npm run test:unit   # Vitest unit tests
```

---

## Making Changes

### Branch naming

All work branches off `dev` and PRs back into `dev`. `main` is production — never target it directly.

```bash
git checkout dev
git pull origin dev
git checkout -b <type>/<short-description>
```

| Type | Pattern | Example |
|------|---------|---------|
| Bug fix | `fix/<description>` | `fix/session-create-timeout` |
| Feature | `feat/<description>` | `feat/new-tool` |
| Docs | `docs/<description>` | `docs/update-readme` |
| Refactor | `refactor/<description>` | `refactor/pipeline-cleanup` |
| Test | `test/<description>` | `test/executor-coverage` |
| Chore | `chore/<description>` | `chore/bump-deps` |

Keep each branch focused on a single concern. Do not mix unrelated changes.

### Commit messages

Use the conventional commits format:

```
<type>(<scope>): <short summary>

<optional body explaining why, not what>
```

Examples:
```
fix(session): cap create-chat timeout via SESSION_CREATE_TIMEOUT_MS
feat(tools): add session_resume support for follow-up prompts
docs(readme): clarify WORKSPACE_ALLOWLIST security model
```

### Architecture rules

This project has a strict layered architecture. Before writing code, read [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md). Key rules:

- `tools/` may only import from `ports/` — never from `adapters/`
- `adapters/` may only import from `ports/` — never from `tools/`
- CLI flag names live **only** in `src/adapters/agentCli/argBuilder.ts`
- Never write to stdout — use `logger.ts` (stderr only); stdout is the MCP transport
- Always use `child_process.spawn` with `shell: false` — never `exec`, `execSync`, or `shell: true`

---

## Opening a Pull Request

1. Push your branch and open a PR targeting `dev`:

   ```bash
   git push -u origin feat/my-change
   gh pr create --base dev
   ```

2. Fill out the PR template. Every PR description must include the following checklist:

   ```markdown
   ## Checklist
   - [ ] `npm run lint` exits 0
   - [ ] `npm run typecheck` exits 0
   - [ ] `npm run build` exits 0
   - [ ] `npm run test:unit` exits 0 with all tests passing
   - [ ] No new `any` types without an inline justification comment
   - [ ] No `shell: true` in any subprocess call
   - [ ] No secrets or tokens in code or test fixtures
   - [ ] Targets `dev` (not `main`)
   ```

3. CI will run the gate check automatically. Fix any failures before requesting review.

4. Keep the PR small and focused. Large PRs are harder to review and slower to merge. If your change is substantial, consider splitting it.

5. Respond to review feedback promptly. Unanswered review comments will stall the PR.

### What happens after merge

Feature branches merge into `dev`. When `dev` is stable and ready for a release, a `dev → main` PR is opened with title `release: vX.Y.Z`. You do not need to manage this — the maintainer handles release promotion.

---

## Code Standards

| Rule | Detail |
|------|--------|
| **No `console.log`** | Use `logger.ts` everywhere in `src/` |
| **No `any`** | If unavoidable, add an inline comment explaining why |
| **No floating promises** | Await all async calls or explicitly handle them |
| **No `shell: true`** | Use `spawn(binary, argsArray, { shell: false })` |
| **No `exec` / `execSync`** | `spawn` only |
| **Zod for validation** | All tool inputs are validated with Zod schemas |
| **StructuredError for errors** | Tool handlers return `StructuredError` — never raw exceptions |
| **Comments only when necessary** | Explain *why*, not *what*. No docblock walls. |
| **No layer violations** | Respect the import rules described in ARCHITECTURE.md |

---

## Project Structure

```
src/
  index.ts                    # Composition root — DI wiring only
  server.ts                   # MCP SDK adapter
  config.ts                   # Env var loading and validation
  security.ts                 # Path allowlist enforcement
  errors.ts                   # StructuredError types
  logger.ts                   # Structured stderr logging
  pipeline/
    toolPipeline.ts           # validate → security → execute → map
  registry/
    tools.ts                  # Tool descriptor registry
  tools/                      # One file per MCP tool
  resources/                  # Static MCP resource content
  prompts/                    # MCP prompt templates
  ports/
    agentExecutor.ts          # IAgentExecutor interface (dependency boundary)
  adapters/
    agentCli/
      executor.ts             # AgentCliExecutor implementation
      argBuilder.ts           # ALL CLI flag knowledge lives here
      ringBuffer.ts           # Output capture primitive
docs/
  ARCHITECTURE.md             # Module layout and dependency rules
  API_SPEC.md                 # Tool, resource, and prompt schemas
  BRANCH_STRATEGY.md          # Full branching rules
  TASK_LIST.md                # Authoritative task tracker
tests/
  unit/                       # Vitest unit tests
```

For a deeper dive into the architecture, read [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## Questions?

Open a [GitHub Discussion](https://github.com/devshah7/cursor-cli-mcp/discussions) or file an issue with the `question` label. We're happy to help.
