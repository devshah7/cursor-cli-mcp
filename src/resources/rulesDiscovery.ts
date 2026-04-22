import type { ResourceDescriptor } from '../registry/resources.js';

/**
 * FR-R2 — cursor-cli-mcp://resources/rules-discovery (API_SPEC §4.2).
 * Explains how project rules and agent instructions are discovered by the CLI.
 */
export const rulesDiscovery: ResourceDescriptor = {
  name: 'rules-discovery',
  uri: 'cursor-cli-mcp://resources/rules-discovery',
  description: 'How Cursor loads .cursor/rules, AGENTS.md, CLAUDE.md for agent instructions',
  mimeType: 'text/markdown',
  content: [
    '# Rules and instruction discovery',
    '',
    'The Cursor `agent` CLI loads **persistent instructions** from your repository and home directory so every run shares the same policies, style, and tooling context—without stuffing that text into each `run_agent` call.',
    '',
    '## `.cursor/rules`',
    '',
    'Project-specific rules live under **`.cursor/rules/`** (for example Markdown or other files your team maintains). These files define how the agent should behave in this codebase: coding standards, commands to prefer, areas that are off-limits, etc.',
    '',
    '## `AGENTS.md`',
    '',
    '**`AGENTS.md`** (often at the repo root) is a conventional place to document agent-facing instructions that should apply to automation and AI-assisted workflows in this project.',
    '',
    '## `CLAUDE.md`',
    '',
    '**`CLAUDE.md`** (and similar project-level instruction files) can be loaded by Claude Code / compatible clients; the CLI may incorporate them when building the effective system context for the agent.',
    '',
    '## Putting it together',
    '',
    'When you invoke the agent from an MCP server, your **prompt** describes the immediate task; **rules discovery** is how stable, repo-level guidance reaches the agent without repeating it on every request. Update these files when you want long-lived behavior to change.',
    '',
  ].join('\n'),
};
