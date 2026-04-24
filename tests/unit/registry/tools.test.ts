import { describe, expect, it } from 'vitest';
import type { Config } from '../../../src/config.js';
import { buildToolDescriptors, type ToolDescriptor } from '../../../src/registry/tools.js';

describe('buildToolDescriptors', () => {
  it('returns five tools with expected names and streaming on run_agent', () => {
    const config: Config = {
      agentBinaryPath: '/tmp/cursor-agent-test-binary',
      agentTimeoutMs: 60_000,
      sessionCreateTimeoutMs: 10_000,
      maxOutputBytes: 4096,
      workspaceAllowlist: [],
      logLevel: 'info',
      logPrompts: false,
    };
    const tools = buildToolDescriptors(config);
    expect(tools).toHaveLength(5);
    const names = tools.map((t: ToolDescriptor<unknown>) => t.name).sort();
    expect(names).toEqual([
      'agent_status',
      'list_models',
      'run_agent',
      'session_create',
      'session_resume',
    ]);
    const runAgent = tools.find((t: ToolDescriptor<unknown>) => t.name === 'run_agent');
    expect(runAgent?.supportsStreaming).toBe(true);
  });
});
