import { ZodError } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ErrorClass, buildError, type StructuredError } from '../errors.js';
import type { ExecutorResult } from '../ports/executorTypes.js';
import type { IAgentExecutor } from '../ports/agentExecutor.js';
import type { ToolDescriptor } from '../registry/tools.js';
import { SecurityError, validatePaths } from '../security.js';

/** Per-request tooling context from `Config` — passed into tool factories and `wrapTool`. */
export interface PipelineContext {
  workspaceAllowlist: string[];
  agentBinaryPath: string;
  agentTimeoutMs: number;
  maxOutputBytes: number;
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
): (args: unknown) => Promise<CallToolResult> {
  return async (args: unknown) => {
    try {
      const parsed = descriptor.schema.parse(args);
      validatePaths(descriptor.pathArgs(parsed), ctx.workspaceAllowlist);
      const raw = await descriptor.handler(parsed, executor);
      if (isExecutorResult(raw)) {
        return mapExecutorOutcome(raw);
      }
      return successPayload(raw);
    } catch (err) {
      return mapThrownError(err);
    }
  };
}
