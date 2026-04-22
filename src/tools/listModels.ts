import { z } from 'zod';
import { buildListModelsArgs } from '../adapters/agentCli/argBuilder.js';
import type { PipelineContext } from '../pipeline/toolPipeline.js';
import type { ExecutorResult } from '../ports/executorTypes.js';
import type { IAgentExecutor } from '../ports/agentExecutor.js';
import type { ToolDescriptor } from '../registry/tools.js';

export const listModelsSchema = z.object({});

export type ListModelsParsed = z.infer<typeof listModelsSchema>;

/** Parse stdout from `agent models` — JSON array, `{ models: [...] }`, or line-based list. */
export function parseModelsStdout(stdout: string): string[] {
  const t = stdout.trim();
  if (t === '') {
    return [];
  }
  try {
    const j: unknown = JSON.parse(t);
    if (Array.isArray(j)) {
      return j.map(String);
    }
    if (
      typeof j === 'object' &&
      j !== null &&
      'models' in j &&
      Array.isArray((j as { models: unknown }).models)
    ) {
      return ((j as { models: unknown[] }).models ?? []).map(String);
    }
  } catch {
    /* line-based fallback */
  }
  return t
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function createListModelsDescriptor(ctx: PipelineContext): ToolDescriptor<ListModelsParsed> {
  return {
    name: 'list_models',
    description: 'List model identifiers supported by the Cursor agent CLI.',
    schema: listModelsSchema as z.ZodType<ListModelsParsed>,
    pathArgs: () => [],
    handler: async (_input: ListModelsParsed, executor: IAgentExecutor) => {
      const result = await executor.run({
        binary: ctx.agentBinaryPath,
        args: buildListModelsArgs(),
        timeoutMs: ctx.agentTimeoutMs,
        maxOutputBytes: ctx.maxOutputBytes,
      });
      if (result.timedOut || result.exitCode !== 0) {
        const r: ExecutorResult = result;
        return r;
      }
      return { models: parseModelsStdout(result.stdout) };
    },
  };
}
