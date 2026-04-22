import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { SecurityError, resolveAndCheck, validatePaths } from '../../src/security.js';

describe('security.validatePaths', () => {
  const base = fs.realpathSync(os.tmpdir());

  it('path exactly matching allowlist entry passes', () => {
    validatePaths([base], [base]);
  });

  it('subdirectory of allowlist passes', () => {
    const sub = path.join(base, 'cursor-cli-mcp-test-sub');
    fs.mkdirSync(sub, { recursive: true });
    try {
      validatePaths([sub], [base]);
    } finally {
      fs.rmSync(sub, { recursive: true, force: true });
    }
  });

  it('../ traversal resolving inside allowlist passes', () => {
    const sub = path.join(base, 'cursor-cli-mcp-nested', 'inner');
    fs.mkdirSync(sub, { recursive: true });
    try {
      const attempt = path.join(sub, '..', '..', 'cursor-cli-mcp-nested', 'inner');
      validatePaths([attempt], [base]);
    } finally {
      fs.rmSync(path.join(base, 'cursor-cli-mcp-nested'), { recursive: true, force: true });
    }
  });

  it('../ traversal resolving outside allowlist throws SECURITY', () => {
    const allowed = fs.mkdtempSync(path.join(base, 'allowed-'));
    const blocked = fs.mkdtempSync(path.join(base, 'blocked-'));
    try {
      expect(() => validatePaths([blocked], [allowed])).toThrow(SecurityError);
    } finally {
      fs.rmSync(allowed, { recursive: true, force: true });
      fs.rmSync(blocked, { recursive: true, force: true });
    }
  });

  it('unrelated path throws SECURITY', () => {
    expect(() => validatePaths(['/unlikely-path-12345/nope'], [base])).toThrow(SecurityError);
  });

  it('empty allowlist denies all', () => {
    expect(() => validatePaths([base], [])).toThrow(SecurityError);
  });

  it('allowlist with trailing slash behaves like without', () => {
    const withSlash = base.endsWith(path.sep) ? base : `${base}${path.sep}`;
    validatePaths([base], [withSlash]);
  });

  it('handles filesystem root allowlist entry', () => {
    const root = path.parse(base).root;
    validatePaths([root], [root]);
  });

  it('symlink resolution checks target when present', () => {
    const dir = fs.mkdtempSync(path.join(base, 'sym-'));
    const target = path.join(dir, 'target');
    fs.mkdirSync(target);
    const link = path.join(dir, 'link');
    try {
      fs.symlinkSync(target, link);
    } catch {
      // skip on platforms without symlink permission
      fs.rmSync(dir, { recursive: true, force: true });
      return;
    }
    try {
      resolveAndCheck(link, [target]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('falls back to string matching when realpath lookup throws', () => {
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const realpathSpy = vi.spyOn(fs, 'realpathSync').mockImplementation(() => {
      throw new Error('realpath unavailable');
    });
    try {
      const allowed = path.resolve('/tmp/allow-root');
      const candidate = path.resolve('/tmp/allow-root/project');
      expect(resolveAndCheck(candidate, [allowed])).toBe(candidate);
    } finally {
      existsSpy.mockRestore();
      realpathSpy.mockRestore();
    }
  });
});
