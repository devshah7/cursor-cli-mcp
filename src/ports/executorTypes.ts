/**
 * Executor contracts (authoritative field list: docs/ARCHITECTURE.md § 4.7).
 */
export interface ExecutorOptions {
  binary: string;
  args: string[];
  timeoutMs: number;
  maxOutputBytes: number;
}

export interface ExecutorResult {
  stdout: string;
  stderrExcerpt: string;
  exitCode: number;
  timedOut: boolean;
  outputTruncated: boolean;
  durationMs: number;
}
