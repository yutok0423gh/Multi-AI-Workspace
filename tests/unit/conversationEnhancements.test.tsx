import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import browser from 'webextension-polyfill';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ConversationPageOverlay,
  useConversationPageEnhancements,
} from '../../src/content/ConversationPageEnhancements';
import type { ConversationPointPinTarget } from '../../src/content/conversationPins';
import type { SelectedTextSnapshot } from '../../src/content/useSelectedText';
import { UserBoundPlatformAdapter } from '../../src/platforms/base/UserBoundPlatformAdapter';
import { I18nProvider } from '../../src/shared/i18n/I18nContext';
import type { PlatformMessage } from '../../src/shared/types/platform';

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('conversation page enhancements', () => {
  it('keeps an unbound selection highlighted for the page session and toggles it off', async () => {
    const adapter = new UserBoundPlatformAdapter('custom', 'localhost');
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Highlight without message binding';
    document.body.append(paragraph);
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const selection: SelectedTextSnapshot = {
      text: range.toString(),
      range,
      anchorX: 100,
      anchorY: 100,
      placement: 'above',
    };
    const { result } = renderHook(() => useConversationPageEnhancements(adapter, false, 0));
    await act(async () => Promise.resolve());

    await act(async () => {
      await expect(result.current.applyHighlight(selection, 'yellow')).resolves.toBe('added');
    });
    await waitFor(() => expect(result.current.resolvedHighlights).toHaveLength(1));
    expect(result.current.isSelectionHighlighted(selection)).toBe(true);

    await act(async () => {
      await expect(result.current.applyHighlight(selection, 'yellow')).resolves.toBe('unchanged');
      await expect(result.current.applyHighlight(selection, 'blue')).resolves.toBe('added');
    });
    await waitFor(() =>
      expect(result.current.resolvedHighlights.map((highlight) => highlight.color)).toEqual([
        'blue',
      ]),
    );

    await act(async () => {
      await expect(result.current.removeHighlight(selection)).resolves.toBe('removed');
    });
    await waitFor(() => expect(result.current.resolvedHighlights).toHaveLength(0));
    adapter.dispose();
  });

  it('persists and removes every message layer in a cross-message highlight', async () => {
    const requests: Array<{ type?: string; store?: string; id?: string; record?: unknown }> = [];
    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(async (message) => {
      const request = message as (typeof requests)[number];
      requests.push(request);
      if (request.type === 'database.list') return { ok: true, value: [] };
      return { ok: true, value: request.record };
    });
    const adapter = new UserBoundPlatformAdapter('custom', 'localhost');
    const first = document.createElement('article');
    first.innerHTML = '<p>First <strong>layer</strong></p>';
    const second = document.createElement('article');
    second.innerHTML = '<p>Second <em>layer</em> ends</p>';
    document.body.append(first, second);
    const messages: PlatformMessage[] = [first, second].map((element, order) => ({
      platform: 'custom',
      conversationId: 'conversation',
      messageId: `message-${order}`,
      runtimeMessageId: `assistant:${order}`,
      role: 'assistant',
      plainText: element.textContent ?? '',
      html: element.innerHTML,
      timestamp: null,
      timestampSource: 'unknown',
      element,
      order,
    }));
    vi.spyOn(adapter, 'getMessages').mockResolvedValue(messages);
    vi.spyOn(adapter, 'observeMessages').mockReturnValue(() => undefined);
    vi.spyOn(adapter, 'getCurrentAccountScope').mockResolvedValue('anonymous');
    vi.spyOn(adapter, 'getCurrentConversation').mockResolvedValue({
      platform: 'custom',
      accountScopeId: 'anonymous',
      conversationId: 'conversation',
      url: 'http://localhost/conversation',
      title: 'Highlight test',
      createdAt: null,
      updatedAt: null,
    });
    const start = first.querySelector('strong')?.firstChild;
    const end = second.querySelector('em')?.firstChild;
    if (!start || !end) throw new Error('Fixture text is missing.');
    const range = document.createRange();
    range.setStart(start, 1);
    range.setEnd(end, 3);
    const selection: SelectedTextSnapshot = {
      text: range.toString(),
      range,
      anchorX: 100,
      anchorY: 100,
      placement: 'above',
    };
    const { result } = renderHook(() => useConversationPageEnhancements(adapter, true, 0));
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    await act(async () => {
      await expect(result.current.applyHighlight(selection, 'green')).resolves.toBe('added');
    });
    await waitFor(() => expect(result.current.resolvedHighlights).toHaveLength(2));
    expect(result.current.isSelectionHighlighted(selection)).toBe(true);
    expect(
      requests.filter(
        (request) => request.type === 'database.put' && request.store === 'textHighlights',
      ),
    ).toHaveLength(2);

    await act(async () => {
      await expect(result.current.applyHighlight(selection, 'green')).resolves.toBe('unchanged');
    });
    expect(
      requests.filter(
        (request) => request.type === 'database.put' && request.store === 'textHighlights',
      ),
    ).toHaveLength(2);

    await act(async () => {
      await expect(result.current.applyHighlight(selection, 'blue')).resolves.toBe('added');
    });
    await waitFor(() =>
      expect(result.current.resolvedHighlights.map((highlight) => highlight.color)).toEqual([
        'blue',
        'blue',
      ]),
    );

    await act(async () => {
      await expect(result.current.removeHighlight(selection)).resolves.toBe('removed');
    });
    await waitFor(() => expect(result.current.resolvedHighlights).toHaveLength(0));
    expect(
      requests.filter(
        (request) => request.type === 'database.delete' && request.store === 'textHighlights',
      ),
    ).toHaveLength(2);
    adapter.dispose();
  });

  it('stores a content-free pin anchor for one selected message range and removes it', async () => {
    const requests: Array<{ type?: string; store?: string; id?: string; record?: unknown }> = [];
    const storedPins: Array<Record<string, unknown>> = [];
    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(async (message) => {
      const request = message as (typeof requests)[number];
      requests.push(request);
      if (request.type === 'database.list') {
        return {
          ok: true,
          value: request.store === 'conversationPins' ? structuredClone(storedPins) : [],
        };
      }
      if (request.type === 'database.put' && request.store === 'conversationPins') {
        const record = structuredClone(request.record as Record<string, unknown>);
        const index = storedPins.findIndex((candidate) => candidate.id === record.id);
        if (index >= 0) storedPins[index] = record;
        else storedPins.push(record);
      }
      if (request.type === 'database.delete' && request.store === 'conversationPins') {
        const index = storedPins.findIndex((candidate) => candidate.id === request.id);
        if (index >= 0) storedPins.splice(index, 1);
      }
      return { ok: true, value: request.record };
    });
    const adapter = new UserBoundPlatformAdapter('custom', 'localhost');
    const article = document.createElement('article');
    article.innerHTML = '<p>A <strong>precise pinned claim</strong> inside one response.</p>';
    document.body.append(article);
    const message: PlatformMessage = {
      platform: 'custom',
      conversationId: 'conversation',
      messageId: 'assistant-1',
      runtimeMessageId: 'assistant:0',
      role: 'assistant',
      plainText: article.textContent ?? '',
      html: article.innerHTML,
      timestamp: null,
      timestampSource: 'unknown',
      element: article,
      order: 0,
    };
    let currentMessages = [message];
    let currentConversationId = 'conversation';
    vi.spyOn(adapter, 'getMessages').mockImplementation(async () => currentMessages);
    vi.spyOn(adapter, 'observeMessages').mockReturnValue(() => undefined);
    vi.spyOn(adapter, 'getCurrentAccountScope').mockResolvedValue('anonymous');
    vi.spyOn(adapter, 'getCurrentConversation').mockImplementation(async () => ({
      platform: 'custom',
      accountScopeId: 'anonymous',
      conversationId: currentConversationId,
      url: `http://localhost/${currentConversationId}`,
      title: 'Pin test',
      createdAt: null,
      updatedAt: null,
    }));
    const selectedNode = article.querySelector('strong')?.firstChild;
    if (!selectedNode) throw new Error('Fixture text is missing.');
    const range = document.createRange();
    range.selectNodeContents(selectedNode);
    const selection: SelectedTextSnapshot = {
      text: range.toString(),
      range,
      anchorX: 100,
      anchorY: 100,
      placement: 'above',
    };
    const { result, rerender } = renderHook(
      ({ routeRevision }) => useConversationPageEnhancements(adapter, true, routeRevision),
      { initialProps: { routeRevision: 0 } },
    );
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    expect(result.current.isSelectionPinnable(selection)).toBe(true);
    expect(result.current.isSelectionPinned(selection)).toBe(false);
    await act(async () => {
      await expect(result.current.pinSelection(selection)).resolves.toBe('added');
    });
    await waitFor(() => expect(result.current.resolvedPins).toHaveLength(1));
    expect(result.current.isSelectionPinned(selection)).toBe(true);

    const putRequests = requests.filter(
      (request) => request.type === 'database.put' && request.store === 'conversationPins',
    );
    expect(putRequests).toHaveLength(1);
    expect(putRequests[0].record).toMatchObject({
      platformId: 'custom',
      accountScopeId: 'anonymous',
      conversationId: 'conversation',
      messageId: 'assistant-1',
      startOffset: 2,
      endOffset: 22,
    });
    expect(putRequests[0].record).not.toHaveProperty('text');
    expect(putRequests[0].record).not.toHaveProperty('plainText');
    expect(putRequests[0].record).not.toHaveProperty('preview');

    await act(async () => {
      await expect(result.current.pinSelection(selection)).resolves.toBe('unchanged');
    });
    expect(
      requests.filter(
        (request) => request.type === 'database.put' && request.store === 'conversationPins',
      ),
    ).toHaveLength(1);

    currentConversationId = 'conversation-b';
    currentMessages = [];
    rerender({ routeRevision: 1 });
    await waitFor(() => expect(result.current.messages).toHaveLength(0));
    await waitFor(() => expect(result.current.resolvedPins).toHaveLength(0));

    currentConversationId = 'conversation';
    currentMessages = [message];
    rerender({ routeRevision: 2 });
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    await waitFor(() => expect(result.current.resolvedPins).toHaveLength(1));
    expect(result.current.isSelectionPinned(selection)).toBe(true);

    await act(async () => {
      await expect(result.current.unpinSelection(selection)).resolves.toBe('removed');
    });
    await waitFor(() => expect(result.current.resolvedPins).toHaveLength(0));
    expect(result.current.isSelectionPinned(selection)).toBe(false);
    expect(
      requests.filter(
        (request) => request.type === 'database.delete' && request.store === 'conversationPins',
      ),
    ).toHaveLength(1);
    adapter.dispose();
  });

  it('pins an arbitrary DeepSeek page position when message selectors are unavailable', async () => {
    const storedPins: Array<Record<string, unknown>> = [];
    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(async (message) => {
      const request = message as {
        type?: string;
        store?: string;
        id?: string;
        record?: Record<string, unknown>;
      };
      if (request.type === 'database.list') {
        return {
          ok: true,
          value: request.store === 'conversationPins' ? structuredClone(storedPins) : [],
        };
      }
      if (request.type === 'database.put' && request.store === 'conversationPins') {
        const record = structuredClone(request.record ?? {});
        const index = storedPins.findIndex((candidate) => candidate.id === record.id);
        if (index >= 0) storedPins[index] = record;
        else storedPins.push(record);
      }
      return { ok: true, value: request.record };
    });
    const adapter = new UserBoundPlatformAdapter('deepseek', 'chat.deepseek.com');
    const response = document.createElement('div');
    response.className = 'neutral-turn-shell';
    response.innerHTML = '<div id="deepseek-range" aria-label="Empty answer chart"></div>';
    document.body.append(response);
    vi.spyOn(adapter, 'getMessages').mockResolvedValue([]);
    vi.spyOn(adapter, 'observeMessages').mockReturnValue(() => undefined);
    vi.spyOn(adapter, 'getCurrentAccountScope').mockResolvedValue('anonymous');
    let conversationId = '/a/chat/first';
    vi.spyOn(adapter, 'getCurrentConversation').mockImplementation(async () => ({
      platform: 'deepseek',
      accountScopeId: 'anonymous',
      conversationId,
      url: `https://chat.deepseek.com${conversationId}`,
      title: 'DeepSeek pin fallback',
      createdAt: null,
      updatedAt: null,
    }));
    const target = response.querySelector('#deepseek-range');
    if (!(target instanceof HTMLElement)) throw new Error('Fixture target is missing.');
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      left: 10,
      top: 100,
      width: 200,
      height: 200,
      right: 210,
      bottom: 300,
      x: 10,
      y: 100,
      toJSON: () => ({}),
    });
    const { result, rerender } = renderHook(
      ({ routeRevision }) => useConversationPageEnhancements(adapter, true, routeRevision),
      { initialProps: { routeRevision: 0 } },
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      await expect(
        result.current.pinTarget({ element: target, clientX: 60, clientY: 150 }),
      ).resolves.toEqual(expect.objectContaining({ result: 'added' }));
    });
    await waitFor(() => expect(result.current.resolvedPins).toHaveLength(1));
    expect(storedPins).toHaveLength(1);
    expect(storedPins[0]).toMatchObject({
      platformId: 'deepseek',
      conversationId: '/a/chat/first',
      messageId: null,
      anchorKind: 'point',
      anchorXRatio: 0.25,
      anchorYRatio: 0.25,
    });
    expect(storedPins[0].anchorPath).toMatch(/^[0-9a-z.]+$/);
    expect(storedPins[0]).not.toHaveProperty('text');
    expect(storedPins[0]).not.toHaveProperty('plainText');
    expect(storedPins[0]).not.toHaveProperty('preview');

    conversationId = '/a/chat/second';
    rerender({ routeRevision: 1 });
    await waitFor(() => expect(result.current.resolvedPins).toHaveLength(0));
    conversationId = '/a/chat/first';
    rerender({ routeRevision: 2 });
    await waitFor(() => expect(result.current.resolvedPins).toHaveLength(1));
    expect(result.current.resolvedPins[0].anchorYRatio).toBe(0.25);
    adapter.dispose();
  });

  it('shows one right-side jump entry per user prompt and scrolls to the selected prompt', async () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    const adapter = new UserBoundPlatformAdapter('custom', 'localhost');
    const first = document.createElement('article');
    const answer = document.createElement('article');
    const second = document.createElement('article');
    first.textContent = '你说 First prompt about a research plan';
    answer.textContent = 'Assistant response';
    second.textContent = 'Second prompt asking for risks';
    document.body.append(first, answer, second);
    for (const [index, element] of [first, answer, second].entries()) {
      Object.defineProperty(element, 'getBoundingClientRect', {
        value: () => ({
          top: index * 500,
          bottom: index * 500 + 100,
          left: 100,
          right: 700,
          width: 600,
          height: 100,
          x: 100,
          y: index * 500,
          toJSON: () => ({}),
        }),
      });
    }
    const rawMessages = [
      { role: 'user', plainText: first.textContent, element: first },
      { role: 'assistant', plainText: answer.textContent, element: answer },
      { role: 'user', plainText: second.textContent, element: second },
    ] satisfies Array<Pick<PlatformMessage, 'role' | 'plainText' | 'element'>>;
    const messages: PlatformMessage[] = rawMessages.map((message, order) => ({
      platform: 'custom',
      conversationId: 'conversation',
      messageId: null,
      runtimeMessageId: `${message.role}:${order}`,
      html: null,
      timestamp: null,
      timestampSource: 'unknown',
      order,
      ...message,
    }));
    const scroll = vi.spyOn(adapter, 'scrollToMessage').mockResolvedValue();

    const view = render(
      <I18nProvider locale="en">
        <ConversationPageOverlay adapter={adapter} messages={messages} highlights={[]} />
      </I18nProvider>,
    );

    const navigator = await screen.findByRole('navigation', {
      name: 'Conversation message navigator',
    });
    const navigatorQueries = within(navigator);
    expect(navigatorQueries.getByText('First prompt about a research plan')).toBeVisible();
    expect(navigatorQueries.queryByText(/你说/)).not.toBeInTheDocument();
    expect(navigatorQueries.getByText('Second prompt asking for risks')).toBeVisible();
    expect(navigatorQueries.queryByText('Assistant response')).not.toBeInTheDocument();
    fireEvent.click(navigatorQueries.getByText('Second prompt asking for risks'));
    expect(scroll).toHaveBeenCalledWith(messages[2], 'smooth');

    const middle = document.createElement('article');
    middle.textContent = 'A prompt that appeared after virtualized scrolling';
    document.body.insertBefore(middle, second);
    Object.defineProperty(middle, 'getBoundingClientRect', {
      value: () => ({
        top: 750,
        bottom: 850,
        left: 100,
        right: 700,
        width: 600,
        height: 100,
        x: 100,
        y: 750,
        toJSON: () => ({}),
      }),
    });
    const expandedMessages: PlatformMessage[] = [
      messages[0],
      {
        ...messages[0],
        runtimeMessageId: 'user:middle',
        plainText: middle.textContent,
        element: middle,
        order: 1,
      },
      { ...messages[2], order: 2 },
    ];
    view.rerender(
      <I18nProvider locale="en">
        <ConversationPageOverlay
          adapter={adapter}
          messages={expandedMessages}
          highlights={[]}
        />
      </I18nProvider>,
    );
    await waitFor(() =>
      expect(
        within(
          screen.getByRole('navigation', {
            name: 'Conversation message navigator',
          }),
        ).getByText('A prompt that appeared after virtualized scrolling'),
      ).toBeVisible(),
    );
    expect(
      within(
        screen.getByRole('navigation', {
          name: 'Conversation message navigator',
        }),
      ).getByText('First prompt about a research plan'),
    ).toBeVisible();

    view.rerender(
      <I18nProvider locale="en">
        <ConversationPageOverlay
          adapter={adapter}
          messages={expandedMessages}
          highlights={[]}
          showPromptNavigator={false}
        />
      </I18nProvider>,
    );
    expect(
      screen.queryByRole('navigation', { name: 'Conversation message navigator' }),
    ).not.toBeInTheDocument();
    adapter.dispose();
  });

  it('uses an interrupt-safe instant timeline jump on Kimi', async () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    const adapter = new UserBoundPlatformAdapter('kimi', 'www.kimi.com');
    const element = document.createElement('article');
    element.textContent = 'Kimi prompt';
    document.body.append(element);
    const message: PlatformMessage = {
      platform: 'kimi',
      conversationId: 'conversation',
      messageId: null,
      runtimeMessageId: 'user:0',
      role: 'user',
      plainText: element.textContent,
      html: null,
      timestamp: null,
      timestampSource: 'unknown',
      element,
      order: 0,
    };
    const scroll = vi.spyOn(adapter, 'scrollToMessage').mockResolvedValue();

    render(
      <I18nProvider locale="en">
        <ConversationPageOverlay adapter={adapter} messages={[message]} highlights={[]} />
      </I18nProvider>,
    );

    const navigator = await screen.findByRole('navigation', {
      name: 'Conversation message navigator',
    });
    fireEvent.click(within(navigator).getByText('Kimi prompt'));

    expect(scroll).toHaveBeenCalledWith(message, 'instant');
    adapter.dispose();
  });

  it('pins a clicked page location, offers undo, and keeps pin navigation jumpable', async () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    const adapter = new UserBoundPlatformAdapter('custom', 'localhost');
    const target = document.createElement('p');
    target.textContent = 'A location selected after entering pin mode';
    Object.defineProperty(target, 'getBoundingClientRect', {
      value: () => ({
        top: 200,
        bottom: 260,
        left: 120,
        right: 720,
        width: 600,
        height: 60,
        x: 120,
        y: 200,
        toJSON: () => ({}),
      }),
    });
    const scrollIntoView = vi.fn();
    target.scrollIntoView = scrollIntoView;
    document.body.append(target);
    const range = document.createRange();
    range.selectNodeContents(target);
    const message: PlatformMessage = {
      platform: 'custom',
      conversationId: 'conversation',
      messageId: null,
      runtimeMessageId: 'unknown:0',
      role: 'unknown',
      plainText: target.textContent,
      html: null,
      timestamp: null,
      timestampSource: 'unknown',
      element: target,
      order: 0,
    };
    const onPinTarget = vi.fn(async (pointTarget: ConversationPointPinTarget) => {
      expect(pointTarget.element).toBe(target);
      expect(pointTarget.clientX).toBe(40);
      expect(pointTarget.clientY).toBe(60);
      return { result: 'added' as const, pinId: 'pin-1' };
    });
    const onRemovePin = vi.fn(async () => undefined);
    const onPinModeChange = vi.fn();

    const view = render(
      <I18nProvider locale="en">
        <ConversationPageOverlay
          adapter={adapter}
          messages={[]}
          highlights={[]}
          pinEnabled
          pinMode
          onPinModeChange={onPinModeChange}
          onPinTarget={onPinTarget}
          onRemovePin={onRemovePin}
        />
      </I18nProvider>,
    );

    expect(
      screen.getByText(
        'Click anywhere on the page to pin that exact position. Press Esc to cancel.',
      ),
    ).toBeVisible();
    fireEvent.pointerMove(target, { clientX: 40, clientY: 60 });
    expect(document.querySelector('.maw-pin-target-preview')).not.toBeNull();
    fireEvent.click(target, { clientX: 40, clientY: 60 });
    expect(await screen.findByText('Location pinned.')).toBeVisible();
    expect(onPinTarget).toHaveBeenCalledTimes(1);
    expect(onPinModeChange).toHaveBeenCalledWith(false);

    view.rerender(
      <I18nProvider locale="en">
        <ConversationPageOverlay
          adapter={adapter}
          messages={[]}
          highlights={[]}
          pinEnabled
          onPinModeChange={onPinModeChange}
          onPinTarget={onPinTarget}
          onRemovePin={onRemovePin}
        />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(onRemovePin).toHaveBeenCalledWith('pin-1'));
    expect(screen.queryByText('Location pinned.')).not.toBeInTheDocument();

    view.rerender(
      <I18nProvider locale="en">
        <ConversationPageOverlay
          adapter={adapter}
          messages={[]}
          highlights={[]}
          pins={[
            {
              id: 'pin-1',
              range,
              message,
              messageKey: 'selection-anchor:0',
              startOffset: 0,
              endOffset: target.textContent.length,
              preview: target.textContent,
              createdAt: 1,
            },
          ]}
          pinEnabled
          onPinTarget={onPinTarget}
          onRemovePin={onRemovePin}
        />
      </I18nProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Next pin' }));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    scrollIntoView.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Previous pin' }));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    adapter.dispose();
  });
});
