import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { wrapTool } from '../../../src/pipeline/toolPipeline.js';
import type { PipelineContext } from '../../../src/pipeline/toolPipeline.js';
import type { ToolDescriptor } from '../../../src/registry/tools.js';
import type { ExecutorResult } from '../../../src/ports/executorTypes.js';
import { createMockExecutor as baseMock } from '../../fixtures/mockExecutor.js';

function getText(result: CallToolResult): string {
  const c = result.content?.[0];
  return c?.type === 'text' ? c.text : '{}';
}

const schema = z.object({ msg: z.string().min(1) });

function pc(allowlist: string[]): PipelineContext {
  return {
    workspaceAllowlist: allowlist,
    agentBinaryPath: '/usr/local/bin/agent',
    agentTimeoutMs: 5000,
    maxOutputBytes: 4096,
  };
}

describe('toolPipeline.wrapTool', () => {
  it('happy path returns JSON text payload', async () => {
    const descriptor: ToolDescriptor<{ msg: string }> = {
      name: 't_happy',
      description: 'x',
      schema,
      pathArgs: () => [],
      handler: async ({ msg }, _executor, _toolCtx) => ({ echo: msg }),
    };
    const wrapped = wrapTool(descriptor, baseMock(), pc(['/tmp']));
    const out = await wrapped({ msg: 'hi' });
    expect(out.isError).not.toBe(true);
    expect(JSON.parse(getText(out))).toEqual({ echo: 'hi' });
  });

  it('maps Zod failure to VALIDATION', async () => {
    const descriptor: ToolDescriptor<{ msg: string }> = {
      name: 't_val',
      description: 'x',
      schema,
      pathArgs: () => [],
      handler: async (_input, _executor, _toolCtx) => ({}),
    };
    const wrapped = wrapTool(descriptor, baseMock(), pc(['/tmp']));
    const out = await wrapped({ msg: '' });
    expect(out.isError).toBe(true);
    const body = JSON.parse(getText(out));
    expect(body.errorClass).toBe('VALIDATION');
  });

  it('maps SecurityError path to SECURITY', async () => {
    const descriptor: ToolDescriptor<{ msg: string }> = {
      name: 't_sec',
      description: 'x',
      schema,
      pathArgs: () => ['/not-allowed/path'],
      handler: async (_input, _executor, _toolCtx) => 'x',
    };
    const wrapped = wrapTool(descriptor, baseMock(), pc(['/tmp/x']));
    const out = await wrapped({ msg: 'hi' });
    expect(out.isError).toBe(true);
    const body = JSON.parse(getText(out));
    expect(body.errorClass).toBe('SECURITY');
  });

  it('maps executor non-zero exit to AGENT_ERROR', async () => {
    const descriptor: ToolDescriptor<{ msg: string }> = {
      name: 't_agent_err',
      description: 'x',
      schema,
      pathArgs: () => [],
      handler: async (_input, _executor, _toolCtx): Promise<ExecutorResult> => ({
        stdout: '',
        stderrExcerpt: 'boom',
        exitCode: 7,
        timedOut: false,
        outputTruncated: false,
        durationMs: 1,
      }),
    };
    const wrapped = wrapTool(descriptor, baseMock(), pc([]));
    const out = await wrapped({ msg: 'hi' });
    expect(out.isError).toBe(true);
    const body = JSON.parse(getText(out));
    expect(body.errorClass).toBe('AGENT_ERROR');
    expect(body.exitCode).toBe(7);
  });

  it('maps timedOut to TIMEOUT', async () => {
    const descriptor: ToolDescriptor<{ msg: string }> = {
      name: 't_timeout',
      description: 'x',
      schema,
      pathArgs: () => [],
      handler: async (_input, _executor, _toolCtx): Promise<ExecutorResult> => ({
        stdout: '',
        stderrExcerpt: '',
        exitCode: 1,
        timedOut: true,
        outputTruncated: false,
        durationMs: 1,
      }),
    };
    const wrapped = wrapTool(descriptor, baseMock(), pc([]));
    const out = await wrapped({ msg: 'hi' });
    expect(out.isError).toBe(true);
    const body = JSON.parse(getText(out));
    expect(body.errorClass).toBe('TIMEOUT');
    expect(body.timedOut).toBe(true);
  });

  it('maps ENOENT throw to BINARY_NOT_FOUND', async () => {
    const descriptor: ToolDescriptor<{ msg: string }> = {
      name: 't_enoent',
      description: 'x',
      schema,
      pathArgs: () => [],
      handler: async (_input, _executor, _toolCtx) => {
        const e = new Error('missing') as NodeJS.ErrnoException;
        e.code = 'ENOENT';
        throw e;
      },
    };
    const wrapped = wrapTool(descriptor, baseMock(), pc([]));
    const out = await wrapped({ msg: 'hi' });
    expect(out.isError).toBe(true);
    const body = JSON.parse(getText(out));
    expect(body.errorClass).toBe('BINARY_NOT_FOUND');
  });
});
