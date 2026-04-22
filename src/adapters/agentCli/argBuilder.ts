/**
 * Canonical CLI argv fragments for the `agent` binary — flag names live only here.
 */

export interface RunAgentInput {
  prompt: string;
  model?: string;
  mode?: 'agent' | 'plan' | 'ask';
  workspace?: string;
  worktree?: string;
  sandbox?: boolean;
  output_format?: 'text' | 'json' | 'stream-json';
  approve_mcps?: boolean;
}

export function buildRunAgentArgs(input: RunAgentInput): string[] {
  const args: string[] = ['-p', input.prompt];
  // Always pass --trust: workspace trust is already enforced by WORKSPACE_ALLOWLIST
  // on the MCP server side; the CLI prompt would otherwise block non-interactive use.
  args.push('--trust');
  if (input.model !== undefined) {
    args.push('--model', input.model);
  }
  if (input.mode === 'plan') {
    args.push('--mode=plan');
  } else if (input.mode === 'ask') {
    args.push('--mode=ask');
  }
  if (input.workspace !== undefined) {
    args.push('--workspace', input.workspace);
  }
  if (input.worktree !== undefined) {
    args.push('--worktree', input.worktree);
  }
  if (input.sandbox === true) {
    args.push('--sandbox', 'enabled');
  } else if (input.sandbox === false) {
    args.push('--sandbox', 'disabled');
  }
  const fmt = input.output_format ?? 'text';
  args.push('--output-format', fmt);
  if (input.approve_mcps === true) {
    args.push('--approve-mcps');
  }
  return args;
}

export function buildListModelsArgs(): string[] {
  return ['models'];
}

export function buildAgentStatusArgs(): string[] {
  return ['status'];
}

export function buildSessionCreateArgs(): string[] {
  return ['create-chat'];
}

export interface SessionResumeCliInput {
  prompt: string;
  sessionId: string;
  model?: string;
  output_format?: 'text' | 'json';
}

export function buildSessionResumeArgs(input: SessionResumeCliInput): string[] {
  const args: string[] = ['-p', input.prompt, '--resume', input.sessionId];
  if (input.model !== undefined) {
    args.push('--model', input.model);
  }
  const fmt = input.output_format ?? 'text';
  args.push('--output-format', fmt);
  return args;
}
