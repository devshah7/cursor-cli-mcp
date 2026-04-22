import type { ResourceDescriptor } from '../registry/resources.js';

/**
 * FR-R1 — cursor-cli-mcp://resources/cli-permissions (API_SPEC §4.1).
 * Describes permission keys used by Cursor CLI configuration files.
 */
export const cliPermissionsReference: ResourceDescriptor = {
  name: 'cli-permissions-reference',
  uri: 'cursor-cli-mcp://resources/cli-permissions',
  description:
    'Reference for Shell, Read, Write, WebFetch, and Mcp permission entries in Cursor CLI config',
  mimeType: 'text/markdown',
  content: [
    '# Cursor CLI permission reference',
    '',
    'Cursor reads CLI permissions from **`~/.cursor/cli-config.json`** (user defaults) and from **`.cursor/cli.json`** inside a workspace (project overrides).',
    '',
    'Each permission entry grants a capability the agent may use when running in that workspace. Common keys include:',
    '',
    '| Key | Meaning |',
    '|-----|---------|',
    '| **Shell** | Run shell commands (subject to your environment and Cursor policy). |',
    '| **Read** | Read files from disk. |',
    '| **Write** | Create or modify files. |',
    '| **WebFetch** | Fetch content from HTTP/HTTPS endpoints. |',
    '| **Mcp** | Use configured MCP servers and tools exposed to the agent. |',
    '',
    'Permission objects are structured data (not free-form strings). Exact shape may evolve with Cursor releases; treat this document as operational guidance and prefer the official Cursor docs for the latest schema.',
    '',
    '**Operator tips:**',
    '',
    '- Prefer the narrowest permission set that still lets the task complete.',
    '- Keep project-level `.cursor/cli.json` under version control when your team shares a baseline policy.',
    '- When something is blocked unexpectedly, verify both the user file and the workspace file—project settings can tighten or loosen what the CLI allows.',
    '',
  ].join('\n'),
};
