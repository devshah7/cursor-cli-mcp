import { describe, expect, it } from 'vitest';
import type { Config } from '../../../src/config.js';
import { buildToolDescriptors, type ToolDescriptor } from '../../../src/registry/tools.js';

// Update this list whenever a tool gains or loses supportsStreaming (must match handlers that use toolCtx.sendNotification).
const STREAMING_TOOL_NAMES = ['run_agent', 'session_resume'] as const;

describe('buildToolDescriptors', () => {
  it('returns five tools with expected names', () => {
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
  });

  it('streaming tools advertise supportsStreaming and registry snapshot matches', () => {
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
    const runAgent = tools.find((t: ToolDescriptor<unknown>) => t.name === 'run_agent');
    const sessionResume = tools.find((t: ToolDescriptor<unknown>) => t.name === 'session_resume');
    expect(runAgent?.supportsStreaming).toBe(true);
    expect(sessionResume?.supportsStreaming).toBe(true);

    const flagged = tools
      .filter((t: ToolDescriptor<unknown>) => t.supportsStreaming)
      .map((t) => t.name)
      .sort();
    expect(flagged).toEqual([...STREAMING_TOOL_NAMES].sort());
  });
});
