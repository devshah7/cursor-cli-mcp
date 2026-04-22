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
  max_turns?: number;
}

export function buildRunAgentArgs(input: RunAgentInput): string[] {
  const args: string[] = ['-p', input.prompt];
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
    args.push('--sandbox');
  }
  const fmt = input.output_format ?? 'text';
  args.push('--output-format', fmt);
  if (input.approve_mcps === true) {
    args.push('--approve-mcps');
  }
  if (input.max_turns !== undefined) {
    args.push('--max-turns', String(input.max_turns));
  }
  return args;
}

export function buildListModelsArgs(): string[] {
  return ['models'];
}

export function buildAgentStatusArgs(): string[] {
  return ['status'];
}
