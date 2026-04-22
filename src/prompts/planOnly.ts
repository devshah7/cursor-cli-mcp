import type { GetPromptResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

/** FR-P1 — API_SPEC §5.1 */
export const PLAN_ONLY_NAME = 'plan-only';

export const PLAN_ONLY_DESCRIPTION =
  'Pre-filled template for Cursor agent runs in plan mode (`--mode=plan`). Arguments map to `run_agent`.';

const planOnlyArgsSchema = z.object({
  prompt: z.string().min(1),
  workspace: z.string().optional(),
});

export const planOnlyArgsShape = planOnlyArgsSchema.shape;

export type PlanOnlyArgs = z.infer<typeof planOnlyArgsSchema>;

export function buildPlanOnlyPrompt(args: PlanOnlyArgs): GetPromptResult {
  const runAgentPayload: Record<string, unknown> = {
    prompt: args.prompt,
    mode: 'plan',
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
