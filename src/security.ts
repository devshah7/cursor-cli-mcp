import fs from 'node:fs';
import path from 'node:path';

export class SecurityError extends Error {
  readonly name = 'SecurityError';
}

/**
 * Normalize for prefix matching: trailing slash prevents `/home/alice` matching `/home/alice2`.
 */
function asDirPrefix(p: string): string {
  const normalized = path.resolve(p);
  return normalized.endsWith(path.sep) ? normalized : `${normalized}${path.sep}`;
}

/**
 * Path validation per docs/ARCHITECTURE.md § 4.9 (seven rules).
 */
export function validatePaths(candidatePaths: string[], allowlist: string[]): void {
  for (const raw of candidatePaths) {
    resolveAndCheck(raw, allowlist);
  }
}

export function resolveAndCheck(raw: string, allowlist: string[]): string {
  if (allowlist.length === 0) {
    throw new SecurityError('WORKSPACE_ALLOWLIST is empty — all paths denied');
  }

  let resolved = path.resolve(raw);

  try {
    if (fs.existsSync(resolved)) {
      resolved = fs.realpathSync(resolved);
    }
  } catch {
    // Non-existent paths: string-match only (rule 5)
  }

  const candidatePrefix = asDirPrefix(resolved);

  for (const entry of allowlist) {
    const baseResolved = path.resolve(entry);
    const rootPrefix = asDirPrefix(baseResolved);

    if (candidatePrefix === rootPrefix || candidatePrefix.startsWith(rootPrefix)) {
      return resolved;
    }
  }

  throw new SecurityError(`Path not allowed by WORKSPACE_ALLOWLIST: ${raw}`);
}
