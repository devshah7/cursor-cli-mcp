/**
 * Executor contracts (authoritative field list: docs/ARCHITECTURE.md § 4.7).
 */
export interface ExecutorOptions {
  binary: string;
  args: string[];
  timeoutMs: number;
  maxOutputBytes: number;
  /** Called with each stdout chunk as it arrives (UTF-8 string). Ring buffer still accumulates in parallel. */
  onStdoutChunk?: (chunk: string) => void;
}

export interface ExecutorResult {
  stdout: string;
  stderrExcerpt: string;
  exitCode: number;
  timedOut: boolean;
  outputTruncated: boolean;
  durationMs: number;
}
