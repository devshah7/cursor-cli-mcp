import { z } from 'zod';
import { buildSessionCreateArgs } from '../adapters/agentCli/argBuilder.js';
import type { PipelineContext } from '../pipeline/toolPipeline.js';
import type { ExecutorResult } from '../ports/executorTypes.js';
import type { IAgentExecutor } from '../ports/agentExecutor.js';
import type { ToolDescriptor } from '../registry/tools.js';

export const sessionCreateSchema = z.object({
  workspace: z.string().optional(),
});

export type SessionCreateParsed = z.infer<typeof sessionCreateSchema>;

export function pathArgsFromSessionCreate(input: SessionCreateParsed): string[] {
  const paths: string[] = [];
  if (input.workspace !== undefined) {
    paths.push(input.workspace);
  }
  return paths;
}

/** Parse stdout from `agent create-chat` — commonly a single-line UUID; JSON `{ id }` also accepted. */
export function parseCreateChatStdout(stdout: string): string | null {
  const firstLine =
    stdout
      .trim()
      .split(/\r?\n/)
      .find((s) => s.trim().length > 0)
      ?.trim() ?? '';
  if (firstLine === '') {
    return null;
  }
  try {
    const j: unknown = JSON.parse(stdout.trim());
    if (
      typeof j === 'object' &&
      j !== null &&
      'sessionId' in j &&
      typeof (j as { sessionId: unknown }).sessionId === 'string'
    ) {
      const id = (j as { sessionId: string }).sessionId.trim();
      return id.length > 0 ? id : null;
    }
    if (
      typeof j === 'object' &&
      j !== null &&
      'id' in j &&
      typeof (j as { id: unknown }).id === 'string'
    ) {
      const id = (j as { id: string }).id.trim();
      return id.length > 0 ? id : null;
    }
    if (typeof j === 'string') {
      const id = j.trim();
      return id.length > 0 ? id : null;
    }
  } catch {
    /* single-line fallback */
  }
  return firstLine.length > 0 ? firstLine : null;
}

export function createSessionCreateDescriptor(
  _ctx: PipelineContext,
): ToolDescriptor<SessionCreateParsed> {
  return {
    name: 'session_create',
    description:
      'Create a new empty agent chat session and return its id (`agent create-chat`). ' +
      'Returns a UUID on stdout. Known issue: process may hang after printing the ID — ' +
      'the executor timeout is the safety net (agentTimeoutMs).',
    schema: sessionCreateSchema as z.ZodType<SessionCreateParsed>,
    pathArgs: pathArgsFromSessionCreate,
    handler: async (
      _input: SessionCreateParsed,
      executor: IAgentExecutor,
      toolCtx: PipelineContext,
    ) => {
      const result = await executor.run({
        binary: toolCtx.agentBinaryPath,
        args: buildSessionCreateArgs(),
        timeoutMs: toolCtx.agentTimeoutMs,
        maxOutputBytes: toolCtx.maxOutputBytes,
      });
      if (result.timedOut || result.exitCode !== 0) {
        const r: ExecutorResult = result;
        return r;
      }
      const sessionId = parseCreateChatStdout(result.stdout);
      if (sessionId === null) {
        throw new Error('create-chat: could not parse session id from stdout');
      }
      return { sessionId };
    },
  };
}
