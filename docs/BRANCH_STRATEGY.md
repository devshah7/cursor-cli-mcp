# Branch Strategy: cursor-cli-mcp

**Last updated:** 2026-04-22  
**Status:** Authoritative — all agents and contributors must follow this exactly.

---

## 1. Branch Model

```
main  ← production (v1 and beyond). Never commit directly.
  │
  └─ dev  ← integration branch. All feature branches target this.
              │
              ├─ fix/<description>
              ├─ feat/<description>
              ├─ docs/<description>
              └─ refactor/<description>
```

### Rules

1. **`main` is production.** It reflects the latest released version. Direct commits are forbidden. Only PRs from `dev` merge here, and only when a new version is ready to ship.
2. **`dev` is the integration branch.** All feature, fix, docs, and refactor branches are created from `dev` and PR back into `dev`.
3. **Every branch targets exactly one concern.** No mixing unrelated changes.
4. **PRs require CI green** (`lint`, `typecheck`, `build`, `test:unit` all pass) before merge.
5. **No `any` types** without an inline justification comment.
6. **No `shell: true`** in any subprocess call, ever.
7. **Never force-push `main` or `dev`.** Force-push is allowed only on your own short-lived feature branch (e.g. after a rebase).

---

## 2. Branch Naming

| Type | Pattern | Example |
|------|---------|---------|
| Bug fix | `fix/<short-description>` | `fix/trust-flag` |
| Feature | `feat/<short-description>` | `feat/session-list` |
| Docs | `docs/<short-description>` | `docs/readme-update` |
| Refactor | `refactor/<short-description>` | `refactor/pipeline-cleanup` |
| Test | `test/<short-description>` | `test/executor-timeout` |
| Chore | `chore/<short-description>` | `chore/bump-deps` |

---

## 3. Workflow

### Starting new work

```bash
git checkout dev
git pull origin dev
git checkout -b feat/my-feature
```

### Opening a PR

- **Base branch:** `dev` (not `main`)
- All CI checks must be green
- Include the PR checklist below in the description

### Releasing to production

When `dev` is stable and ready to ship:

1. Open a PR from `dev` → `main`
2. PR title: `release: vX.Y.Z`
3. Description summarises what changed since last release
4. Merge — this becomes the new production version

---

## 4. PR Checklist (Required for All PRs)

Every PR description must include:

```markdown
## Checklist
- [ ] `npm run lint` exits 0
- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm run test:unit` exits 0 with all tests passing
- [ ] No new `any` types without justification comment
- [ ] No `shell: true` in any subprocess call
- [ ] No secrets or tokens in code or test fixtures
- [ ] Targets `dev` (not `main`)
```

---

## 5. Layer Rules (Architecture)

The dependency direction is strict — violations will be caught in review:

```
Transport   (index.ts, server.ts)
    │ imports ↓
Application (pipeline/, registry/, tools/, resources/, prompts/)
    │ imports ↓
Ports       (ports/agentExecutor.ts)
    │ imports ↓
Infra       (adapters/agentCli/)

Cross-cutting (config.ts, security.ts, errors.ts, logger.ts) — importable by all layers
```

Key constraints:
- `tools/` imports from `ports/` — **never** from `adapters/`
- `adapters/` imports from `ports/` — **never** from `tools/`
- CLI flag names (`--mode`, `--workspace`, etc.) live **only** in `src/adapters/agentCli/argBuilder.ts`
- `stdout` is the MCP transport — **never** write to it from application code; use `logger.ts` (stderr only)

---

## 6. Merge Conflict Resolution

1. Rebase your branch onto the latest `dev`: `git rebase dev`
2. Resolve conflicts by following `docs/ARCHITECTURE.md` — the architecture doc is the source of truth
3. Run the full gate checklist after resolving
4. If the conflict is in `src/server.ts` (tool registration): keep all registrations — yours and the incoming branch's
5. If the conflict cannot be resolved cleanly, flag for human review — do not guess

---

## 7. Version History

| Version | Branch | Notes |
|---------|--------|-------|
| v1.0 | `main` | Phases 0–4 complete. Tools: `run_agent`, `list_models`, `agent_status`, `session_create`, `session_resume`. Resources + prompts. Streaming. Security hardening. |
