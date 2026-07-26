import { z } from 'zod';
import type { PipelineContext } from '../pipeline/toolPipeline.js';
import type { IAgentExecutor } from '../ports/agentExecutor.js';
import type { ToolDescriptor } from '../registry/tools.js';

export const agentStatusSchema = z.object({});

export type AgentStatusParsed = z.infer<typeof agentStatusSchema>;

/** API_SPEC §3.6 — NON-fatal diagnostics: subprocess failure is usually success JSON, not MCP error. */
export function createAgentStatusDescriptor(
  _ctx: PipelineContext,
): ToolDescriptor<AgentStatusParsed> {
  return {
    name: 'agent_status',
    description: 'Report Cursor agent CLI authentication hints, version text, and binary path.',
    schema: agentStatusSchema as z.ZodType<AgentStatusParsed>,
    pathArgs: () => [],
    handler: async (
      _input: AgentStatusParsed,
      executor: IAgentExecutor,
      toolCtx: PipelineContext,
    ) => {
      const result = await executor.run({
        binary: toolCtx.agentBinaryPath,
        command: { kind: 'agent_status' },
        timeoutMs: toolCtx.agentTimeoutMs,
        maxOutputBytes: toolCtx.maxOutputBytes,
      });

      if (result.timedOut) {
        // Let pipeline map this to TIMEOUT.
        return result;
      }
      if (result.exitCode === 127) {
        // Let pipeline map this to BINARY_NOT_FOUND.
        return result;
      }

      const authenticated = result.exitCode === 0;
      if (!authenticated) {
        return { authenticated, binaryPath: toolCtx.agentBinaryPath };
      }

      const stdout = result.stdout.trim();

      // Best-effort: `agent status` reports login state, not the CLI version.
      // agentCliVersion comes from a separate `agent --version` call (API_SPEC §3.6).
      const versionResult = await executor.run({
        binary: toolCtx.agentBinaryPath,
        command: { kind: 'agent_version' },
        timeoutMs: toolCtx.agentTimeoutMs,
        maxOutputBytes: toolCtx.maxOutputBytes,
      });
      const agentCliVersion =
        !versionResult.timedOut && versionResult.exitCode === 0
          ? versionResult.stdout.trim()
          : undefined;

      return {
        authenticated,
        binaryPath: toolCtx.agentBinaryPath,
        ...(stdout !== '' ? { version: stdout } : {}),
        ...(agentCliVersion !== undefined && agentCliVersion !== '' ? { agentCliVersion } : {}),
      };
    },
  };
}
