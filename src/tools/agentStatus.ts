import { z } from 'zod';
import type { PipelineContext } from '../pipeline/toolPipeline.js';
import type { ExecutorResult } from '../ports/executorTypes.js';
import type { IAgentExecutor } from '../ports/agentExecutor.js';
import type { ToolDescriptor } from '../registry/tools.js';

export const agentStatusSchema = z.object({});

export type AgentStatusParsed = z.infer<typeof agentStatusSchema>;

export interface ParsedStatus {
  /** True only when the CLI reports an authenticated session AND the server returned user details. */
  authenticated: boolean;
  /**
   * A token is cached locally but the server did not return user details — the session has
   * expired. `agent status` still exits 0 in this state while `run_agent` fails with
   * AUTH_REQUIRED, so this flag is what makes the discrepancy visible to callers.
   */
  staleSession: boolean;
  userEmail?: string;
}

export interface ParsedAbout {
  agentCliVersion?: string;
  userEmail?: string;
  subscriptionTier?: string;
  defaultModel?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/**
 * Parse `agent status --format json`. Returns null when stdout is not the expected shape,
 * which signals the caller to fall back to the plain-text probe.
 */
export function parseStatusJson(stdout: string): ParsedStatus | null {
  let raw: unknown;
  try {
    raw = JSON.parse(stdout.trim());
  } catch {
    return null;
  }
  const o = asRecord(raw);
  if (o === null) {
    return null;
  }
  const isAuthenticated = o.isAuthenticated;
  const hasAccessToken = o.hasAccessToken;
  if (typeof isAuthenticated !== 'boolean' && typeof hasAccessToken !== 'boolean') {
    return null;
  }
  const userInfo = asRecord(o.userInfo);
  const authenticated = isAuthenticated === true && userInfo !== null;
  return {
    authenticated,
    staleSession: !authenticated && hasAccessToken === true,
    ...(userInfo !== null ? { userEmail: optionalString(userInfo.email) } : {}),
  };
}

/** Parse `agent about --format json`. Returns null when stdout is not the expected shape. */
export function parseAboutJson(stdout: string): ParsedAbout | null {
  let raw: unknown;
  try {
    raw = JSON.parse(stdout.trim());
  } catch {
    return null;
  }
  const o = asRecord(raw);
  if (o === null) {
    return null;
  }
  return {
    agentCliVersion: optionalString(o.cliVersion),
    userEmail: optionalString(o.userEmail),
    subscriptionTier: optionalString(o.subscriptionTier),
    defaultModel: optionalString(o.model),
  };
}

/** API_SPEC §3.6 — NON-fatal diagnostics: subprocess failure is usually success JSON, not MCP error. */
export function createAgentStatusDescriptor(
  _ctx: PipelineContext,
): ToolDescriptor<AgentStatusParsed> {
  return {
    name: 'agent_status',
    description:
      'Report Cursor agent CLI authentication state, account details, CLI version, and binary path. ' +
      'Run this first to confirm the server is wired up correctly. ' +
      'A `staleSession: true` response means a cached token exists but has expired — run `agent login` to re-authenticate.',
    schema: agentStatusSchema as z.ZodType<AgentStatusParsed>,
    pathArgs: () => [],
    handler: async (
      _input: AgentStatusParsed,
      executor: IAgentExecutor,
      toolCtx: PipelineContext,
    ) => {
      const status = await executor.run({
        binary: toolCtx.agentBinaryPath,
        command: { kind: 'agent_status' },
        timeoutMs: toolCtx.agentTimeoutMs,
        maxOutputBytes: toolCtx.maxOutputBytes,
      });

      if (status.timedOut) {
        // Let pipeline map this to TIMEOUT.
        return status;
      }
      if (status.exitCode === 127) {
        // Let pipeline map this to BINARY_NOT_FOUND.
        return status;
      }

      // Parse regardless of exit code: an unauthenticated CLI still prints valid status JSON.
      const parsed = parseStatusJson(status.stdout);

      if (parsed === null) {
        // Binary predates `status --format json`, or printed something unexpected.
        // Fall back to the plain-text probe and the exit-code heuristic.
        const text: ExecutorResult = await executor.run({
          binary: toolCtx.agentBinaryPath,
          command: { kind: 'agent_status_text' },
          timeoutMs: toolCtx.agentTimeoutMs,
          maxOutputBytes: toolCtx.maxOutputBytes,
        });
        if (text.timedOut || text.exitCode === 127) {
          return text;
        }
        return {
          authenticated: text.exitCode === 0,
          binaryPath: toolCtx.agentBinaryPath,
          statusSource: 'text-fallback' as const,
        };
      }

      const about = await executor.run({
        binary: toolCtx.agentBinaryPath,
        command: { kind: 'agent_about' },
        timeoutMs: toolCtx.agentTimeoutMs,
        maxOutputBytes: toolCtx.maxOutputBytes,
      });
      const aboutParsed =
        !about.timedOut && about.exitCode === 0 ? parseAboutJson(about.stdout) : null;

      const userEmail = parsed.userEmail ?? aboutParsed?.userEmail;

      return {
        authenticated: parsed.authenticated,
        binaryPath: toolCtx.agentBinaryPath,
        statusSource: 'json' as const,
        ...(parsed.staleSession ? { staleSession: true } : {}),
        ...(userEmail !== undefined ? { userEmail } : {}),
        ...(aboutParsed?.agentCliVersion !== undefined
          ? { agentCliVersion: aboutParsed.agentCliVersion }
          : {}),
        ...(aboutParsed?.subscriptionTier !== undefined
          ? { subscriptionTier: aboutParsed.subscriptionTier }
          : {}),
        ...(aboutParsed?.defaultModel !== undefined
          ? { defaultModel: aboutParsed.defaultModel }
          : {}),
      };
    },
  };
}
