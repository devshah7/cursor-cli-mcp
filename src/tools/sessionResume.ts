import { z } from 'zod';
import { buildSessionResumeArgs } from '../adapters/agentCli/argBuilder.js';
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
    .regex(/^[\w./:-]+$/)
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
    description:
      'Resume an existing agent chat session with an additional prompt (`agent -p … --resume <chatId>`). ' +
      'Note: combining --resume with --print is not explicitly documented by Cursor — ' +
      'behaviour is confirmed by flag inspection but not by official docs. Hanging risk same as session_create.',
    schema: sessionResumeSchema as z.ZodType<SessionResumeParsed>,
    pathArgs: () => [],
    handler: async (
      input: SessionResumeParsed,
      executor: IAgentExecutor,
      toolCtx: PipelineContext,
    ) => {
      const args = buildSessionResumeArgs({
        prompt: input.prompt,
        sessionId: input.session_id,
        model: input.model,
        output_format: input.output_format,
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
