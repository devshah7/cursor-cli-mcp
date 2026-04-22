import { z } from 'zod';
import { buildAgentStatusArgs } from '../adapters/agentCli/argBuilder.js';
import type { PipelineContext } from '../pipeline/toolPipeline.js';
import type { ExecutorResult } from '../ports/executorTypes.js';
import type { IAgentExecutor } from '../ports/agentExecutor.js';
import type { ToolDescriptor } from '../registry/tools.js';

export const agentStatusSchema = z.object({});

export type AgentStatusParsed = z.infer<typeof agentStatusSchema>;

/** API_SPEC §3.6 — NON-fatal diagnostics: subprocess failure is usually success JSON, not MCP error. */
export function createAgentStatusDescriptor(
  ctx: PipelineContext,
): ToolDescriptor<AgentStatusParsed> {
  return {
    name: 'agent_status',
    description: 'Report Cursor agent CLI authentication hints, version text, and binary path.',
    schema: agentStatusSchema as z.ZodType<AgentStatusParsed>,
    pathArgs: () => [],
    handler: async (_input: AgentStatusParsed, executor: IAgentExecutor) => {
      const result = await executor.run({
        binary: ctx.agentBinaryPath,
        args: buildAgentStatusArgs(),
        timeoutMs: ctx.agentTimeoutMs,
        maxOutputBytes: ctx.maxOutputBytes,
      });

      if (result.timedOut || result.exitCode === 127) {
        const r: ExecutorResult = result;
        return r;
      }

      const stdout = result.stdout.trim();
      return {
        authenticated: result.exitCode === 0,
        binaryPath: ctx.agentBinaryPath,
        ...(stdout !== '' ? { version: stdout, agentCliVersion: stdout } : {}),
      };
    },
  };
}
