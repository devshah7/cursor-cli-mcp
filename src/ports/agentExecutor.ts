import type { ExecutorOptions, ExecutorResult } from './executorTypes.js';

export type { AgentCommand, ExecutorOptions, ExecutorResult } from './executorTypes.js';

export interface IAgentExecutor {
  run(options: ExecutorOptions): Promise<ExecutorResult>;
}
