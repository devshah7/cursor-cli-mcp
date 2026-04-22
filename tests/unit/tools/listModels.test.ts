import { describe, expect, it } from 'vitest';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { wrapTool } from '../../../src/pipeline/toolPipeline.js';
import type { PipelineContext } from '../../../src/pipeline/toolPipeline.js';
import type { Config } from '../../../src/config.js';
import { pipelineContextFromConfig } from '../../../src/registry/tools.js';
import { createListModelsDescriptor, parseModelsStdout } from '../../../src/tools/listModels.js';
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

describe('parseModelsStdout', () => {
  it('parses JSON array and object wrapper', () => {
    expect(parseModelsStdout('["x","y"]')).toEqual(['x', 'y']);
    expect(parseModelsStdout('{\n "models": ["a"] \n}')).toEqual(['a']);
  });

  it('falls back to non-empty lines', () => {
    expect(parseModelsStdout('one\ntwo\n')).toEqual(['one', 'two']);
  });
});

describe('list_models tool', () => {
  const ctx: PipelineContext = pipelineContextFromConfig(baseConfig());

  it('happy path returns models array', async () => {
    const executor = new MockExecutor(async () =>
      Promise.resolve({
        stdout: '["a","b"]',
        stderrExcerpt: '',
        exitCode: 0,
        timedOut: false,
        outputTruncated: false,
        durationMs: 5,
      }),
    );
    const wrapped = wrapTool(createListModelsDescriptor(ctx), executor, ctx);
    const out = await wrapped({});
    expect(out.isError).not.toBe(true);
    expect(JSON.parse(getText(out))).toEqual({ models: ['a', 'b'] });
  });

  it('BINARY_NOT_FOUND when exit 127', async () => {
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
    const wrapped = wrapTool(createListModelsDescriptor(ctx), executor, ctx);
    const out = await wrapped({});
    expect(out.isError).toBe(true);
    expect(JSON.parse(getText(out)).errorClass).toBe('BINARY_NOT_FOUND');
  });

  it('AGENT_ERROR on non-zero exit', async () => {
    const executor = new MockExecutor(async () =>
      Promise.resolve({
        stdout: '',
        stderrExcerpt: 'bad',
        exitCode: 2,
        timedOut: false,
        outputTruncated: false,
        durationMs: 1,
      }),
    );
    const wrapped = wrapTool(createListModelsDescriptor(ctx), executor, ctx);
    const out = await wrapped({});
    expect(out.isError).toBe(true);
    expect(JSON.parse(getText(out)).errorClass).toBe('AGENT_ERROR');
  });

  it('empty stdout yields empty models array', async () => {
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
    const wrapped = wrapTool(createListModelsDescriptor(ctx), executor, ctx);
    const out = await wrapped({});
    expect(out.isError).not.toBe(true);
    expect(JSON.parse(getText(out))).toEqual({ models: [] });
  });
});
