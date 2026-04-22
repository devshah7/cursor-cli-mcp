import type { GetPromptResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

/** FR-P3 — API_SPEC §5.3 */
export const WORKTREE_ISOLATION_NAME = 'worktree-isolation';

export const WORKTREE_ISOLATION_DESCRIPTION =
  'Pre-filled template for isolated runs using a Git worktree (`worktree` + `sandbox: true`).';

const worktreeIsolationArgsSchema = z.object({
  prompt: z.string().min(1),
  workspace: z.string().min(1),
  worktree: z.string().min(1),
});

export const worktreeIsolationArgsShape = worktreeIsolationArgsSchema.shape;

export type WorktreeIsolationArgs = z.infer<typeof worktreeIsolationArgsSchema>;

export function buildWorktreeIsolationPrompt(args: WorktreeIsolationArgs): GetPromptResult {
  const runAgentPayload = {
    prompt: args.prompt,
    workspace: args.workspace,
    worktree: args.worktree,
    sandbox: true,
  };

  const text =
    'Call the MCP tool `run_agent` with exactly this JSON:\n\n' +
    JSON.stringify(runAgentPayload, null, 2);

  return {
    messages: [
      {
        role: 'user',
        content: { type: 'text', text },
      },
    ],
  };
}
