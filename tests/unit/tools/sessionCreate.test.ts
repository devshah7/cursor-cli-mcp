import { describe, expect, it } from 'vitest';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { wrapTool } from '../../../src/pipeline/toolPipeline.js';
import type { PipelineContext } from '../../../src/pipeline/toolPipeline.js';
import type { Config } from '../../../src/config.js';
import { pipelineContextFromConfig } from '../../../src/registry/tools.js';
import {
  createSessionCreateDescriptor,
  parseCreateChatStdout,
} from '../../../src/tools/sessionCreate.js';
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

describe('parseCreateChatStdout', () => {
  it('parses single-line UUID and JSON id field', () => {
    expect(parseCreateChatStdout('dfbfe092-1dd0-4e9f-9de0-961f12bf44cd\n')).toBe(
      'dfbfe092-1dd0-4e9f-9de0-961f12bf44cd',
    );
    expect(parseCreateChatStdout('{"id":"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"}')).toBe(
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    );
  });
});

describe('session_create tool', () => {
  const ctx: PipelineContext = pipelineContextFromConfig(baseConfig());

  it('happy path returns sessionId', async () => {
    const executor = new MockExecutor(async () =>
      Promise.resolve({
        stdout: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee\n',
        stderrExcerpt: '',
        exitCode: 0,
        timedOut: false,
        outputTruncated: false,
        durationMs: 4,
      }),
    );
    const wrapped = wrapTool(createSessionCreateDescriptor(ctx), executor, ctx);
    const out = await wrapped({});
    expect(out.isError).not.toBe(true);
    expect(JSON.parse(getText(out))).toEqual({
      sessionId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    });
  });

  it('SECURITY when workspace outside allowlist', async () => {
    const executor = new MockExecutor(async () =>
      Promise.resolve({
        stdout: 'x',
        stderrExcerpt: '',
        exitCode: 0,
        timedOut: false,
        outputTruncated: false,
        durationMs: 1,
      }),
    );
    const wrapped = wrapTool(createSessionCreateDescriptor(ctx), executor, ctx);
    const out = await wrapped({ workspace: '/elsewhere' });
    expect(out.isError).toBe(true);
    expect(JSON.parse(getText(out)).errorClass).toBe('SECURITY');
  });

  it('non-zero exit returns structured agent error', async () => {
    const executor = new MockExecutor(async () =>
      Promise.resolve({
        stdout: '',
        stderrExcerpt: 'fail',
        exitCode: 3,
        timedOut: false,
        outputTruncated: false,
        durationMs: 1,
      }),
    );
    const wrapped = wrapTool(createSessionCreateDescriptor(ctx), executor, ctx);
    const out = await wrapped({});
    expect(out.isError).toBe(true);
    expect(JSON.parse(getText(out)).errorClass).toBe('AGENT_ERROR');
  });
});
