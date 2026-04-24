import fs from 'node:fs';
import os from 'node:os';

export class ConfigError extends Error {
  readonly name = 'ConfigError';
}

export interface Config {
  agentBinaryPath: string;
  agentTimeoutMs: number;
  maxOutputBytes: number;
  workspaceAllowlist: string[];
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  logPrompts: boolean;
}

function parsePositiveInt(raw: string | undefined, fallback: number, label: string): number {
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new ConfigError(`${label} must be a positive integer`);
  }
  return n;
}

function defaultAgentBinaryPath(): string {
  const homeLocal = `${os.homedir()}/.local/bin/cursor-agent`;
  if (os.platform() === 'darwin') {
    const fallback = '/opt/homebrew/bin/cursor-agent';
    try {
      fs.accessSync(homeLocal, fs.constants.X_OK);
      return homeLocal;
    } catch {
      return fallback;
    }
  }
  const fallback = '/usr/local/bin/cursor-agent';
  try {
    fs.accessSync(homeLocal, fs.constants.X_OK);
    return homeLocal;
  } catch {
    return fallback;
  }
}

function parseLogLevel(raw: string | undefined): Config['logLevel'] {
  const v = raw ?? 'info';
  if (v === 'debug' || v === 'info' || v === 'warn' || v === 'error') {
    return v;
  }
  return 'info';
}

function warnMissingBinary(path: string): void {
  try {
    fs.accessSync(path, fs.constants.X_OK);
  } catch {
    process.stderr.write(
      JSON.stringify({
        level: 'warn',
        msg: 'agent binary missing or not executable',
        ts: new Date().toISOString(),
        agentBinaryPath: path,
      }) + '\n',
    );
  }
}

/**
 * Load configuration from env. Validates AGENT_TIMEOUT_MS / MAX_OUTPUT_BYTES strictly.
 * WARN-only on missing/unexecutable AGENT_BINARY_PATH per ARCHITECTURE § 4.8.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const agentBinaryPathRaw = env.AGENT_BINARY_PATH?.trim();
  const agentBinaryPath =
    agentBinaryPathRaw === undefined || agentBinaryPathRaw === ''
      ? defaultAgentBinaryPath()
      : agentBinaryPathRaw;

  warnMissingBinary(agentBinaryPath);

  const agentTimeoutMs = parsePositiveInt(env.AGENT_TIMEOUT_MS, 120_000, 'AGENT_TIMEOUT_MS');
  const maxOutputBytes = parsePositiveInt(env.MAX_OUTPUT_BYTES, 524_288, 'MAX_OUTPUT_BYTES');

  const allowRaw = env.WORKSPACE_ALLOWLIST ?? '';
  const workspaceAllowlist =
    allowRaw === ''
      ? []
      : allowRaw
          .split(':')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

  const logPrompts = env.LOG_PROMPTS === 'true';

  return {
    agentBinaryPath,
    agentTimeoutMs,
    maxOutputBytes,
    workspaceAllowlist,
    logLevel: parseLogLevel(env.LOG_LEVEL),
    logPrompts,
  };
}
