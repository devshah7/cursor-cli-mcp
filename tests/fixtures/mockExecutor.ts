import type { ExecutorOptions, ExecutorResult } from '../../src/ports/executorTypes.js';
import type { IAgentExecutor } from '../../src/ports/agentExecutor.js';

/** Test double implementing `IAgentExecutor` without unsafe casts (docs/TASK_LIST.md T1B.7). */
export class MockExecutor implements IAgentExecutor {
  readonly runImpl: (options: ExecutorOptions) => ExecutorResult | Promise<ExecutorResult>;

  constructor(runImpl: (options: ExecutorOptions) => ExecutorResult | Promise<ExecutorResult>) {
    this.runImpl = runImpl;
  }

  async run(options: ExecutorOptions): Promise<ExecutorResult> {
    return await this.runImpl(options);
  }
}

export function createMockExecutor(overrides?: Partial<ExecutorResult>): IAgentExecutor {
  return new MockExecutor(() => ({
    stdout: 'mock output',
    stderrExcerpt: '',
    exitCode: 0,
    timedOut: false,
    outputTruncated: false,
    durationMs: 100,
    ...overrides,
  }));
}
