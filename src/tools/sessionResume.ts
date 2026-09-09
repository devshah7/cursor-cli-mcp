import { z } from 'zod';
import type { PipelineContext } from '../pipeline/toolPipeline.js';
import type { IAgentExecutor } from '../ports/agentExecutor.js';
import type { ToolDescriptor } from '../registry/tools.js';

export const sessionResumeSchema = z.object({
  session_id: z
    .string()
    .min(1)
    .max(200)
    .refine((s) => !s.includes('..') && !s.includes('/') && !s.includes('\\'), {
      message: 'session_id must not contain path separators or ..',
    }),
  prompt: z.string().min(1).max(32_000),
  model: z
    .string()
    // Accepts plain ids (`auto`, `gpt-5.3-codex`), `vendor/model`, and Cursor's
    // parameterized override syntax, e.g.
    // `claude-opus-4-8[context=1m,effort=high,fast=false]` (verified 2026-09-07).
    .regex(/^[\w.-]+(\/[\w.-]+)?(\[[\w.,=-]+\])?$/)
    .max(200)
    .optional(),
  output_format: z.enum(['text', 'json']).optional().default('text'),
});

export type SessionResumeParsed = z.infer<typeof sessionResumeSchema>;

export function createSessionResumeDescriptor(
  _ctx: PipelineContext,
): ToolDescriptor<SessionResumeParsed> {
  return {
    name: 'session_resume',
    supportsStreaming: true,
    description:
      'Continue a prior Cursor agent session with a new prompt, preserving full conversation context and prior workspace state. ' +
      'Use this to iterate on previous agent work, follow up on results, or build on what the agent already knows about the codebase. ' +
      'Requires a session_id returned by session_create. Supports streaming output.',
    schema: sessionResumeSchema as z.ZodType<SessionResumeParsed>,
    pathArgs: () => [],
    handler: async (
      input: SessionResumeParsed,
      executor: IAgentExecutor,
      toolCtx: PipelineContext,
    ) => {
      const onStdoutChunk =
        toolCtx.sendNotification !== undefined
          ? (chunk: string): void => {
              toolCtx.sendNotification?.(chunk);
            }
          : undefined;
      return await executor.run({
        binary: toolCtx.agentBinaryPath,
        command: {
          kind: 'session_resume',
          prompt: input.prompt,
          sessionId: input.session_id,
          model: input.model,
          outputFormat: input.output_format,
        },
        timeoutMs: toolCtx.agentTimeoutMs,
        maxOutputBytes: toolCtx.maxOutputBytes,
        onStdoutChunk,
      });
    },
  };
}
