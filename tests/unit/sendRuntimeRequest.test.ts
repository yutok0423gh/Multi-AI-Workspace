import browser from 'webextension-polyfill';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  EXTENSION_CONTEXT_UNAVAILABLE,
  sendRuntimeRequest,
} from '../../src/shared/runtime/sendRuntimeRequest';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('sendRuntimeRequest', () => {
  it('converts an invalidated extension context into a stable application error', async () => {
    vi.spyOn(browser.runtime, 'sendMessage').mockRejectedValue(
      new Error("Cannot read properties of undefined (reading 'sendMessage')"),
    );

    const request = sendRuntimeRequest({ type: 'conversationBranch.pending', platformId: 'kimi' });

    await expect(request).rejects.toMatchObject({
      code: EXTENSION_CONTEXT_UNAVAILABLE,
    });
  });

  it('rejects a malformed background response instead of reading its fields', async () => {
    vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue(undefined);

    await expect(sendRuntimeRequest({ type: 'settings.get' })).rejects.toMatchObject({
      code: 'BACKGROUND_RESPONSE_INVALID',
    });
  });
});
