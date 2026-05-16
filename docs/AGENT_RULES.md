# Agent Rules: cursor-cli-mcp

**Last updated:** 2026-04-24  
**Status:** Mandatory — every AI agent working on this repo must read this file before writing any code.

These rules exist to eliminate chaos when multiple agents work in parallel. They are non-negotiable. If a rule conflicts with an agent's instinct to "clean up" or "improve" something, the rule wins.

---

## Rule 0: Read Before You Write

Before touching any file, read these documents in order:

1. `CLAUDE.md` — project context and agent operating instructions
2. `docs/ARCHITECTURE.md` — module responsibilities, constraints, dependency graph
3. `docs/API_SPEC.md` — exact schemas for every tool
4. `docs/BRANCH_STRATEGY.md` — which branch you are on, what it may touch
5. `docs/TASK_LIST.md` — which task you are implementing

If any of these documents contradict each other, stop and report the conflict rather than resolving it yourself.

---

## Rule 1: One Branch, One Concern

Your branch has a single stated concern (see BRANCH_STRATEGY.md). You may ONLY touch the files listed for that branch.

**Forbidden:**
- Refactoring files outside your branch's scope "while you're in there."
- Adding error handling to a file your branch doesn't own.
- Fixing lint warnings in files unrelated to your task.
- Updating docs other than `TASK_LIST.md` (to mark tasks complete).

**Exception:** If you find a bug in a file outside your scope that blocks your work, open a new issue/task and document it. Do not fix it inline.

---

## Rule 2: Never Commit Directly to `main`

All work goes on a feature branch. PRs only. No exceptions.

---

## Rule 3: No Subprocess Shell Injection — Ever

When building CLI args for `child_process.spawn`:

**ALWAYS:**
```typescript
// Build args as an array
const args = ["-p", prompt];
if (model) args.push("--model", model);
spawn(binaryPath, args, { shell: false });
```

**NEVER:**
```typescript
// Never concatenate user input into a command string
exec(`agent -p "${prompt}"`);
spawn("sh", ["-c", `agent -p ${prompt}`]);
spawn(binaryPath, args, { shell: true });
```

The `shell: true` option is forbidden. ESLint will flag it. If it doesn't, the code review gate will catch it.

---

## Rule 4: Validate Before Spawning

Every tool handler must validate inputs in this exact order before calling the executor:

```
1. Zod schema parse → throw on failure (VALIDATION error)
2. security.validatePaths() for any path arguments → throw on failure (SECURITY error)
3. executor.run() → handle ExecutorResult
```

Skipping either validation step is a security bug, not a style preference.

---

## Rule 5: Structured Errors Only

All error responses from tool handlers must use `StructuredError` from `src/errors.ts`. Raw JavaScript Error objects, raw exception messages, or untyped objects must never be returned to MCP callers.

```typescript
// CORRECT
return buildError(ErrorClass.AGENT_ERROR, "Agent exited with code 1", { exitCode: 1, stderrExcerpt });

// WRONG
throw new Error("something went wrong");
return { error: "agent failed" };
```

---

## Rule 6: stdout Is the MCP Transport — Never Write to It

`console.log()` is forbidden anywhere in `src/`. It writes to stdout, which breaks the MCP JSON-RPC transport.

Use only `logger.ts` which writes to stderr.

**ESLint rule:** `no-console` is enabled. Any `console.*` call will fail the lint gate.

---

## Rule 7: No Floating Promises

Every `async` function call must be `await`ed or explicitly `.catch()`-ed. Floating promises cause silent failures in MCP request handling.

```typescript
// CORRECT
await executor.run(options);

// WRONG
executor.run(options);  // floating promise
```

ESLint rule `@typescript-eslint/no-floating-promises` is enabled.

---

## Rule 8: No `any` Without Justification

TypeScript `any` types are forbidden without an inline comment explaining exactly why it's necessary and why a proper type can't be used.

```typescript
// CORRECT (with justification)
const rawResult = JSON.parse(output) as unknown; // SDK returns untyped JSON

// WRONG
const result: any = executor.run();
```

ESLint rule `@typescript-eslint/no-explicit-any` is enabled.

---

## Rule 9: Never Log Prompt Text at INFO or Above

Prompt text is potentially sensitive. It must never appear in logs unless `LOG_PROMPTS=true` is explicitly set, and even then only at `debug` level.

```typescript
// CORRECT
logger.debug("Running agent", { promptLength: prompt.length });
if (config.logPrompts) logger.debug("Prompt text", { prompt });

// WRONG
logger.info("Running agent with prompt", { prompt });
logger.error("Failed to run", { prompt });
```

---

## Rule 10: Do Not Add Untested Code

Every new function in `src/` must have at least one corresponding test in `tests/unit/`. The test must run and pass before you push.

The Phase gate requires minimum test counts per file (see TESTING_STRATEGY.md). Do not merge without meeting those counts.

---

## Rule 11: Gate Checklist Before Every Push

Run this before every `git push`:

```bash
npm run lint        # must exit 0
npm run typecheck   # must exit 0
npm run build       # must exit 0
npm run test:unit   # must exit 0
```

If any command fails, fix it before pushing. Do not push a broken branch.

---

## Rule 12: Update TASK_LIST.md When You Complete a Task

When you finish a task from TASK_LIST.md, mark it complete in that file as part of the same commit. Do not leave task states stale.

Format: change `[ ]` to `[x]` and add the completion date.

---

## Rule 13: Respect Module Boundaries

Modules have defined dependency rules in ARCHITECTURE.md section 9. Do not violate them:

- `src/adapters/agentCli/` must NOT import from `src/tools/`, `src/server.ts`, or MCP SDK types.
- `src/tools/` must NOT import from `src/adapters/` — only from `src/ports/`.
- `src/security.ts` must NOT import from anything outside Node builtins.
- `src/logger.ts` must write ONLY to `process.stderr`.
- Tool handlers must NOT import from each other.

If you need shared logic between tools, add it to a new file and get it reviewed — do not copy-paste between tool files.

---

## Rule 14: Do Not Call validatePaths Inside Tool Handlers

`security.validatePaths()` is called centrally by `pipeline/toolPipeline.ts` **before** any tool handler is invoked. Do not call it again inside a handler — it would be redundant and could produce inconsistent error types if the pipeline's centralized call already passed.

Tool handlers receive only pre-validated, allowlisted paths. If a handler needs to reject a path for business reasons, throw a `StructuredError` with `errorClass: VALIDATION`.

---

## Rule 15: Interface-Changing Branches Must Merge First

If your branch changes a shared interface (a type, a port contract, or a cross-cutting module like `ExecutorOptions`, `AgentCommand`, `PipelineContext`, `ToolDescriptor`, `Config`), it **must be merged to `dev` before any other branch that depends on that interface opens a PR or merges**.

**Why this matters:** Branches that each pass CI in isolation can break `dev` after merging if one changes an interface that another branch tests against. The full test suite on `dev` is the only gate that catches this — individual branch CI does not.

**How to handle it:**

1. **Before opening a PR** — check whether any in-flight branch touches the same interface. If yes, coordinate merge order explicitly.
2. **Interface-changing branch merges first.** All dependent branches must `git rebase origin/dev` after that merge and re-run the full gate checklist before pushing.
3. **After any merge to `dev`** — run `npm run test:unit` on `dev` locally before declaring the phase complete. Do not rely solely on per-branch CI.
4. **If `dev` breaks after a merge** — fix it on `dev` directly with a targeted commit. Do not revert the merged PR; isolate and patch the specific incompatibility.

**Interfaces to watch for cross-branch conflicts:**

| Interface | File | Risk |
|-----------|------|------|
| `AgentCommand` / `ExecutorOptions` | `src/ports/executorTypes.ts` | Any branch touching executor or tools |
| `IAgentExecutor` | `src/ports/agentExecutor.ts` | Executor and all tool tests |
| `PipelineContext` | `src/pipeline/toolPipeline.ts` | Pipeline, server, and all tool tests |
| `ToolDescriptor` | `src/registry/tools.ts` | Registry, server, and all tool descriptors |
| `Config` | `src/config.ts` | Config tests, server wiring, all tool tests |

---

## Rule 16: Conflicts Go to Humans

If you encounter a merge conflict you cannot resolve cleanly by following ARCHITECTURE.md, stop and flag it. Do not guess at the intended behavior. Do not pick "ours" or "theirs" arbitrarily.

The correct resolution for conflicts in `src/server.ts` (tool registrations) is always: keep ALL registrations.

---

## Rule 17: Streaming Descriptor Contract

Any tool handler that reads `toolCtx.sendNotification` (to stream stdout chunks to the client) **must** set `supportsStreaming: true` on its tool descriptor in `src/registry/tools.ts`.

If the flag is missing, `server.ts` never injects the callback and the handler's streaming branch is silently dead — the exact failure mode fixed for `session_resume` in Phase 6.

---

## Forbidden Patterns (Quick Reference)

| Pattern | Why forbidden |
|---------|--------------|
| `shell: true` in spawn | Command injection risk |
| `exec()` or `execSync()` | Same — use `spawn` only |
| `console.log()` | Breaks MCP stdio transport |
| `any` without comment | Hides type errors |
| Floating `Promise` | Silent async failures |
| Committing to `main` | Breaks deployable baseline |
| Logging prompt text at INFO | Privacy/security |
| Touching files outside branch scope | Creates conflicts, hidden coupling |
| Raw errors to MCP caller | Leaks internal state, breaks client parsing |
| `JSON.parse()` without try/catch | Unhandled crash on bad agent output |
| Merging interface-changing branch out of order | Breaks `dev` even when per-branch CI was green |
| Skipping `npm run test:unit` on `dev` after a merge | Only the merged state reveals cross-branch conflicts |
| `sendNotification` used in a handler without `supportsStreaming: true` | Callback never wired; streaming path is a no-op |
| Calling `security.validatePaths()` inside a tool handler | Pipeline already called it; duplicate call produces inconsistent errors |

---

## Commit Message Format

```
<type>(<scope>): <short description>

<optional body: what changed and why, if not obvious>
```

Types: `feat`, `fix`, `test`, `docs`, `chore`, `refactor`  
Scope: the phase and module, e.g. `phase-1`, `phase-2/run-agent`, `phase-0/ci`

Examples:
```
feat(phase-1): implement AgentExecutor with ring buffer output capture
test(phase-2/run-agent): add timeout and security error test cases
fix(phase-1): handle SIGTERM before SIGKILL on executor timeout
docs(phase-2): update TASK_LIST.md to mark T2.1 complete
```

---

## What Good Looks Like

A well-behaved agent session on this repo:

1. Reads `CLAUDE.md` and the four docs above.
2. Checks `docs/TASK_LIST.md` to identify which task to implement.
3. Checks `docs/BRANCH_STRATEGY.md` to confirm the branch is correct and dependencies are met.
4. Reads the exact files it will touch — no exploring unrelated parts of the codebase.
5. Implements the task, writes tests, runs gate checklist.
6. Updates TASK_LIST.md.
7. Opens PR with the required checklist filled out.
8. Does not touch anything outside its stated scope.
