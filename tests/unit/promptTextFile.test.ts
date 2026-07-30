import { describe, expect, it } from 'vitest';

import {
  insertPromptText,
  MAX_PROMPT_TEXT_FILE_BYTES,
  validatePromptTextFile,
} from '../../src/options/promptTextFile';

describe('Prompt Manager local text files', () => {
  it('accepts Markdown and text files within the size limit', () => {
    expect(validatePromptTextFile({ name: 'guide.md', size: 2048 })).toBeNull();
    expect(validatePromptTextFile({ name: 'guide.MARKDOWN', size: 2048 })).toBeNull();
    expect(validatePromptTextFile({ name: 'notes.txt', size: 2048 })).toBeNull();
  });

  it('rejects unsupported or oversized files before reading them', () => {
    expect(validatePromptTextFile({ name: 'archive.json', size: 2048 })).toBe('unsupported');
    expect(
      validatePromptTextFile({
        name: 'large.md',
        size: MAX_PROMPT_TEXT_FILE_BYTES + 1,
      }),
    ).toBe('too-large');
  });

  it('inserts file text at the caret and replaces an active selection', () => {
    expect(insertPromptText('BeforeAfter', '\n# Notes\n', 6, 6)).toEqual({
      content: 'Before\n# Notes\nAfter',
      caret: 15,
    });
    expect(insertPromptText('Before old After', 'new', 7, 10)).toEqual({
      content: 'Before new After',
      caret: 10,
    });
  });
});
