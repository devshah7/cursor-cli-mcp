import { describe, expect, it } from 'vitest';
import { buildAskOnlyPrompt } from '../../../src/prompts/askOnly.js';
import { buildPlanOnlyPrompt } from '../../../src/prompts/planOnly.js';
import { buildWorktreeIsolationPrompt } from '../../../src/prompts/worktreeIsolation.js';

describe('MCP prompt templates (Phase 3)', () => {
  it('plan-only yields run_agent JSON with mode plan', () => {
    const result = buildPlanOnlyPrompt({
      prompt: 'Summarize README',
      workspace: '/repo',
    });
    expect(result.messages).toHaveLength(1);
    const text = result.messages[0]?.content.type === 'text' ? result.messages[0].content.text : '';
    expect(text).toContain('"mode": "plan"');
    expect(text).toContain('Summarize README');
    expect(text).toContain('/repo');
  });

  it('ask-only yields run_agent JSON with mode ask', () => {
    const result = buildAskOnlyPrompt({ prompt: 'Find TODOs' });
    const text = result.messages[0]?.content.type === 'text' ? result.messages[0].content.text : '';
    expect(text).toContain('"mode": "ask"');
    expect(text).toContain('Find TODOs');
  });

  it('worktree-isolation sets sandbox true and passes worktree', () => {
    const result = buildWorktreeIsolationPrompt({
      prompt: 'Fix bug',
      workspace: '/repo/main',
      worktree: '/repo/wt-fix',
    });
    const text = result.messages[0]?.content.type === 'text' ? result.messages[0].content.text : '';
    expect(text).toContain('"sandbox": true');
    expect(text).toContain('/repo/wt-fix');
    expect(text).toContain('/repo/main');
  });
});
