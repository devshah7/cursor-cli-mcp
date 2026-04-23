# MCP Testing Guide: cursor-cli-mcp

This guide walks through testing every tool, resource, and prompt exposed by the MCP server. All files and folders used during testing are created on the fly by the tools themselves — nothing is pre-made.

**The `testing/` folder at the repo root is gitignored.** Use it as your live workspace throughout this guide. It starts empty and fills up as you run scenarios.

---

## Before You Start

**1. Add the testing folder to your `WORKSPACE_ALLOWLIST`**

In your `claude_desktop_config.json`, append the absolute path to `testing/` in the `WORKSPACE_ALLOWLIST` env var:

```json
"WORKSPACE_ALLOWLIST": "/your/existing/paths:/absolute/path/to/cursor-cli-mcp/testing"
```

Restart Claude Desktop after saving.

**2. Run the baseline check**

Call `agent_status`. You should see:
- `authenticated: true`
- Your Cursor account email
- A valid `binaryPath`

If this fails, stop and fix the setup before continuing.

**3. Create the testing folder locally**

```bash
mkdir -p /absolute/path/to/cursor-cli-mcp/testing
```

---

## Scenario 1 — Baseline: `agent_status` and `list_models`

**Purpose:** Confirm the server is healthy and the binary is reachable before running anything else.

### 1A — `agent_status`

Call `agent_status` with no parameters.

✅ **Pass:** Response contains `authenticated: true`, a non-empty `binaryPath`, and your account email.  
❌ **Fail:** Any error, or `authenticated: false` — fix auth before proceeding.

---

### 1B — `list_models`

Call `list_models` with no parameters.

✅ **Pass:** Response contains an array of model identifier strings with at least 10 entries.  
❌ **Fail:** Empty array, error, or non-zero exit.

**Note:** Copy two or three model IDs from the response — you'll use them in Scenario 6.

---

## Scenario 2 — `run_agent`: Ask Mode (read-only)

**Purpose:** Confirm the agent can answer questions without touching files.

### 2A — Simple question, no workspace

Call `run_agent`:
```
prompt:  "What is the difference between TypeScript interfaces and types? Answer in 3 bullet points."
mode:    ask
```

✅ **Pass:** Response contains a clear answer. `exitCode: 0`. No files created anywhere.  
❌ **Fail:** Error, non-zero exit, or any indication files were created.

---

### 2B — Question about the testing folder

Call `run_agent`:
```
prompt:    "List all files in this directory and tell me how many there are."
mode:      ask
workspace: /absolute/path/to/cursor-cli-mcp/testing
```

✅ **Pass:** Agent reports the directory is empty or lists what's there. `exitCode: 0`.  
❌ **Fail:** Security error (check `WORKSPACE_ALLOWLIST`), or files appear in `testing/`.

---

### 2C — Multi-line complex prompt

Call `run_agent`:
```
prompt:  "I'm designing a small TypeScript utility library. I want functions for:
          1. Debouncing a function call
          2. Deep cloning an object
          3. Formatting a date as YYYY-MM-DD
          
          For each, describe: the function signature, edge cases to handle, and any caveats.
          Do not write any code."
mode:    ask
```

✅ **Pass:** Structured response covering all three. No files written. `exitCode: 0`.

---

## Scenario 3 — `run_agent`: Agent Mode — Creating Files

**Purpose:** Have the agent create real files in `testing/`. Everything used in later scenarios originates here.

### 3A — Create a calculator module

Call `run_agent`:
```
prompt:    "Create a file called calculator.ts in this directory. It should export four functions: add, subtract, multiply, divide. Each takes two numbers and returns a number. divide should throw an Error if the divisor is zero. Use TypeScript."
mode:      agent
workspace: /absolute/path/to/cursor-cli-mcp/testing
```

✅ **Pass:** `testing/calculator.ts` exists with all four functions. `exitCode: 0`.  
❌ **Fail:** File not created, wrong location, or incomplete implementation.

---

### 3B — Create a utility module

Call `run_agent`:
```
prompt:    "Create a file called utils.ts in this directory. It should export: (1) a function `chunk(arr, size)` that splits an array into chunks of a given size, (2) a function `capitalize(str)` that capitalises the first letter of each word, (3) a function `sleep(ms)` that returns a Promise that resolves after ms milliseconds. Use TypeScript."
mode:      agent
workspace: /absolute/path/to/cursor-cli-mcp/testing
```

✅ **Pass:** `testing/utils.ts` exists with all three functions.

---

### 3C — Create a file with intentional bugs

Call `run_agent`:
```
prompt:    "Create a file called buggy.ts in this directory. Write a TypeScript function called `average` that takes an array of numbers and returns their average. Intentionally introduce exactly two bugs: one logic bug and one type bug. Add a comment above the function that says: 'BUG: this function has two bugs, find and fix them'."
mode:      agent
workspace: /absolute/path/to/cursor-cli-mcp/testing
```

✅ **Pass:** `testing/buggy.ts` exists with the comment and two bugs present.

---

### 3D — Create a README for the testing workspace

Call `run_agent`:
```
prompt:    "Create a README.md in this directory. It should have a title 'Testing Workspace', a one-line description saying this is a scratch folder for MCP tool testing, and a file listing section that describes calculator.ts, utils.ts, and buggy.ts."
mode:      agent
workspace: /absolute/path/to/cursor-cli-mcp/testing
```

✅ **Pass:** `testing/README.md` exists with all sections.

---

## Scenario 4 — `run_agent`: Plan Mode

**Purpose:** Confirm plan mode returns a plan only and does not modify files.

### 4A — Plan a refactor

Note the current state of `testing/calculator.ts`, then call `run_agent`:
```
prompt:    "Refactor calculator.ts to use a class-based approach instead of standalone functions. The class should be called Calculator and all four operations should be methods. Plan only — do not make any changes."
mode:      plan
workspace: /absolute/path/to/cursor-cli-mcp/testing
```

✅ **Pass:** Response describes a refactor plan. `calculator.ts` is **unchanged** after the call.  
❌ **Fail:** File is modified.

---

### 4B — Plan a new feature

Call `run_agent`:
```
prompt:    "Plan how to add input validation to every function in utils.ts. For each function, describe what validation is needed and what error should be thrown for invalid inputs."
mode:      plan
workspace: /absolute/path/to/cursor-cli-mcp/testing
```

✅ **Pass:** Detailed plan returned. `utils.ts` unchanged.

---

## Scenario 5 — `run_agent`: Agent Mode — Editing Files

**Purpose:** Have the agent modify files it created in Scenario 3.

### 5A — Fix the bugs in buggy.ts

Call `run_agent`:
```
prompt:    "Find and fix both bugs in buggy.ts. After fixing, remove the BUG comment and replace it with a comment that says 'FIXED: both bugs resolved'."
mode:      agent
workspace: /absolute/path/to/cursor-cli-mcp/testing
```

✅ **Pass:** `buggy.ts` is updated. Both bugs fixed. Comment updated. `exitCode: 0`.

---

### 5B — Extend utils.ts

Call `run_agent`:
```
prompt:    "Add a fourth function to utils.ts called `truncate(str, maxLength, suffix?)` that truncates a string to maxLength characters and appends suffix (default '...') if truncated. Use TypeScript."
mode:      agent
workspace: /absolute/path/to/cursor-cli-mcp/testing
```

✅ **Pass:** `utils.ts` now has four exported functions including `truncate`.

---

### 5C — Create a subfolder and file

Call `run_agent`:
```
prompt:    "Create a subfolder called types/ inside this directory. Inside it, create index.ts that exports a TypeScript interface called CalculatorResult with fields: operation (string), operandA (number), operandB (number), result (number), timestamp (Date)."
mode:      agent
workspace: /absolute/path/to/cursor-cli-mcp/testing
```

✅ **Pass:** `testing/types/index.ts` exists with the interface.

---

## Scenario 6 — `run_agent`: Model Switching

**Purpose:** Confirm the `model` parameter works and different models return responses.

Use the model IDs noted from Scenario 1B. Run the same prompt with three different models:

```
prompt:  "In one sentence, what is the time complexity of binary search and why?"
mode:    ask
model:   <model-id>
```

Run it three times with three different model IDs.

✅ **Pass:** All three return `exitCode: 0` with a valid response. Responses may differ in wording.  
❌ **Fail:** Any model returns a non-zero exit or `AGENT_ERROR`.

---

## Scenario 7 — `run_agent`: Sandbox Flag

**Purpose:** Confirm the `sandbox` parameter is accepted without error.

### 7A — Sandbox enabled

Call `run_agent`:
```
prompt:    "List all .ts files in this directory without making any changes."
mode:      ask
workspace: /absolute/path/to/cursor-cli-mcp/testing
sandbox:   true
```

✅ **Pass:** `exitCode: 0`. Response lists files.

---

### 7B — Sandbox disabled

Call `run_agent`:
```
prompt:    "List all .ts files in this directory without making any changes."
mode:      ask
workspace: /absolute/path/to/cursor-cli-mcp/testing
sandbox:   false
```

✅ **Pass:** `exitCode: 0`. Response lists files.

---

## Scenario 8 — `run_agent`: Streaming Output

**Purpose:** Confirm `stream-json` output format is accepted and returns output.

Call `run_agent`:
```
prompt:        "Explain how async/await works in JavaScript. Cover: the event loop, Promises, how await pauses execution, and error handling with try/catch. Be thorough."
mode:          ask
output_format: stream-json
```

✅ **Pass:** `exitCode: 0`. Response is returned (may be aggregated depending on MCP client). No error about unsupported format.  
**Observe:** Note whether you see streaming chunks arriving progressively or a single aggregated response.

---

## Scenario 9 — Session Flow: `session_create` + `session_resume`

**Purpose:** Test the full session lifecycle.

### 9A — Create a session

Call `session_create` with no parameters.

✅ **Pass:** Response contains a `sessionId` UUID string (e.g. `8e8ddb1f-313d-4d93-9e34-a38b42198d9c`).  
**Note:** Copy the `sessionId` — you'll use it in 9B and 9C.  
**Note:** The process may take a moment or appear to hang briefly — this is a known Cursor CLI behaviour. The timeout is the safety net.

---

### 9B — Resume the session

Call `session_resume`:
```
session_id: <id from 9A>
prompt:     "What are the three most important principles of clean code? Answer in bullet points."
```

✅ **Pass:** `exitCode: 0`. A valid response is returned.  
**Note:** Session context preservation depends on the Cursor CLI — the response may or may not reference prior conversation. This is expected behaviour, not a bug.

---

### 9C — Resume again (follow-up)

Call `session_resume`:
```
session_id: <id from 9A>
prompt:     "Now give me a concrete TypeScript example for each principle you mentioned."
model:      claude-4-sonnet
```

✅ **Pass:** `exitCode: 0`. Response returned.

---

## Scenario 10 — Error Handling

**Purpose:** Confirm the server handles bad inputs cleanly without crashing.

### 10A — Workspace path not in allowlist

Call `run_agent`:
```
prompt:    "List files."
workspace: /tmp/not-allowed
```

✅ **Pass:** Returns a `SECURITY` error. Server does not crash.

---

### 10B — Empty prompt (schema validation)

Call `run_agent`:
```
prompt: ""
```

✅ **Pass:** Returns a `VALIDATION` error before the binary is called. `exitCode` not present.

---

### 10C — Oversized prompt

Call `run_agent` with a `prompt` that is 32,001 characters (any repeated character string).

✅ **Pass:** Returns a `VALIDATION` error. Binary is never called.

---

### 10D — Invalid session ID with path traversal

Call `session_resume`:
```
session_id: "../etc/passwd"
prompt:     "hello"
```

✅ **Pass:** Returns a `VALIDATION` error. Binary is never called.

---

### 10E — Invalid session ID with slash

Call `session_resume`:
```
session_id: "abc/def"
prompt:     "hello"
```

✅ **Pass:** Returns a `VALIDATION` error.

---

## Scenario 11 — Resources

**Purpose:** Confirm both MCP resources return accurate, non-empty content.

### 11A — `cli-permissions-reference`

Read the resource `cursor-cli-mcp://resources/cli-permissions` from your MCP client.

✅ **Pass:** Returns non-empty markdown content describing what the agent CLI can and cannot do.

---

### 11B — `rules-discovery`

Read the resource `cursor-cli-mcp://resources/rules-discovery` from your MCP client.

✅ **Pass:** Returns non-empty markdown content. Content mentions `.cursor/rules`, `AGENTS.md`, or `CLAUDE.md`.

---

## Scenario 12 — Prompts

**Purpose:** Confirm all three prompt templates are accessible and produce sensible output.

### 12A — `plan-only`

Invoke the `plan-only` prompt template from your MCP client with a sample task description.

✅ **Pass:** Template loads. Generated prompt constrains the agent to `mode: plan`.

---

### 12B — `ask-only`

Invoke the `ask-only` prompt template.

✅ **Pass:** Template loads. Generated prompt constrains the agent to `mode: ask`.

---

### 12C — `worktree-isolation`

Invoke the `worktree-isolation` prompt template.

✅ **Pass:** Template loads. Generated prompt includes a `worktree` path and `sandbox: true`.

---

## Teardown

After all scenarios are complete:

1. Note what's in `testing/` — this is the full artefact of the test run
2. Check for any unexpected files outside `testing/`
3. Wipe `testing/` when done: `rm -rf /absolute/path/to/cursor-cli-mcp/testing/*`

---

## Recording Issues

For anything that fails or behaves unexpectedly, open a GitHub issue with:

- Which scenario and step (e.g. `5A`)
- The exact tool call inputs used
- The full response or error received
- Expected vs actual behaviour
- Label: `bug` for failures, `enhancement` for unexpected-but-not-broken behaviour

---

## Pass/Fail Summary Checklist

| Scenario | Description | Result |
|----------|-------------|--------|
| 1A | `agent_status` baseline | |
| 1B | `list_models` baseline | |
| 2A | Ask — simple question | |
| 2B | Ask — with workspace | |
| 2C | Ask — multi-line prompt | |
| 3A | Agent creates `calculator.ts` | |
| 3B | Agent creates `utils.ts` | |
| 3C | Agent creates `buggy.ts` | |
| 3D | Agent creates `README.md` | |
| 4A | Plan — refactor, no file change | |
| 4B | Plan — new feature, no file change | |
| 5A | Agent fixes bugs in `buggy.ts` | |
| 5B | Agent extends `utils.ts` | |
| 5C | Agent creates subfolder + file | |
| 6 | Model switching (3 models) | |
| 7A | Sandbox enabled | |
| 7B | Sandbox disabled | |
| 8 | Streaming output format | |
| 9A | `session_create` | |
| 9B | `session_resume` first prompt | |
| 9C | `session_resume` follow-up | |
| 10A | Security error — bad workspace | |
| 10B | Validation — empty prompt | |
| 10C | Validation — oversized prompt | |
| 10D | Validation — path traversal session ID | |
| 10E | Validation — slash in session ID | |
| 11A | Resource: cli-permissions-reference | |
| 11B | Resource: rules-discovery | |
| 12A | Prompt: plan-only | |
| 12B | Prompt: ask-only | |
| 12C | Prompt: worktree-isolation | |
