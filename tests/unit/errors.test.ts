import { describe, expect, it } from 'vitest';
import { ErrorClass, buildError, type StructuredError } from '../../src/errors.js';

describe('errors', () => {
  it('ErrorClass literals match API_SPEC §2.1 taxonomy', () => {
    const expected = new Set([
      'BINARY_NOT_FOUND',
      'AUTH_REQUIRED',
      'TIMEOUT',
      'OUTPUT_TRUNCATED',
      'SECURITY',
      'VALIDATION',
      'AGENT_ERROR',
      'UNKNOWN',
    ]);
    expect(new Set(Object.values(ErrorClass))).toEqual(expected);
  });

  it('buildError with extras merges fields', () => {
    const e: StructuredError = buildError(ErrorClass.TIMEOUT, 'timed out', { timedOut: true });
    expect(e.errorClass).toBe('TIMEOUT');
    expect(e.message).toBe('timed out');
    expect(e.timedOut).toBe(true);
  });

  it('buildError without extras has only errorClass and message keys', () => {
    const e = buildError(ErrorClass.VALIDATION, 'bad input');
    expect(Object.keys(e).sort()).toEqual(['errorClass', 'message']);
  });
});
