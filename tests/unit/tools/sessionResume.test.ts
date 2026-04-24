import { describe, expect, it } from 'vitest';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { wrapTool } from '../../../src/pipeline/toolPipeline.js';
import type { PipelineContext } from '../../../src/pipeline/toolPipeline.js';
import type { Config } from '../../../src/config.js';
import { pipelineContextFromConfig } from '../../../src/registry/tools.js';
import { createSessionResumeDescriptor } from '../../../src/tools/sessionResume.js';
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
    workspaceAllowlist: ['/allowed'],
    logLevel: 'info',
    logPrompts: false,
    ...overrides,
  };
}

describe('session_resume tool', () => {
  const ctx: PipelineContext = pipelineContextFromConfig(baseConfig());

  it('happy path returns AgentRunResult JSON on exit 0', async () => {
    const executor = new MockExecutor(async () =>
      Promise.resolve({
        stdout: 'done',
        stderrExcerpt: '',
        exitCode: 0,
        timedOut: false,
        outputTruncated: false,
        durationMs: 8,
      }),
    );
    const wrapped = wrapTool(createSessionResumeDescriptor(ctx), executor, ctx);
    const out = await wrapped({
      session_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      prompt: 'next step',
    });
    expect(out.isError).not.toBe(true);
    const body = JSON.parse(getText(out));
    expect(body.stdout).toBe('done');
    expect(body.exitCode).toBe(0);
  });

  it('passes -p prompt --resume session_id to executor', async () => {
    let seenArgs: string[] = [];
    const executor = new MockExecutor(async (opts) => {
      seenArgs = opts.args;
      return {
        stdout: '',
        stderrExcerpt: '',
        exitCode: 0,
        timedOut: false,
        outputTruncated: false,
        durationMs: 1,
      };
    });
    const wrapped = wrapTool(createSessionResumeDescriptor(ctx), executor, ctx);
    await wrapped({
      session_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      prompt: 'hello',
    });
    expect(seenArgs[0]).toBe('-p');
    expect(seenArgs[1]).toBe('hello');
    expect(seenArgs[2]).toBe('--resume');
    expect(seenArgs[3]).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  });

  it('rejects session_id path traversal patterns (VALIDATION)', async () => {
    let runs = 0;
    const executor = new MockExecutor(async () => {
      runs++;
      throw new Error('should not run');
    });
    const wrapped = wrapTool(createSessionResumeDescriptor(ctx), executor, ctx);
    const out = await wrapped({
      session_id: '../../../etc/passwd',
      prompt: 'x',
    });
    expect(runs).toBe(0);
    expect(out.isError).toBe(true);
    expect(JSON.parse(getText(out)).errorClass).toBe('VALIDATION');
  });

  it('forwards stdout chunks when sendNotification is injected', async () => {
    const chunks: string[] = [];
    const executor = new MockExecutor(async (opts) => {
      opts.onStdoutChunk?.('chunk');
      return {
        stdout: 'chunk',
        stderrExcerpt: '',
        exitCode: 0,
        timedOut: false,
        outputTruncated: false,
        durationMs: 1,
      };
    });
    const wrapped = wrapTool(createSessionResumeDescriptor(ctx), executor, ctx);
    await wrapped(
      { session_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', prompt: 'hi' },
      {
        sendNotification: (c: string) => {
          chunks.push(c);
        },
      },
    );
    expect(chunks).toEqual(['chunk']);
  });

  it('rejects model path traversal payload (VALIDATION)', async () => {
    let runs = 0;
    const executor = new MockExecutor(async () => {
      runs++;
      throw new Error('should not run');
    });
    const wrapped = wrapTool(createSessionResumeDescriptor(ctx), executor, ctx);
    const out = await wrapped({
      session_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      prompt: 'x',
      model: '../../etc/passwd',
    });
    expect(runs).toBe(0);
    expect(out.isError).toBe(true);
    expect(JSON.parse(getText(out)).errorClass).toBe('VALIDATION');
  });

  it('accepts canonical model ids', async () => {
    const accepted = ['claude-4-sonnet', 'openai/gpt-4o', 'gpt-5.4-high'];
    for (const model of accepted) {
      const executor = new MockExecutor(async () => ({
        stdout: 'done',
        stderrExcerpt: '',
        exitCode: 0,
        timedOut: false,
        outputTruncated: false,
        durationMs: 1,
      }));
      const wrapped = wrapTool(createSessionResumeDescriptor(ctx), executor, ctx);
      const out = await wrapped({
        session_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        prompt: 'next',
        model,
      });
      expect(out.isError).not.toBe(true);
    }
  });
});
