import type { Config } from './config.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

function shouldLog(cfg: Pick<Config, 'logLevel'>, level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[cfg.logLevel];
}

/** Writes JSON lines to stderr only — never stdout (MCP transport uses stdout). */
export function createLogger(cfg: Pick<Config, 'logLevel' | 'logPrompts'>): Logger {
  const write = (level: LogLevel, msg: string, meta?: Record<string, unknown>) => {
    if (!shouldLog(cfg, level)) {
      return;
    }
    const line = JSON.stringify({
      level,
      msg,
      ts: new Date().toISOString(),
      ...(meta ?? {}),
    });
    process.stderr.write(`${line}\n`);
  };

  return {
    debug(msg, meta) {
      write('debug', msg, meta);
    },
    info(msg, meta) {
      write('info', msg, meta);
    },
    warn(msg, meta) {
      write('warn', msg, meta);
    },
    error(msg, meta) {
      write('error', msg, meta);
    },
  };
}

/** Omit prompt-sized blobs from logs unless LOG_PROMPTS + debug level. */
export function maybePromptLogPayload(
  cfg: Pick<Config, 'logPrompts'>,
  prompt: string,
): Record<string, unknown> | undefined {
  if (!cfg.logPrompts) {
    return undefined;
  }
  return { promptLength: prompt.length };
}
