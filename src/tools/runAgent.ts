import { z } from 'zod';
import { PromptTooLargeError } from '../errors.js';
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
      'Delegate a coding task to a fully autonomous Cursor agent. ' +
      'The agent can read, write, and refactor code across multiple files; run shell commands; install packages; and use MCP tools — all without manual intervention. ' +
      'Prefer this tool over doing work inline whenever the task involves file edits, multi-step implementation, debugging, or anything requiring workspace access. ' +
      '\n\n' +
      'TIMEOUT BEHAVIOUR (read before use): Long tasks will return an MCP -32001 timeout error. ' +
      'This is the MCP client dropping its connection — it does NOT stop the Cursor agent. ' +
      'The agent continues running in the background and writes changes to disk. ' +
      'After a timeout: (1) wait a moment, (2) read the workspace files to verify what was done, ' +
      '(3) run your project gate check (lint/typecheck/build/test) to confirm correctness, ' +
      '(4) call run_agent again with only the remaining work if anything is incomplete. ' +
      'Do NOT re-implement the work inline — check the files first. ' +
      'See the usage-patterns resource for the full post-timeout workflow. ' +
      '\n\n' +
      'Modes: "agent" (default) = full read/write access; "plan" = read-only planning and analysis, no edits made; "ask" = Q&A and explanation, no edits made. ' +
      'Set sandbox: true to isolate filesystem writes to a temporary environment. ' +
      'Prompt size is capped server-side — split large context into smaller focused tasks if rejected. ' +
      'Supply a workspace path when WORKSPACE_ALLOWLIST is configured on the server.',
    schema: runAgentSchema as z.ZodType<RunAgentParsed>,
    pathArgs: pathArgsFromRunAgent,
    supportsStreaming: true,
    handler: async (input: RunAgentParsed, executor: IAgentExecutor, toolCtx: PipelineContext) => {
      if (input.prompt.length > toolCtx.promptMaxChars) {
        throw new PromptTooLargeError(input.prompt.length, toolCtx.promptMaxChars);
      }
      const onStdoutChunk =
        toolCtx.sendNotification !== undefined
          ? (chunk: string): void => {
              toolCtx.sendNotification?.(chunk);
            }
          : undefined;
      return await executor.run({
        binary: toolCtx.agentBinaryPath,
        command: {
          kind: 'run_agent',
          prompt: input.prompt,
          model: input.model,
          mode: input.mode,
          workspace: input.workspace,
          worktree: input.worktree,
          sandbox: input.sandbox,
          outputFormat: input.output_format,
          approveMcps: input.approve_mcps,
        },
        timeoutMs: toolCtx.agentTimeoutMs,
        maxOutputBytes: toolCtx.maxOutputBytes,
        onStdoutChunk,
      });
    },
  };
}
