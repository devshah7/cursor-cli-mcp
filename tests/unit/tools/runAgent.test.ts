import { describe, expect, it } from 'vitest';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { wrapTool } from '../../../src/pipeline/toolPipeline.js';
import type { PipelineContext } from '../../../src/pipeline/toolPipeline.js';
import { pipelineContextFromConfig } from '../../../src/registry/tools.js';
import type { Config } from '../../../src/config.js';
import { createRunAgentDescriptor } from '../../../src/tools/runAgent.js';
import { MockExecutor } from '../../fixtures/mockExecutor.js';

function getText(result: CallToolResult): string {
  const c = result.content?.[0];
  return c?.type === 'text' ? c.text : '{}';
}

function baseConfig(overrides?: Partial<Config>): Config {
  return {
    agentBinaryPath: '/usr/local/bin/agent',
    agentTimeoutMs: 5000,
    maxOutputBytes: 4096,
    workspaceAllowlist: ['/allowed'],
    logLevel: 'info',
    logPrompts: false,
    ...overrides,
  };
}

describe('run_agent tool', () => {
  const ctx: PipelineContext = pipelineContextFromConfig(baseConfig());

  it('happy path returns AgentRunResult JSON on exit 0', async () => {
    const executor = new MockExecutor(() =>
      Promise.resolve({
        stdout: 'ok',
        stderrExcerpt: '',
        exitCode: 0,
        timedOut: false,
        outputTruncated: false,
        durationMs: 12,
      }),
    );
    const wrapped = wrapTool(createRunAgentDescriptor(ctx), executor, ctx);
    const out = await wrapped({
      prompt: 'hello',
    });
    expect(out.isError).not.toBe(true);
    const body = JSON.parse(getText(out));
    expect(body.stdout).toBe('ok');
    expect(body.exitCode).toBe(0);
    expect(body.timedOut).toBe(false);
    expect(body.outputTruncated).toBe(false);
    expect(body.durationMs).toBe(12);
  });

  it('validation failure returns VALIDATION and never calls executor', async () => {
    let runs = 0;
    const executor = new MockExecutor(async () => {
      runs++;
      throw new Error('should not run');
    });
    const wrapped = wrapTool(createRunAgentDescriptor(ctx), executor, ctx);
    const out = await wrapped({ prompt: '' });
    expect(runs).toBe(0);
    expect(out.isError).toBe(true);
    expect(JSON.parse(getText(out)).errorClass).toBe('VALIDATION');
  });

  it('SECURITY when workspace outside allowlist', async () => {
    const executor = new MockExecutor(async () =>
      Promise.resolve({
        stdout: '',
        stderrExcerpt: '',
        exitCode: 0,
        timedOut: false,
        outputTruncated: false,
        durationMs: 1,
      }),
    );
    const blocked = pipelineContextFromConfig(baseConfig({ workspaceAllowlist: ['/allowed'] }));
    const wrapped = wrapTool(createRunAgentDescriptor(blocked), executor, blocked);
    const out = await wrapped({
      prompt: 'x',
      workspace: '/elsewhere/not-allowed',
    });
    expect(out.isError).toBe(true);
    expect(JSON.parse(getText(out)).errorClass).toBe('SECURITY');
  });

  it('executor non-zero maps to AGENT_ERROR', async () => {
    const executor = new MockExecutor(async () =>
      Promise.resolve({
        stdout: '',
        stderrExcerpt: 'err',
        exitCode: 9,
        timedOut: false,
        outputTruncated: false,
        durationMs: 3,
      }),
    );
    const wrapped = wrapTool(createRunAgentDescriptor(ctx), executor, ctx);
    const out = await wrapped({ prompt: 'hello' });
    expect(out.isError).toBe(true);
    expect(JSON.parse(getText(out)).errorClass).toBe('AGENT_ERROR');
  });

  it('timedOut maps to TIMEOUT', async () => {
    const executor = new MockExecutor(async () =>
      Promise.resolve({
        stdout: '',
        stderrExcerpt: '',
        exitCode: 1,
        timedOut: true,
        outputTruncated: false,
        durationMs: 5000,
      }),
    );
    const wrapped = wrapTool(createRunAgentDescriptor(ctx), executor, ctx);
    const out = await wrapped({ prompt: 'hello' });
    expect(out.isError).toBe(true);
    expect(JSON.parse(getText(out)).errorClass).toBe('TIMEOUT');
  });

  it('BINARY_NOT_FOUND when executor returns spawn-style 127', async () => {
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
    const wrapped = wrapTool(createRunAgentDescriptor(ctx), executor, ctx);
    const out = await wrapped({ prompt: 'hello' });
    expect(out.isError).toBe(true);
    expect(JSON.parse(getText(out)).errorClass).toBe('BINARY_NOT_FOUND');
  });
});
