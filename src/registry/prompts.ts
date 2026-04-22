import type { z } from 'zod';

export interface PromptDescriptor {
  name: string;
  description?: string;
  argsSchema?: z.ZodRawShape;
}

export const ALL_PROMPTS: PromptDescriptor[] = [];
