import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  ASK_ONLY_DESCRIPTION,
  ASK_ONLY_NAME,
  askOnlyArgsShape,
  buildAskOnlyPrompt,
} from '../prompts/askOnly.js';
import {
  PLAN_ONLY_DESCRIPTION,
  PLAN_ONLY_NAME,
  planOnlyArgsShape,
  buildPlanOnlyPrompt,
} from '../prompts/planOnly.js';
import {
  WORKTREE_ISOLATION_DESCRIPTION,
  WORKTREE_ISOLATION_NAME,
  buildWorktreeIsolationPrompt,
  worktreeIsolationArgsShape,
} from '../prompts/worktreeIsolation.js';

/** Register MCP prompt templates — see `docs/API_SPEC.md` §5. */
export function registerPromptHandlers(mcp: McpServer): void {
  mcp.registerPrompt(
    PLAN_ONLY_NAME,
    { description: PLAN_ONLY_DESCRIPTION, argsSchema: planOnlyArgsShape },
    buildPlanOnlyPrompt,
  );

  mcp.registerPrompt(
    ASK_ONLY_NAME,
    { description: ASK_ONLY_DESCRIPTION, argsSchema: askOnlyArgsShape },
    buildAskOnlyPrompt,
  );

  mcp.registerPrompt(
    WORKTREE_ISOLATION_NAME,
    {
      description: WORKTREE_ISOLATION_DESCRIPTION,
      argsSchema: worktreeIsolationArgsShape,
    },
    buildWorktreeIsolationPrompt,
  );
}
