import type { z } from 'zod';
import type { IAgentExecutor } from '../ports/agentExecutor.js';

export interface ToolDescriptor<T = unknown> {
  name: string;
  description: string;
  schema: z.ZodType<T>;
  pathArgs: (input: T) => string[];
  handler: (input: T, executor: IAgentExecutor) => Promise<unknown>;
}

export const ALL_TOOLS: ToolDescriptor[] = [];
