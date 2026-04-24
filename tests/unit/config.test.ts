import { afterEach, describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../../src/config.js';

const saved = { ...process.env };

afterEach(() => {
  process.env = { ...saved };
});

describe('loadConfig', () => {
  it('applies defaults when env absent', () => {
    delete process.env.AGENT_TIMEOUT_MS;
    delete process.env.MAX_OUTPUT_BYTES;
    delete process.env.WORKSPACE_ALLOWLIST;
    delete process.env.LOG_LEVEL;
    delete process.env.LOG_PROMPTS;
    const c = loadConfig(process.env);
    expect(c.agentTimeoutMs).toBe(120_000);
    expect(c.sessionCreateTimeoutMs).toBe(10_000);
    expect(c.maxOutputBytes).toBe(524_288);
    expect(c.workspaceAllowlist).toEqual([]);
    expect(c.logLevel).toBe('info');
    expect(c.logPrompts).toBe(false);
  });

  it('each env overrides its default', () => {
    process.env.AGENT_TIMEOUT_MS = '5000';
    process.env.SESSION_CREATE_TIMEOUT_MS = '7000';
    process.env.MAX_OUTPUT_BYTES = '1';
    process.env.WORKSPACE_ALLOWLIST = '/a:/b';
    process.env.LOG_LEVEL = 'debug';
    process.env.LOG_PROMPTS = 'true';
    const c = loadConfig(process.env);
    expect(c.agentTimeoutMs).toBe(5000);
    expect(c.sessionCreateTimeoutMs).toBe(7000);
    expect(c.maxOutputBytes).toBe(1);
    expect(c.workspaceAllowlist).toEqual(['/a', '/b']);
    expect(c.logLevel).toBe('debug');
    expect(c.logPrompts).toBe(true);
  });

  it('invalid AGENT_TIMEOUT_MS throws ConfigError', () => {
    process.env.AGENT_TIMEOUT_MS = 'not-a-number';
    expect(() => loadConfig(process.env)).toThrow(ConfigError);
  });

  it('invalid MAX_OUTPUT_BYTES throws ConfigError', () => {
    process.env.MAX_OUTPUT_BYTES = '0';
    expect(() => loadConfig(process.env)).toThrow(ConfigError);
  });

  it('invalid SESSION_CREATE_TIMEOUT_MS throws ConfigError', () => {
    process.env.SESSION_CREATE_TIMEOUT_MS = '0';
    expect(() => loadConfig(process.env)).toThrow(ConfigError);
  });

  it('empty WORKSPACE_ALLOWLIST parses to empty array', () => {
    process.env.WORKSPACE_ALLOWLIST = '';
    const c = loadConfig(process.env);
    expect(c.workspaceAllowlist).toEqual([]);
  });
});
