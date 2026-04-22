import { spawn, type ChildProcess } from 'node:child_process';
import type { Config } from '../../config.js';
import type { IAgentExecutor } from '../../ports/agentExecutor.js';
import type { ExecutorOptions, ExecutorResult } from '../../ports/executorTypes.js';
import { RingBuffer } from './ringBuffer.js';

const STDERR_CAP = 2048;

function stderrExcerpt(buf: RingBuffer): string {
  const s = buf.toString();
  if (s.length <= STDERR_CAP) {
    return s;
  }
  return s.slice(-STDERR_CAP);
}

const tracked = new Set<ChildProcess>();

export class AgentCliExecutor implements IAgentExecutor {
  constructor(config: Pick<Config, 'agentBinaryPath' | 'agentTimeoutMs' | 'maxOutputBytes'>) {
    void config;
  }

  async run(options: ExecutorOptions): Promise<ExecutorResult> {
    const started = Date.now();
    const stdoutBuf = new RingBuffer(options.maxOutputBytes);
    const stderrBuf = new RingBuffer(STDERR_CAP);

    return await new Promise((resolve) => {
      const child = spawn(options.binary, options.args, {
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      tracked.add(child);

      child.stdout?.on('data', (c: Buffer) => stdoutBuf.append(c));
      child.stderr?.on('data', (c: Buffer) => stderrBuf.append(c));

      let timedOut = false;
      let graceHandle: NodeJS.Timeout | undefined;
      const timeoutHandle = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        graceHandle = setTimeout(() => {
          child.kill('SIGKILL');
        }, 5000);
      }, options.timeoutMs);

      let settled = false;

      const finish = (exitCode: number) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutHandle);
        if (graceHandle) {
          clearTimeout(graceHandle);
        }
        tracked.delete(child);
        resolve({
          stdout: stdoutBuf.toString(),
          stderrExcerpt: stderrExcerpt(stderrBuf),
          exitCode,
          timedOut,
          outputTruncated: stdoutBuf.truncated,
          durationMs: Date.now() - started,
        });
      };

      child.on('error', (err: NodeJS.ErrnoException) => {
        const code = err.code === 'ENOENT' ? 127 : 1;
        finish(code);
      });

      child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
        if (timedOut) {
          finish(124);
          return;
        }
        const ec = code ?? (signal ? 1 : 0);
        finish(ec);
      });
    });
  }

  /** SIGTERM children, wait up to 10s, then SIGKILL remaining. */
  async shutdown(): Promise<void> {
    const copy = [...tracked];
    for (const c of copy) {
      if (!c.killed) {
        c.kill('SIGTERM');
      }
    }
    const deadline = Date.now() + 10_000;
    while (tracked.size > 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
    }
    for (const c of [...tracked]) {
      if (!c.killed) {
        c.kill('SIGKILL');
      }
    }
  }
}
