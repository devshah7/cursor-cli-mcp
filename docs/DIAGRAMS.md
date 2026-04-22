# Architecture Diagrams: cursor-cli-mcp

**Last updated:** 2026-04-21  
**Format:** C4 model — Context → Container → Component  
**Rendered:** GitHub renders Mermaid blocks natively.

---

## C4 Level 1 — System Context

> Who uses the system and what external systems does it talk to?

```mermaid
C4Context
    title System Context — cursor-cli-mcp

    Person(dev, "Developer / Automation Engineer", "Uses an MCP host to trigger coding tasks via prompt")

    System(mcpServer, "cursor-cli-mcp", "Local MCP server (Node.js). Exposes tools for running Cursor's agent CLI with validated inputs and safety guardrails.")

    System_Ext(mcpHost, "MCP Host", "Claude Desktop, Claude Code, or any MCP-compliant client. Sends tool calls over stdio JSON-RPC.")
    System_Ext(cursorAgent, "Cursor Agent CLI", "Cursor's 'agent' binary. Executes AI-assisted coding tasks inside a workspace. Managed by Cursor, not this project.")
    System_Ext(cursorServices, "Cursor Cloud Services", "Authentication, model routing, billing. Contacted by the agent binary, not by this server.")

    Rel(dev, mcpHost, "Issues prompts and tool calls via")
    Rel(mcpHost, mcpServer, "Sends MCP tool calls (JSON-RPC over stdio)")
    Rel(mcpServer, cursorAgent, "Spawns as subprocess, passes CLI flags")
    Rel(cursorAgent, cursorServices, "Authenticates and routes model requests to")

    UpdateRelStyle(mcpHost, mcpServer, $textColor="black", $lineColor="#0066cc")
    UpdateRelStyle(mcpServer, cursorAgent, $textColor="black", $lineColor="#cc6600")
```

---

## C4 Level 2 — Container

> What are the deployable units and how do they interact?

```mermaid
C4Container
    title Container Diagram — cursor-cli-mcp

    Person(dev, "Developer / Automation Engineer")

    Container_Boundary(host, "MCP Host Process") {
        Container(mcpHost, "MCP Host", "Claude Desktop / Claude Code", "Sends tool calls, receives tool results. Manages its own mcp.json config.")
    }

    Container_Boundary(server, "cursor-cli-mcp Process") {
        Container(mcpServer, "MCP Server", "Node.js >= 20, TypeScript", "Receives tool calls over stdio. Validates input, enforces security, spawns agent subprocess, returns structured result.")
    }

    Container_Boundary(os, "Host Operating System") {
        Container(agentBin, "agent binary", "Cursor CLI", "Executes AI coding tasks. Reads CLI flags for model, mode, workspace, sandbox.")
        ContainerDb(envConfig, "Environment Variables", "Process env", "AGENT_BINARY_PATH, WORKSPACE_ALLOWLIST, AGENT_TIMEOUT_MS, MAX_OUTPUT_BYTES, etc.")
        ContainerDb(cliJson, ".cursor/cli.json", "JSON file", "Operator-defined CLI permissions: Shell, Read, Write, Mcp allowlists. Read by agent binary.")
        ContainerDb(workspace, "Workspace / Worktree", "Filesystem", "The code directory the agent operates on. Must be in WORKSPACE_ALLOWLIST.")
    }

    Rel(dev, mcpHost, "Issues prompts")
    Rel(mcpHost, mcpServer, "JSON-RPC over stdio", "MCP protocol")
    Rel(mcpServer, envConfig, "Reads config at startup")
    Rel(mcpServer, agentBin, "Spawns subprocess, passes args array (shell:false)")
    Rel(agentBin, cliJson, "Reads permissions from")
    Rel(agentBin, workspace, "Reads and writes code in")
    Rel(mcpServer, workspace, "Validates path is in allowlist before passing to agent")
```

---

## C4 Level 3 — Component

> What are the internal components of the MCP server and how do they connect?

```mermaid
C4Component
    title Component Diagram — cursor-cli-mcp (MCP Server internals)

    Container_Boundary(transport, "Layer 4: Transport") {
        Component(index, "index.ts", "Composition Root", "Wires concrete implementations to interfaces. Creates AgentCliExecutor, passes to McpServer. Handles SIGTERM/SIGINT.")
        Component(server, "server.ts", "MCP SDK Adapter", "Reads ALL_TOOLS registry. For each tool, calls pipeline.wrapTool(). Registers resources and prompts with MCP SDK.")
    }

    Container_Boundary(application, "Layer 3: Application") {
        Component(pipeline, "toolPipeline.ts", "Request Pipeline", "Fixed execution order: (1) Zod validate, (2) security.validatePaths, (3) handler, (4) mapResult, (5) mapError. Single place for cross-cutting concerns.")
        Component(registry, "registry/tools.ts", "Tool Registry", "ALL_TOOLS array. Adding a tool = one import + one array entry. server.ts never changes.")
        Component(runAgent, "tools/runAgent.ts", "run_agent Handler", "Zod schema + pure handler. Calls executor via IAgentExecutor interface. No CLI flag knowledge.")
        Component(listModels, "tools/listModels.ts", "list_models Handler", "Zod schema + pure handler.")
        Component(agentStatus, "tools/agentStatus.ts", "agent_status Handler", "Non-zero exit → authenticated:false (not an error). Only ENOENT → error.")
        Component(sessions, "tools/sessions/*", "Session Handlers", "sessionList, sessionCreate, sessionResume. Only added if SESSION_GATE passes.")
        Component(resources, "resources/*", "MCP Resources", "Static markdown: cliPermissions, rulesDiscovery.")
        Component(prompts, "prompts/*", "MCP Prompts", "planOnly, askOnly, worktreeIsolation templates.")
    }

    Container_Boundary(ports, "Layer 2: Ports (Dependency Boundary)") {
        Component(iexec, "ports/agentExecutor.ts", "IAgentExecutor", "Interface: run(options): Promise<ExecutorResult>. The wall between application and infrastructure.")
    }

    Container_Boundary(infra, "Layer 1: Infrastructure / Adapters") {
        Component(executor, "adapters/agentCli/executor.ts", "AgentCliExecutor", "Implements IAgentExecutor. Calls child_process.spawn(shell:false). Manages RingBuffers, timeout watchdog.")
        Component(argBuilder, "adapters/agentCli/argBuilder.ts", "ArgBuilder", "ONLY file that knows Cursor CLI flag names. buildRunAgentArgs(), buildListModelsArgs(), etc. One flag rename = one file change.")
        Component(ringBuffer, "adapters/agentCli/ringBuffer.ts", "RingBuffer", "Fixed-size byte ring buffer. Independent instances for stdout and stderr. toString() always returns valid UTF-8.")
    }

    Container_Boundary(crosscutting, "Cross-Cutting Concerns") {
        Component(config, "config.ts", "Config", "Loads + validates env vars. Injected by index.ts. Binary path warn-only; other invalid values exit.")
        Component(security, "security.ts", "Security", "validatePaths(). Zero external deps. Path normalize, symlink resolve, prefix match with /suffix trick.")
        Component(errors, "errors.ts", "Error Taxonomy", "ErrorClass enum, StructuredError, buildError().")
        Component(logger, "logger.ts", "Logger", "JSON lines to stderr only. LOG_PROMPTS gate. ESLint bans console.*")
    }

    Rel(index, server, "Creates and starts")
    Rel(index, executor, "Instantiates and injects")
    Rel(server, registry, "Reads ALL_TOOLS from")
    Rel(server, pipeline, "Wraps each tool with")
    Rel(pipeline, security, "Calls validatePaths()")
    Rel(pipeline, errors, "Uses buildError() for error mapping")
    Rel(pipeline, runAgent, "Delegates to handler")
    Rel(pipeline, listModels, "Delegates to handler")
    Rel(pipeline, agentStatus, "Delegates to handler")
    Rel(pipeline, sessions, "Delegates to handler (if gated in)")
    Rel(runAgent, iexec, "Calls run() via interface")
    Rel(listModels, iexec, "Calls run() via interface")
    Rel(agentStatus, iexec, "Calls run() via interface")
    Rel(sessions, iexec, "Calls run() via interface")
    Rel(executor, iexec, "Implements")
    Rel(executor, argBuilder, "Uses to build args array")
    Rel(executor, ringBuffer, "Uses for stdout capture")
    Rel(executor, ringBuffer, "Uses for stderr capture")
    Rel(index, config, "Loads config from")
    Rel(executor, config, "Reads AGENT_TIMEOUT_MS, MAX_OUTPUT_BYTES")
    Rel(security, config, "Reads WORKSPACE_ALLOWLIST")
```

---

## Dependency Flow (Simplified Arrow View)

```
┌─────────────────────────────────────────────────────────────────────┐
│  How data flows through the system for a run_agent call             │
└─────────────────────────────────────────────────────────────────────┘

  [MCP Host]
      │  tools/call { name: "run_agent", arguments: {...} }
      ▼
  [server.ts]  ──reads──▶  [registry/tools.ts]
      │  wrapTool(runAgentDescriptor)
      ▼
  [toolPipeline.ts]
      │
      ├─①─▶  [schema.parse()]           ──✗──▶  VALIDATION error → MCP Host
      │
      ├─②─▶  [security.validatePaths()] ──✗──▶  SECURITY error → MCP Host
      │
      ├─③─▶  [runAgent.handler()]
      │            │
      │            ▼
      │       [IAgentExecutor.run()]    ◀── interface boundary ──
      │            │                                              │
      │            ▼                                    [AgentCliExecutor]
      │       [argBuilder.buildRunAgentArgs()]                   │
      │            │                                             │
      │            ▼                                             │
      │       [child_process.spawn(binary, args, {shell:false})] │
      │            │                                             │
      │       [RingBuffer stdout]  [RingBuffer stderr]           │
      │            │                                             │
      │            ▼                                             │
      │       [ExecutorResult] ──────────────────────────────────┘
      │
      ├─④─▶  exitCode 0   → mapResult()  → McpToolResult (success)
      └─⑤─▶  exitCode ≠ 0 → classifyError() → McpToolResult (isError: true)

      ▼
  [MCP Host receives tools/call response]
```

---

## What Changes When...

| Scenario | Files that change | Files that don't change |
|----------|-----------------|------------------------|
| Add a new tool | `tools/newTool.ts` (new), `registry/tools.ts` (+1 line) | server.ts, pipeline, all other tools, executor |
| Cursor renames `--mode` flag | `adapters/agentCli/argBuilder.ts` (+1 function update) | All tool handlers, pipeline, server |
| Add rate limiting to all tools | `pipeline/toolPipeline.ts` (+1 step) | All tool handlers, executor, server |
| Swap subprocess for HTTP API | `adapters/httpAgent/executor.ts` (new), `index.ts` (swap import) | All tool handlers, pipeline, server, registry |
| Add a new MCP resource | `resources/newResource.ts` (new), `registry/resources.ts` (+1 line) | server.ts, tools, executor |
| Change config validation | `config.ts` | All tool handlers, executor interface |
| Add request tracing | `pipeline/toolPipeline.ts`, `logger.ts` | All tool handlers |

---

## Layer Violation Detection

ESLint import rules enforce these boundaries. Any import that crosses a forbidden boundary fails CI:

```
tools/* ──────────────────────── MAY import ──────────→ ports/*
tools/* ──────────────────────── MAY import ──────────→ errors.ts, logger.ts
tools/* ──────────────────────── FORBIDDEN ───────────✗ adapters/*
tools/* ──────────────────────── FORBIDDEN ───────────✗ other tools/*

adapters/* ───────────────────── MAY import ──────────→ ports/*
adapters/* ───────────────────── MAY import ──────────→ errors.ts, logger.ts, config.ts
adapters/* ───────────────────── FORBIDDEN ───────────✗ tools/*
adapters/* ───────────────────── FORBIDDEN ───────────✗ server.ts

ports/* ──────────────────────── FORBIDDEN ───────────✗ everything

security.ts ──────────────────── MAY import ──────────→ Node builtins only (path, fs)
security.ts ──────────────────── FORBIDDEN ───────────✗ everything else

logger.ts ────────────────────── FORBIDDEN ───────────✗ everything (writes stderr, no imports)
```
