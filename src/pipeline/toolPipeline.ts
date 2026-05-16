import { ZodError } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ErrorClass, PromptTooLargeError, buildError, type StructuredError } from '../errors.js';
import type { Logger } from '../logger.js';
import type { ExecutorResult } from '../ports/executorTypes.js';
import type { IAgentExecutor } from '../ports/agentExecutor.js';
import type { ToolDescriptor } from '../registry/tools.js';
import { SecurityError, validatePaths } from '../security.js';

/** Per-request tooling context from `Config` — passed into tool factories and `wrapTool`. */
export interface PipelineContext {
  workspaceAllowlist: string[];
  agentBinaryPath: string;
  agentTimeoutMs: number;
  sessionCreateTimeoutMs: number;
  maxOutputBytes: number;
  promptMaxChars: number;
  /** Phase 4 streaming — forward `run_agent` stdout chunks to MCP client; undefined = aggregated-only. */
  sendNotification?: (chunk: string) => void;
  /** Optional logger for pipeline-level diagnostics (e.g. workspace bypass warning). */
  logger?: Logger;
}

function authLike(stderr: string): boolean {
  const low = stderr.toLowerCase();
  return low.includes('login') || low.includes('auth');
}

function isExecutorResult(value: unknown): value is ExecutorResult {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const o = value as Record<string, unknown>;
  return (
    typeof o.stdout === 'string' &&
    typeof o.stderrExcerpt === 'string' &&
    typeof o.exitCode === 'number' &&
    typeof o.timedOut === 'boolean' &&
    typeof o.outputTruncated === 'boolean' &&
    typeof o.durationMs === 'number'
  );
}

function successPayload(obj: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(obj) }],
  };
}

function errorPayload(err: StructuredError): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(err) }],
    isError: true,
  };
}

function classifyExecutorFailure(result: ExecutorResult): StructuredError {
  if (result.timedOut) {
    return buildError(ErrorClass.TIMEOUT, 'Agent subprocess timed out', {
      timedOut: true,
      stderrExcerpt: result.stderrExcerpt,
      exitCode: result.exitCode,
    });
  }
  if (result.exitCode === 127) {
    return buildError(ErrorClass.BINARY_NOT_FOUND, 'Agent binary not found or not executable', {
      stderrExcerpt: result.stderrExcerpt,
      exitCode: result.exitCode,
    });
  }
  if (authLike(result.stderrExcerpt)) {
    return buildError(ErrorClass.AUTH_REQUIRED, 'Authentication required', {
      exitCode: result.exitCode,
      stderrExcerpt: result.stderrExcerpt,
    });
  }
  return buildError(ErrorClass.AGENT_ERROR, 'Agent exited with non-zero status', {
    exitCode: result.exitCode,
    stderrExcerpt: result.stderrExcerpt,
  });
}

function mapExecutorOutcome(result: ExecutorResult): CallToolResult {
  if (result.timedOut || result.exitCode !== 0) {
    return errorPayload(classifyExecutorFailure(result));
  }
  return successPayload(result);
}

function mapThrownError(err: unknown): CallToolResult {
  if (err instanceof PromptTooLargeError) {
    return errorPayload({
      errorClass: ErrorClass.VALIDATION,
      message: err.message,
      promptLength: err.promptLength,
      promptMaxChars: err.promptMaxChars,
    } as StructuredError & { promptLength: number; promptMaxChars: number });
  }
  if (err instanceof ZodError) {
    return errorPayload(
      buildError(ErrorClass.VALIDATION, err.message, {
        stderrExcerpt: JSON.stringify(err.flatten()),
      }),
    );
  }
  if (err instanceof SecurityError) {
    return errorPayload(buildError(ErrorClass.SECURITY, err.message));
  }
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const ne = err as NodeJS.ErrnoException;
    if (ne.code === 'ENOENT') {
      const msg = ne instanceof Error ? ne.message : 'ENOENT';
      return errorPayload(
        buildError(ErrorClass.BINARY_NOT_FOUND, 'Agent binary not found', {
          stderrExcerpt: msg,
        }),
      );
    }
  }
  const msg = err instanceof Error ? err.message : 'Unknown error';
  return errorPayload(buildError(ErrorClass.UNKNOWN, msg));
}

/**
 * Fixed pipeline: validate → security.validatePaths → handler → map result / errors.
 */
export function wrapTool<T>(
  descriptor: ToolDescriptor<T>,
  executor: IAgentExecutor,
  ctx: PipelineContext,
): (args: unknown, ctxOverrides?: Partial<PipelineContext>) => Promise<CallToolResult> {
  return async (args: unknown, ctxOverrides?: Partial<PipelineContext>) => {
    try {
      const merged: PipelineContext = { ...ctx, ...(ctxOverrides ?? {}) };
      const parsed = descriptor.schema.parse(args);
      const pathArgs = descriptor.pathArgs(parsed);
      validatePaths(pathArgs, merged.workspaceAllowlist);
      // Warn when WORKSPACE_ALLOWLIST is configured but this tool invocation supplies no
      // path arguments — the agent will run outside any allowlisted directory and the
      // server cannot verify it stays in an approved workspace.
      if (merged.workspaceAllowlist.length > 0 && pathArgs.length === 0) {
        merged.logger?.warn(
          'workspace-bypass: WORKSPACE_ALLOWLIST is set but no workspace path was supplied — agent will run without workspace path validation',
          { tool: descriptor.name, allowlist: merged.workspaceAllowlist },
        );
      }
      const raw = await descriptor.handler(parsed, executor, merged);
      if (isExecutorResult(raw)) {
        return mapExecutorOutcome(raw);
      }
      return successPayload(raw);
    } catch (err) {
      return mapThrownError(err);
    }
  };
}
