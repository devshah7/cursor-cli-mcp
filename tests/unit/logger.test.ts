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
});
