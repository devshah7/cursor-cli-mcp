import { z } from 'zod';
import { buildRunAgentArgs } from '../adapters/agentCli/argBuilder.js';
import type { PipelineContext } from '../pipeline/toolPipeline.js';
import type { IAgentExecutor } from '../ports/agentExecutor.js';
import type { ToolDescriptor } from '../registry/tools.js';

export const runAgentSchema = z.object({
  prompt: z.string().min(1).max(32_000),
  model: z
    .string()
    .regex(/^[\w.-]+(\/[\w.-]+)?$/)
    .max(200)
    .optional(),
  mode: z.enum(['agent', 'plan', 'ask']).default('agent'),
  workspace: z.string().optional(),
  worktree: z.string().optional(),
  sandbox: z.boolean().optional(),
  output_format: z.enum(['text', 'json', 'stream-json']).optional().default('text'),
  approve_mcps: z.boolean().optional().default(false),
});

export type RunAgentParsed = z.infer<typeof runAgentSchema>;

export function pathArgsFromRunAgent(input: RunAgentParsed): string[] {
  const paths: string[] = [];
  if (input.workspace !== undefined) {
    paths.push(input.workspace);
  }
  if (input.worktree !== undefined) {
    paths.push(input.worktree);
  }
  return paths;
}

export function createRunAgentDescriptor(_ctx: PipelineContext): ToolDescriptor<RunAgentParsed> {
  return {
    name: 'run_agent',
    description:
      'Run Cursor agent CLI in non-interactive (print) mode with the given prompt and options. ' +
      'When WORKSPACE_ALLOWLIST is configured on the server, supply a `workspace` path so the ' +
      'allowlist check applies; omitting it means the agent runs without workspace path validation.',
    schema: runAgentSchema as z.ZodType<RunAgentParsed>,
    pathArgs: pathArgsFromRunAgent,
    supportsStreaming: true,
    handler: async (input: RunAgentParsed, executor: IAgentExecutor, toolCtx: PipelineContext) => {
      const args = buildRunAgentArgs({
        prompt: input.prompt,
        model: input.model,
        mode: input.mode,
        workspace: input.workspace,
        worktree: input.worktree,
        sandbox: input.sandbox,
        output_format: input.output_format,
        approve_mcps: input.approve_mcps,
      });
      const onStdoutChunk =
        toolCtx.sendNotification !== undefined
          ? (chunk: string): void => {
              toolCtx.sendNotification?.(chunk);
            }
          : undefined;
      return await executor.run({
        binary: toolCtx.agentBinaryPath,
        args,
        timeoutMs: toolCtx.agentTimeoutMs,
        maxOutputBytes: toolCtx.maxOutputBytes,
        onStdoutChunk,
      });
    },
  };
}
