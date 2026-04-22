import { describe, expect, it } from 'vitest';
import {
  buildAgentStatusArgs,
  buildListModelsArgs,
  buildRunAgentArgs,
} from '../../../src/adapters/agentCli/argBuilder.js';

describe('argBuilder', () => {
  it('buildRunAgentArgs maps API_SPEC flags', () => {
    const args = buildRunAgentArgs({
      prompt: 'hi',
      model: 'm1',
      mode: 'plan',
      workspace: '/w',
      worktree: '/t',
      sandbox: true,
      output_format: 'json',
      approve_mcps: true,
      max_turns: 3,
    });
    expect(args).toContain('-p');
    expect(args).toContain('hi');
    expect(args).toEqual(
      expect.arrayContaining([
        '--model',
        'm1',
        '--mode=plan',
        '--workspace',
        '/w',
        '--worktree',
        '/t',
        '--sandbox',
        '--output-format',
        'json',
        '--approve-mcps',
        '--max-turns',
        '3',
      ]),
    );
  });

  it('buildListModelsArgs uses models subcommand', () => {
    expect(buildListModelsArgs()).toEqual(['models']);
  });

  it('buildAgentStatusArgs uses status subcommand', () => {
    expect(buildAgentStatusArgs()).toEqual(['status']);
  });
});
