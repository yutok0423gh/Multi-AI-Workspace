export const MAX_PROMPT_TEXT_FILE_BYTES = 10 * 1024 * 1024;

const SUPPORTED_PROMPT_TEXT_FILE = /\.(?:md|markdown|txt)$/i;

export type PromptTextFileValidationError = 'unsupported' | 'too-large';

export function validatePromptTextFile(
  file: Pick<File, 'name' | 'size'>,
): PromptTextFileValidationError | null {
  if (!SUPPORTED_PROMPT_TEXT_FILE.test(file.name)) {
    return 'unsupported';
  }
  if (file.size > MAX_PROMPT_TEXT_FILE_BYTES) {
    return 'too-large';
  }
  return null;
}

export function insertPromptText(
  current: string,
  inserted: string,
  selectionStart: number,
  selectionEnd: number,
): { content: string; caret: number } {
  const start = Math.max(0, Math.min(selectionStart, current.length));
  const end = Math.max(start, Math.min(selectionEnd, current.length));
  const content = `${current.slice(0, start)}${inserted}${current.slice(end)}`;
  return {
    content,
    caret: start + inserted.length,
  };
}
