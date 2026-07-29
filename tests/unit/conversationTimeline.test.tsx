import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import browser from 'webextension-polyfill';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConversationTimeline } from '../../src/content/ConversationTimeline';
import { UserBoundPlatformAdapter } from '../../src/platforms/base/UserBoundPlatformAdapter';
import { I18nProvider } from '../../src/shared/i18n/I18nContext';
import type { PlatformMessage } from '../../src/shared/types/platform';

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

function createMessages(): PlatformMessage[] {
  return ['Plan a migration', 'Start with an inventory'].map((plainText, order) => {
    const element = document.createElement('article');
    element.textContent = plainText;
    document.body.append(element);
    Object.defineProperty(element, 'getBoundingClientRect', {
      value: () => ({
        top: order * 500,
        bottom: order * 500 + 100,
        left: 100,
        right: 700,
        width: 600,
        height: 100,
        x: 100,
        y: order * 500,
        toJSON: () => ({}),
      }),
    });
    const role = order === 0 ? 'user' : 'assistant';
    return {
      platform: 'custom',
      conversationId: 'conversation',
      messageId: null,
      runtimeMessageId: `${role}:${order}`,
      role,
      plainText,
      html: null,
      timestamp: null,
      timestampSource: 'unknown',
      element,
      order,
    } satisfies PlatformMessage;
  });
}

describe('conversation timeline', () => {
  it('persists notes, selects nodes, and exposes selection exports without message favorites', async () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    let downloadedFilename = '';
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:timeline-test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloadedFilename = this.download;
    });
    const requests: Array<{ type?: string; store?: string; record?: unknown }> = [];
    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(async (message) => {
      const request = message as { type?: string; store?: string; record?: unknown };
      requests.push(request);
      if (request.type === 'database.list') return { ok: true, value: [] };
      return { ok: true, value: request.record };
    });
    const adapter = new UserBoundPlatformAdapter('custom', 'localhost');
    const messages = createMessages();
    vi.spyOn(adapter, 'getCurrentConversation').mockResolvedValue({
      platform: 'custom',
      accountScopeId: 'anonymous',
      conversationId: 'conversation',
      url: 'http://localhost/conversation',
      title: 'Timeline test',
      createdAt: null,
      updatedAt: null,
    });
    vi.spyOn(adapter, 'getCurrentAccountScope').mockResolvedValue('anonymous');

    render(
      <I18nProvider locale="en">
        <ConversationTimeline
          adapter={adapter}
          messages={messages}
          exportFormat="markdown-standard"
        />
      </I18nProvider>,
    );

    await screen.findByLabelText('Search message text or node notes');
    fireEvent.click(screen.getAllByLabelText('Edit node note')[0]);
    fireEvent.change(screen.getByLabelText('Local node note'), {
      target: { value: 'Review this claim' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(requests).toContainEqual(
        expect.objectContaining({
          type: 'database.put',
          store: 'timelineMetadata',
          record: expect.objectContaining({
            messageKey: 'user:0',
            note: 'Review this claim',
          }),
        }),
      ),
    );

    expect(screen.queryByLabelText('Favorite')).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Starred' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Select timeline node 1'));
    expect(screen.getByText('1 selected')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Export now' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Export now' }));
    await waitFor(() => expect(downloadedFilename).toBe('Timeline test-timeline-selection.md'));
    expect(requests.some((request) => request.store === 'exportHistory')).toBe(false);
    expect(requests.some((request) => request.store === 'favorites')).toBe(false);
    adapter.dispose();
  });
});
