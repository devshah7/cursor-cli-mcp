import { describe, expect, it, vi } from 'vitest';
import { createLogger } from '../../src/logger.js';

describe('createLogger', () => {
  it('writes structured JSON only to stderr, never stdout', () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const log = createLogger({ logLevel: 'info', logPrompts: false });
    log.info('hello', { k: 1 });

    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalled();

    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('does not log prompt text at info when LOG_PROMPTS=false', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const log = createLogger({ logLevel: 'info', logPrompts: false });

    log.info('running', { prompt: 'super-secret-prompt' });

    const raw = String(stderrSpy.mock.calls[0]?.[0] ?? '');
    expect(raw).not.toContain('super-secret-prompt');
    expect(raw).toContain('"promptLength":19');
    stderrSpy.mockRestore();
  });

  it('logs prompt text only at debug when LOG_PROMPTS=true', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const log = createLogger({ logLevel: 'debug', logPrompts: true });

    log.info('running', { prompt: 'visible-only-at-debug' });
    log.debug('running-debug', { prompt: 'visible-only-at-debug' });

    const infoRaw = String(stderrSpy.mock.calls[0]?.[0] ?? '');
    const debugRaw = String(stderrSpy.mock.calls[1]?.[0] ?? '');
    expect(infoRaw).not.toContain('visible-only-at-debug');
    expect(debugRaw).toContain('visible-only-at-debug');
    stderrSpy.mockRestore();
  });
});
