import type { GetPromptResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

/** FR-P2 — API_SPEC §5.2 */
export const ASK_ONLY_NAME = 'ask-only';

export const ASK_ONLY_DESCRIPTION =
  'Pre-filled template for read-only ask mode (`--mode=ask`). Arguments map to `run_agent`.';

const askOnlyArgsSchema = z.object({
  prompt: z.string().min(1),
  workspace: z.string().optional(),
});

export const askOnlyArgsShape = askOnlyArgsSchema.shape;

export type AskOnlyArgs = z.infer<typeof askOnlyArgsSchema>;

export function buildAskOnlyPrompt(args: AskOnlyArgs): GetPromptResult {
  const runAgentPayload: Record<string, unknown> = {
    prompt: args.prompt,
    mode: 'ask',
  };
  if (args.workspace !== undefined) {
    runAgentPayload.workspace = args.workspace;
  }

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
