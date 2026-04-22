import type { z } from 'zod';
import type { Config } from '../config.js';
import type { PipelineContext } from '../pipeline/toolPipeline.js';
import type { IAgentExecutor } from '../ports/agentExecutor.js';
import { createAgentStatusDescriptor } from '../tools/agentStatus.js';
import { createListModelsDescriptor } from '../tools/listModels.js';
import { createRunAgentDescriptor } from '../tools/runAgent.js';

export interface ToolDescriptor<T = unknown> {
  name: string;
  description: string;
  schema: z.ZodType<T>;
  pathArgs: (input: T) => string[];
  handler: (input: T, executor: IAgentExecutor, ctx: PipelineContext) => Promise<unknown>;
}

export function pipelineContextFromConfig(config: Config): PipelineContext {
  return {
    workspaceAllowlist: config.workspaceAllowlist,
    agentBinaryPath: config.agentBinaryPath,
    agentTimeoutMs: config.agentTimeoutMs,
    maxOutputBytes: config.maxOutputBytes,
  };
}

/** Tool registry — add new tools here only (docs/ARCHITECTURE.md §4.4). */
export function buildToolDescriptors(config: Config): Array<ToolDescriptor<unknown>> {
  const ctx = pipelineContextFromConfig(config);
  return [
    createRunAgentDescriptor(ctx) as ToolDescriptor<unknown>,
    createListModelsDescriptor(ctx) as ToolDescriptor<unknown>,
    createAgentStatusDescriptor(ctx) as ToolDescriptor<unknown>,
  ];
}
