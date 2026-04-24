import { describe, expect, it } from 'vitest';
import {
  buildAgentStatusArgs,
  buildListModelsArgs,
  buildRunAgentArgs,
  buildSessionCreateArgs,
  buildSessionResumeArgs,
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
    });
    expect(args).toContain('-p');
    expect(args).toContain('hi');
    expect(args).toEqual(
      expect.arrayContaining([
        '--trust',
        '--model',
        'm1',
        '--mode=plan',
        '--workspace',
        '/w',
        '--worktree',
        '/t',
        '--sandbox',
        'enabled',
        '--output-format',
        'json',
        '--approve-mcps',
      ]),
    );
  });

  it('buildRunAgentArgs always includes --trust', () => {
    const args = buildRunAgentArgs({ prompt: 'x' });
    expect(args).toContain('--trust');
  });

  it('buildRunAgentArgs pushes --sandbox disabled when sandbox is false', () => {
    const args = buildRunAgentArgs({
      prompt: 'x',
      sandbox: false,
    });
    expect(args).toEqual(
      expect.arrayContaining(['--sandbox', 'disabled', '--output-format', 'text']),
    );
  });

  it('buildRunAgentArgs omits sandbox flag when sandbox is undefined', () => {
    const args = buildRunAgentArgs({ prompt: 'x' });
    expect(args.filter((a) => a === '--sandbox')).toHaveLength(0);
  });

  it('buildListModelsArgs uses models subcommand', () => {
    expect(buildListModelsArgs()).toEqual(['models']);
  });

  it('buildAgentStatusArgs uses status subcommand', () => {
    expect(buildAgentStatusArgs()).toEqual(['status']);
  });

  it('buildSessionCreateArgs uses create-chat subcommand', () => {
    expect(buildSessionCreateArgs()).toEqual(['create-chat']);
  });

  it('buildSessionCreateArgs forwards optional workspace', () => {
    expect(buildSessionCreateArgs('/tmp/test')).toEqual([
      'create-chat',
      '--workspace',
      '/tmp/test',
    ]);
  });

  it('buildSessionResumeArgs maps prompt, resume id, model, output_format', () => {
    expect(
      buildSessionResumeArgs({
        prompt: 'continue',
        sessionId: 'abc-123',
        model: 'm',
        output_format: 'json',
      }),
    ).toEqual(['-p', 'continue', '--resume', 'abc-123', '--model', 'm', '--output-format', 'json']);
  });
});
