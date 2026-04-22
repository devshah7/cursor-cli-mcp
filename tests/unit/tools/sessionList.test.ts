import { describe, expect, it } from 'vitest';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { wrapTool } from '../../../src/pipeline/toolPipeline.js';
import type { PipelineContext } from '../../../src/pipeline/toolPipeline.js';
import type { Config } from '../../../src/config.js';
import { pipelineContextFromConfig } from '../../../src/registry/tools.js';
import {
  createSessionListDescriptor,
  parseSessionListStdout,
} from '../../../src/tools/sessionList.js';
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
    workspaceAllowlist: [],
    logLevel: 'info',
    logPrompts: false,
    ...overrides,
  };
}

describe('parseSessionListStdout', () => {
  it('parses JSON sessions array and falls back to UUID extraction', () => {
    const json = JSON.stringify({
      sessions: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          createdAt: '2026-01-01T00:00:00Z',
          title: 't',
        },
      ],
    });
    expect(parseSessionListStdout(json, 20)).toEqual([
      {
        id: '11111111-1111-1111-1111-111111111111',
        createdAt: '2026-01-01T00:00:00Z',
        title: 't',
      },
    ]);
    const noisy =
      '\x1b[31mNote\x1b[0m aa0e8400-e29b-41d4-a716-446655440000 bb0e8400-e29b-41d4-a716-446655440001';
    expect(parseSessionListStdout(noisy, 10)).toEqual([
      { id: 'aa0e8400-e29b-41d4-a716-446655440000', createdAt: '' },
      { id: 'bb0e8400-e29b-41d4-a716-446655440001', createdAt: '' },
    ]);
  });
});

describe('session_list tool', () => {
  const ctx: PipelineContext = pipelineContextFromConfig(baseConfig());

  it('happy path returns sessions parsed from stdout', async () => {
    const executor = new MockExecutor(async () =>
      Promise.resolve({
        stdout:
          '{"sessions":[{"id":"11111111-1111-1111-1111-111111111111","createdAt":"","title":"x"}]}',
        stderrExcerpt: '',
        exitCode: 0,
        timedOut: false,
        outputTruncated: false,
        durationMs: 5,
      }),
    );
    const wrapped = wrapTool(createSessionListDescriptor(ctx), executor, ctx);
    const out = await wrapped({});
    expect(out.isError).not.toBe(true);
    expect(JSON.parse(getText(out)).sessions).toHaveLength(1);
    expect(JSON.parse(getText(out)).sessions[0].id).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('respects limit when parsing line-oriented UUIDs', async () => {
    const executor = new MockExecutor(async () =>
      Promise.resolve({
        stdout:
          'cc0e8400-e29b-41d4-a716-446655440000 dd0e8400-e29b-41d4-a716-446655440001 ee0e8400-e29b-41d4-a716-446655440002',
        stderrExcerpt: '',
        exitCode: 0,
        timedOut: false,
        outputTruncated: false,
        durationMs: 1,
      }),
    );
    const wrapped = wrapTool(createSessionListDescriptor(ctx), executor, ctx);
    const out = await wrapped({ limit: 2 });
    expect(JSON.parse(getText(out)).sessions).toHaveLength(2);
  });

  it('AGENT_ERROR when agent ls exits non-zero', async () => {
    const executor = new MockExecutor(async () =>
      Promise.resolve({
        stdout: '',
        stderrExcerpt: 'Raw mode',
        exitCode: 1,
        timedOut: false,
        outputTruncated: false,
        durationMs: 2,
      }),
    );
    const wrapped = wrapTool(createSessionListDescriptor(ctx), executor, ctx);
    const out = await wrapped({});
    expect(out.isError).toBe(true);
    expect(JSON.parse(getText(out)).errorClass).toBe('AGENT_ERROR');
  });
});
