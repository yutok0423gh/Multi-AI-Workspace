import { describe, expect, it } from 'vitest';

import { promptRecordSchema } from '../../src/shared/schemas/records';

const basePrompt = {
  id: 'prompt-1',
  title: 'Summarize',
  content: 'Summarize this text.',
  description: '',
  tags: [],
  folderId: null,
  usageCount: 0,
  createdAt: 1,
  updatedAt: 1,
};

describe('promptRecordSchema', () => {
  it('accepts correctly isolated account prompts', () => {
    expect(
      promptRecordSchema.safeParse({
        ...basePrompt,
        scope: 'account',
        platformId: 'gemini',
        accountScopeId: 'account-hash',
      }).success,
    ).toBe(true);
  });

  it('rejects account prompts missing their account scope', () => {
    expect(
      promptRecordSchema.safeParse({
        ...basePrompt,
        scope: 'account',
        platformId: 'gemini',
        accountScopeId: null,
      }).success,
    ).toBe(false);
  });

  it('strips the retired favorite field from legacy prompt imports', () => {
    const parsed = promptRecordSchema.parse({
      ...basePrompt,
      favorite: true,
      scope: 'global',
      platformId: null,
      accountScopeId: null,
    });

    expect(parsed).not.toHaveProperty('favorite');
  });
});
