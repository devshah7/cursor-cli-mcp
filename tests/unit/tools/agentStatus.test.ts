import { describe, expect, it } from 'vitest';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { wrapTool } from '../../../src/pipeline/toolPipeline.js';
import type { PipelineContext } from '../../../src/pipeline/toolPipeline.js';
import type { Config } from '../../../src/config.js';
import type { ExecutorOptions, ExecutorResult } from '../../../src/ports/executorTypes.js';
import { pipelineContextFromConfig } from '../../../src/registry/tools.js';
import {
  createAgentStatusDescriptor,
  parseAboutJson,
  parseStatusJson,
} from '../../../src/tools/agentStatus.js';
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
    promptMaxChars: 20_000,
    workspaceAllowlist: [],
    logLevel: 'info',
    logPrompts: false,
    ...overrides,
  };
}

function ok(stdout: string, exitCode = 0): ExecutorResult {
  return {
    stdout,
    stderrExcerpt: '',
    exitCode,
    timedOut: false,
    outputTruncated: false,
    durationMs: 2,
  };
}

/** Real `agent status --format json` output, captured 2026-09-07 from 2026.07.23-e383d2b. */
const HEALTHY_STATUS = JSON.stringify({
  status: 'authenticated',
  isAuthenticated: true,
  hasAccessToken: true,
  hasRefreshToken: true,
  userInfo: { email: 'dev@example.com', userId: 1, firstName: 'Dev', lastName: 'Shah' },
});

/** Cached token present, no userInfo — the session-expiry shape the CLI still exits 0 on. */
const STALE_STATUS = JSON.stringify({
  status: 'authenticated',
  isAuthenticated: true,
  hasAccessToken: true,
  hasRefreshToken: true,
});

const LOGGED_OUT_STATUS = JSON.stringify({
  status: 'unauthenticated',
  isAuthenticated: false,
  hasAccessToken: false,
  hasRefreshToken: false,
});

/** Real `agent about --format json` output, captured 2026-09-07. */
const ABOUT = JSON.stringify({
  cliVersion: '2026.07.23-e383d2b',
  model: 'Sonnet 4.5 No Thinking',
  subscriptionTier: 'Pro',
  osPlatform: 'darwin',
  userEmail: 'dev@example.com',
});

/** Route by command kind so a two-call handler can be driven deterministically. */
function routed(map: Partial<Record<string, ExecutorResult>>): MockExecutor {
  return new MockExecutor((options: ExecutorOptions) => {
    const result = map[options.command.kind];
    if (result === undefined) {
      throw new Error(`unexpected command kind: ${options.command.kind}`);
    }
    return result;
  });
}

describe('agent_status tool', () => {
  const ctx: PipelineContext = pipelineContextFromConfig(baseConfig());

  it('healthy session → authenticated true with account and version fields', async () => {
    const executor = routed({ agent_status: ok(HEALTHY_STATUS), agent_about: ok(ABOUT) });
    const wrapped = wrapTool(createAgentStatusDescriptor(ctx), executor, ctx);
    const out = await wrapped({});
    expect(out.isError).not.toBe(true);
    const body = JSON.parse(getText(out));
    expect(body.authenticated).toBe(true);
    expect(body.staleSession).toBeUndefined();
    expect(body.binaryPath).toBe('/usr/local/bin/agent');
    expect(body.statusSource).toBe('json');
    expect(body.agentCliVersion).toBe('2026.07.23-e383d2b');
    expect(body.userEmail).toBe('dev@example.com');
    expect(body.subscriptionTier).toBe('Pro');
    expect(body.defaultModel).toBe('Sonnet 4.5 No Thinking');
  });

  it('stale cached token → authenticated false with staleSession flag', async () => {
    const executor = routed({ agent_status: ok(STALE_STATUS), agent_about: ok(ABOUT) });
    const wrapped = wrapTool(createAgentStatusDescriptor(ctx), executor, ctx);
    const out = await wrapped({});
    expect(out.isError).not.toBe(true);
    const body = JSON.parse(getText(out));
    expect(body.authenticated).toBe(false);
    expect(body.staleSession).toBe(true);
  });

  it('logged out → authenticated false without staleSession', async () => {
    const executor = routed({ agent_status: ok(LOGGED_OUT_STATUS, 1), agent_about: ok(ABOUT) });
    const wrapped = wrapTool(createAgentStatusDescriptor(ctx), executor, ctx);
    const out = await wrapped({});
    const body = JSON.parse(getText(out));
    expect(body.authenticated).toBe(false);
    expect(body.staleSession).toBeUndefined();
  });

  it('unparseable status stdout → plain-text fallback probe', async () => {
    const executor = routed({
      agent_status: ok('Login successful'),
      agent_status_text: ok('Login successful'),
    });
    const wrapped = wrapTool(createAgentStatusDescriptor(ctx), executor, ctx);
    const out = await wrapped({});
    expect(out.isError).not.toBe(true);
    const body = JSON.parse(getText(out));
    expect(body).toEqual({
      authenticated: true,
      binaryPath: '/usr/local/bin/agent',
      statusSource: 'text-fallback',
    });
  });

  it('about call failing still yields an authenticated response', async () => {
    const executor = routed({ agent_status: ok(HEALTHY_STATUS), agent_about: ok('', 1) });
    const wrapped = wrapTool(createAgentStatusDescriptor(ctx), executor, ctx);
    const body = JSON.parse(getText(await wrapped({})));
    expect(body.authenticated).toBe(true);
    expect(body.agentCliVersion).toBeUndefined();
    expect(body.userEmail).toBe('dev@example.com');
  });

  it('exit 127 → BINARY_NOT_FOUND error', async () => {
    const executor = routed({ agent_status: ok('', 127) });
    const wrapped = wrapTool(createAgentStatusDescriptor(ctx), executor, ctx);
    const out = await wrapped({});
    expect(out.isError).toBe(true);
    expect(JSON.parse(getText(out)).errorClass).toBe('BINARY_NOT_FOUND');
  });

  it('timeout returns TIMEOUT StructuredError', async () => {
    const executor = new MockExecutor(() => ({
      stdout: '',
      stderrExcerpt: '',
      exitCode: 124,
      timedOut: true,
      outputTruncated: false,
      durationMs: 1000,
    }));
    const wrapped = wrapTool(createAgentStatusDescriptor(ctx), executor, ctx);
    const out = await wrapped({});
    expect(out.isError).toBe(true);
    expect(JSON.parse(getText(out)).errorClass).toBe('TIMEOUT');
  });

  it('binaryPath always present on success responses', async () => {
    const pctx = pipelineContextFromConfig(baseConfig({ agentBinaryPath: '/opt/agent' }));
    const executor = routed({ agent_status: ok(LOGGED_OUT_STATUS, 1), agent_about: ok(ABOUT) });
    const wrapped = wrapTool(createAgentStatusDescriptor(pctx), executor, pctx);
    expect(JSON.parse(getText(await wrapped({}))).binaryPath).toBe('/opt/agent');
  });
});

describe('parseStatusJson', () => {
  it('requires userInfo before reporting authenticated', () => {
    expect(parseStatusJson(HEALTHY_STATUS)?.authenticated).toBe(true);
    expect(parseStatusJson(STALE_STATUS)?.authenticated).toBe(false);
    expect(parseStatusJson(STALE_STATUS)?.staleSession).toBe(true);
  });

  it('returns null for non-JSON and for JSON missing the auth fields', () => {
    expect(parseStatusJson('Login successful')).toBeNull();
    expect(parseStatusJson('{"unrelated":"shape"}')).toBeNull();
    expect(parseStatusJson('')).toBeNull();
  });
});

describe('parseAboutJson', () => {
  it('extracts version and account fields', () => {
    const parsed = parseAboutJson(ABOUT);
    expect(parsed?.agentCliVersion).toBe('2026.07.23-e383d2b');
    expect(parsed?.subscriptionTier).toBe('Pro');
    expect(parsed?.defaultModel).toBe('Sonnet 4.5 No Thinking');
  });

  it('returns null for non-JSON', () => {
    expect(parseAboutJson('Version 1.2.3')).toBeNull();
  });
});
