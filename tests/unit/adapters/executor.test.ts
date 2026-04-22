import { describe, expect, it } from 'vitest';
import { AgentCliExecutor } from '../../../src/adapters/agentCli/executor.js';

const tinyConfig = {
  agentBinaryPath: '/nonexistent-for-field-only',
  agentTimeoutMs: 60_000,
  maxOutputBytes: 1024,
} as const;

describe('AgentCliExecutor', () => {
  const node = process.execPath;

  it('captures stdout on exit 0', async () => {
    const ex = new AgentCliExecutor(tinyConfig);
    const r = await ex.run({
      binary: node,
      args: ['-e', 'process.stdout.write("OK")'],
      timeoutMs: 5000,
      maxOutputBytes: 4096,
    });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('OK');
    expect(r.timedOut).toBe(false);
  });

  it('captures stderr excerpt on non-zero exit', async () => {
    const ex = new AgentCliExecutor(tinyConfig);
    const r = await ex.run({
      binary: node,
      args: ['-e', 'process.stderr.write("ERR"); process.exit(3)'],
      timeoutMs: 5000,
      maxOutputBytes: 4096,
    });
    expect(r.exitCode).toBe(3);
    expect(r.stderrExcerpt).toContain('ERR');
  });

  it('sets timedOut when watchdog fires', async () => {
    const ex = new AgentCliExecutor(tinyConfig);
    const r = await ex.run({
      binary: node,
      args: ['-e', 'setInterval(()=>{},1000)'],
      timeoutMs: 100,
      maxOutputBytes: 4096,
    });
    expect(r.timedOut).toBe(true);
    expect(r.exitCode).toBe(124);
  });

  it('truncates stdout when exceeding maxOutputBytes', async () => {
    const ex = new AgentCliExecutor(tinyConfig);
    const r = await ex.run({
      binary: node,
      args: ['-e', 'process.stdout.write("x".repeat(5000))'],
      timeoutMs: 5000,
      maxOutputBytes: 100,
    });
    expect(r.outputTruncated).toBe(true);
    expect(r.stdout.length).toBeLessThanOrEqual(5000);
  });

  it('returns durationMs >= 0', async () => {
    const ex = new AgentCliExecutor(tinyConfig);
    const r = await ex.run({
      binary: node,
      args: ['-e', 'process.exit(0)'],
      timeoutMs: 5000,
      maxOutputBytes: 4096,
    });
    expect(r.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('maps missing binary to exit 127 via child error path', async () => {
    const ex = new AgentCliExecutor(tinyConfig);
    const r = await ex.run({
      binary: '/path/does/not/exist/agent-bin-xyz',
      args: [],
      timeoutMs: 1000,
      maxOutputBytes: 1024,
    });
    expect(r.exitCode).toBe(127);
  });

  it('keeps stdout and stderr independent', async () => {
    const ex = new AgentCliExecutor(tinyConfig);
    const r = await ex.run({
      binary: node,
      args: ['-e', 'process.stdout.write("A"); process.stderr.write("B")'],
      timeoutMs: 5000,
      maxOutputBytes: 4096,
    });
    expect(r.stdout).toContain('A');
    expect(r.stderrExcerpt).toContain('B');
  });

  it('shutdown completes without throwing when idle', async () => {
    const ex = new AgentCliExecutor(tinyConfig);
    await expect(ex.shutdown()).resolves.toBeUndefined();
  });
});
