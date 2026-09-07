/**
 * Executor contracts (authoritative field list: docs/ARCHITECTURE.md § 4.7).
 *
 * `AgentCommand` is the semantic subprocess operation — CLI argv is built only in adapters.
 */

export type AgentRunMode = 'agent' | 'plan' | 'ask';

export type AgentOutputFormat = 'text' | 'json' | 'stream-json';

export type SessionResumeOutputFormat = 'text' | 'json';

export type AgentCommand =
  | {
      /** Subprocess test harness only (`node -e`); not used by MCP tool handlers. */
      kind: 'host_node_eval';
      script: string;
    }
  | {
      kind: 'run_agent';
      prompt: string;
      model?: string;
      mode: AgentRunMode;
      workspace?: string;
      worktree?: string;
      sandbox?: boolean;
      outputFormat: AgentOutputFormat;
      approveMcps: boolean;
    }
  | { kind: 'list_models' }
  | { kind: 'agent_status' }
  | { kind: 'agent_status_text' }
  | { kind: 'agent_about' }
  | { kind: 'session_create'; workspace?: string }
  | {
      kind: 'session_resume';
      prompt: string;
      sessionId: string;
      model?: string;
      outputFormat: SessionResumeOutputFormat;
    };

export interface ExecutorOptions {
  binary: string;
  command: AgentCommand;
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
