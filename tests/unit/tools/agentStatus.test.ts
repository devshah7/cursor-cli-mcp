import { describe, expect, it } from 'vitest';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { wrapTool } from '../../../src/pipeline/toolPipeline.js';
import type { PipelineContext } from '../../../src/pipeline/toolPipeline.js';
import type { Config } from '../../../src/config.js';
import { pipelineContextFromConfig } from '../../../src/registry/tools.js';
import { createAgentStatusDescriptor } from '../../../src/tools/agentStatus.js';
import { MockExecutor } from '../../fixtures/mockExecutor.js';

function getText(result: CallToolResult): string {
  const c = result.content?.[0];
  return c?.type === 'text' ? c.text : '{}';
}

function baseConfig(overrides?: Partial<Config>): Config {
  return {
    agentBinaryPath: '/usr/local/bin/agent',
    agentTimeoutMs: 5000,
    sessionCreateTimeoutMs: 5000,
    maxOutputBytes: 4096,
    workspaceAllowlist: [],
    logLevel: 'info',
    logPrompts: false,
    ...overrides,
  };
}

describe('agent_status tool', () => {
  const ctx: PipelineContext = pipelineContextFromConfig(baseConfig());

  it('exit 0 → authenticated true with binaryPath', async () => {
    const executor = new MockExecutor(async () =>
      Promise.resolve({
        stdout: 'v1',
        stderrExcerpt: '',
        exitCode: 0,
        timedOut: false,
        outputTruncated: false,
        durationMs: 2,
      }),
    );
    const wrapped = wrapTool(createAgentStatusDescriptor(ctx), executor, ctx);
    const out = await wrapped({});
    expect(out.isError).not.toBe(true);
    const body = JSON.parse(getText(out));
    expect(body.authenticated).toBe(true);
    expect(body.binaryPath).toBe('/usr/local/bin/agent');
    expect(body.version).toBe('v1');
  });

  it('exit non-zero → success JSON with authenticated false (not isError)', async () => {
    const executor = new MockExecutor(async () =>
      Promise.resolve({
        stdout: '',
        stderrExcerpt: 'not logged in',
        exitCode: 1,
        timedOut: false,
        outputTruncated: false,
        durationMs: 2,
      }),
    );
    const wrapped = wrapTool(createAgentStatusDescriptor(ctx), executor, ctx);
    const out = await wrapped({});
    expect(out.isError).not.toBe(true);
    const body = JSON.parse(getText(out));
    expect(body.authenticated).toBe(false);
    expect(body.binaryPath).toBe('/usr/local/bin/agent');
  });

  it('exit 127 → BINARY_NOT_FOUND error', async () => {
    const executor = new MockExecutor(async () =>
      Promise.resolve({
        stdout: '',
        stderrExcerpt: '',
        exitCode: 127,
        timedOut: false,
        outputTruncated: false,
        durationMs: 1,
      }),
    );
    const wrapped = wrapTool(createAgentStatusDescriptor(ctx), executor, ctx);
    const out = await wrapped({});
    expect(out.isError).toBe(true);
    expect(JSON.parse(getText(out)).errorClass).toBe('BINARY_NOT_FOUND');
  });

  it('binaryPath always present on success responses', async () => {
    const cfg = baseConfig({ agentBinaryPath: '/opt/agent' });
    const pctx = pipelineContextFromConfig(cfg);
    const executor = new MockExecutor(async () =>
      Promise.resolve({
        stdout: '',
        stderrExcerpt: '',
        exitCode: 1,
        timedOut: false,
        outputTruncated: false,
        durationMs: 1,
      }),
    );
    const wrapped = wrapTool(createAgentStatusDescriptor(pctx), executor, pctx);
    const out = await wrapped({});
    expect(JSON.parse(getText(out)).binaryPath).toBe('/opt/agent');
  });
});
