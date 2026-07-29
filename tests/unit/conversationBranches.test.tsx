import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import browser from 'webextension-polyfill';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConversationBranchHandoffService } from '../../src/background/conversationBranchHandoffs';
import {
  ConversationBranchControls,
  ConversationBranchHandoffBanner,
  ConversationBranchNavigator,
} from '../../src/content/ConversationBranchControls';
import { buildConversationBranchDraft } from '../../src/content/conversationBranches';
import { UserBoundPlatformAdapter } from '../../src/platforms/base/UserBoundPlatformAdapter';
import { SUPPORTED_PLATFORMS } from '../../src/shared/constants/platforms';
import { I18nProvider } from '../../src/shared/i18n/I18nContext';
import { WorkspaceDatabase } from '../../src/shared/storage/indexedDb';
import type {
  ConversationBranchGroup,
  ConversationBranchHandoff,
  ConversationBranchRecord,
  ConversationBranchTransfer,
} from '../../src/shared/types/conversationBranch';
import type { PlatformConversation, PlatformMessage } from '../../src/shared/types/platform';
import {
  isNewConversationUrl,
  resolveNewConversationUrl,
} from '../../src/shared/utils/conversationBranch';

const database = new WorkspaceDatabase();

function message(
  role: PlatformMessage['role'],
  order: number,
  plainText: string,
  platform: PlatformMessage['platform'] = 'custom',
): PlatformMessage {
  const element = document.createElement('article');
  element.className = role === 'user' ? 'user-message' : 'assistant-message';
  element.textContent = plainText;
  document.querySelector('#messages')?.append(element);
  Object.defineProperty(element, 'getBoundingClientRect', {
    value: () => ({
      top: 20 + order * 80,
      bottom: 80 + order * 80,
      left: 100,
      right: 700,
      width: 600,
      height: 60,
      x: 100,
      y: 20 + order * 80,
      toJSON: () => ({}),
    }),
  });
  return {
    platform,
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
  };
}

function conversation(platform: PlatformConversation['platform'] = 'custom'): PlatformConversation {
  return {
    platform,
    accountScopeId: 'anonymous',
    conversationId: 'conversation',
    url: 'http://localhost/conversation?token=secret&view=clean',
    title: 'Source chat',
    createdAt: null,
    updatedAt: null,
  };
}

function transfer(platformId: ConversationBranchTransfer['platformId'], sourceUrl: string) {
  return {
    platformId,
    accountScopeId: 'anonymous',
    sourceConversationId: 'conversation-one',
    sourceUrl,
    sourceTitle: 'Source chat',
    branchPoint: 'assistant 2: Answer',
    branchPointMessageKey: 'assistant:1:1:assistant',
    branchPointOrder: 1,
    branchPointRole: 'assistant' as const,
    context: '# Conversation Branch Context\n\nSafe context',
    messageCount: 2,
    truncated: false,
    model: null,
  } satisfies ConversationBranchTransfer;
}

function branchRecord(overrides: Partial<ConversationBranchRecord> = {}): ConversationBranchRecord {
  return {
    id: 'branch-1',
    groupId: 'group-1',
    platformId: 'custom',
    accountScopeId: 'anonymous',
    parentBranchId: 'original-1',
    conversationId: null,
    url: 'http://localhost/',
    title: null,
    name: 'Branch 1',
    method: 'manual',
    state: 'creating',
    branchPointMessageKey: 'assistant:1:1:assistant',
    branchPointOrder: 1,
    branchPointRole: 'assistant',
    model: null,
    createdAt: 2,
    updatedAt: 2,
    ...overrides,
  };
}

function group(currentBranchId = 'branch-1'): ConversationBranchGroup {
  return {
    groupId: 'group-1',
    currentBranchId,
    branches: [
      branchRecord({
        id: 'original-1',
        parentBranchId: null,
        url: 'http://localhost/source',
        name: 'Source chat',
        method: 'original',
        state: 'ready',
        branchPointMessageKey: null,
        branchPointOrder: null,
        branchPointRole: null,
        createdAt: 1,
        updatedAt: 1,
      }),
      branchRecord(),
    ],
  };
}

function setupDocument() {
  document.body.innerHTML = `
    <section id="messages"></section>
    <textarea id="composer"></textarea>
    <button id="send">Send</button>
  `;
}

function setupAdapter(): UserBoundPlatformAdapter {
  const adapter = new UserBoundPlatformAdapter('custom', location.hostname);
  adapter.setBinding({
    id: 'binding:custom:http://localhost',
    origin: location.origin,
    platformId: 'custom',
    accountScopeId: 'anonymous',
    composerSelector: '#composer',
    sendButtonSelector: '#send',
    messageContainerSelector: '#messages',
    userMessageSelector: '.user-message',
    assistantMessageSelector: '.assistant-message',
    enabled: true,
    lastValidatedAt: 1,
    createdAt: 1,
    updatedAt: 1,
  });
  return adapter;
}

beforeEach(async () => {
  await database.clear('conversationBranches');
});

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('conversation branches', () => {
  it('keeps ordered system, user, and assistant context while excluding tools and later messages', () => {
    setupDocument();
    const messages = [
      message('system', 0, 'System instructions'),
      message('user', 1, 'First question'),
      message('assistant', 2, 'First answer'),
      message('tool', 3, 'Private tool output'),
      message('user', 4, 'Later question'),
    ];

    const draft = buildConversationBranchDraft(messages, messages[2], conversation(), 'Test model');

    expect(draft.context).toContain('### System\nSystem instructions');
    expect(draft.context).toContain('### User\nFirst question');
    expect(draft.context).toContain('### Assistant\nFirst answer');
    expect(draft.context).toContain('Model: Test model');
    expect(draft.context).not.toContain('Private tool output');
    expect(draft.context).not.toContain('Later question');
    expect(draft.context).not.toContain('token=secret');
    expect(draft.messageCount).toBe(3);
    expect(draft.truncated).toBe(false);
  });

  it('rejects an oversized conversation instead of silently creating an incomplete branch', () => {
    setupDocument();
    const messages = [message('user', 0, 'A'.repeat(510_000))];
    expect(() => buildConversationBranchDraft(messages, messages[0], conversation(), null)).toThrow(
      'too large',
    );
  });

  it('persists a branch relation and resolves a new-chat destination for every platform', async () => {
    const createTab = vi.spyOn(browser.tabs, 'create');
    const service = new ConversationBranchHandoffService(database);

    for (const platform of SUPPORTED_PLATFORMS) {
      const sourceUrl = `https://${platform.hostname}/conversation/one`;
      const branchTransfer = transfer(platform.id, sourceUrl);
      const preparation = await service.prepare(branchTransfer, 'manual');
      const handoff = await service.open(preparation.branch.id, branchTransfer);
      const expectedUrl = resolveNewConversationUrl(platform.id, sourceUrl);
      expect(createTab).toHaveBeenLastCalledWith({ url: expectedUrl });
      expect(handoff.branchId).toBe(preparation.branch.id);
      expect((await database.get('conversationBranches', preparation.branch.id))?.url).toBe(
        expectedUrl,
      );
    }

    expect(resolveNewConversationUrl('custom', 'https://example.com/chat/1')).toBe(
      'https://example.com/',
    );
    for (const platform of SUPPORTED_PLATFORMS) {
      const newChat = resolveNewConversationUrl(
        platform.id,
        `https://${platform.hostname}/conversation/one`,
      );
      expect(isNewConversationUrl(platform.id, newChat)).toBe(true);
      expect(isNewConversationUrl(platform.id, `${newChat.replace(/\/$/, '')}/existing`)).toBe(
        false,
      );
    }
  });

  it('deduplicates an in-flight branch and restores its branch group after a service restart', async () => {
    const service = new ConversationBranchHandoffService(database);
    const branchTransfer = transfer('custom', 'http://localhost/source');
    const first = await service.prepare(branchTransfer, 'manual');
    const duplicate = await service.prepare(branchTransfer, 'manual');
    expect(duplicate.branch.id).toBe(first.branch.id);

    const handoff = await service.open(first.branch.id, branchTransfer);
    const targetConversation: PlatformConversation = {
      platform: 'custom',
      accountScopeId: 'anonymous',
      conversationId: 'branch-conversation',
      url: 'http://localhost/branch/conversation',
      title: 'Branch conversation',
      createdAt: null,
      updatedAt: null,
    };
    await service.complete('custom', handoff.id, targetConversation, 1);

    const restartedService = new ConversationBranchHandoffService(database);
    const restored = await restartedService.observe('custom', targetConversation, 7);
    expect(restored?.currentBranchId).toBe(first.branch.id);
    expect(restored?.branches).toHaveLength(2);

    const original = restored!.branches.find(({ method }) => method === 'original')!;
    const updateTab = vi.spyOn(browser.tabs, 'update');
    await restartedService.navigate(original.id, 7);
    expect(updateTab).toHaveBeenCalledWith(7, { url: 'http://localhost/source' });
  });

  it('creates a branch immediately from the message action without a preview dialog', async () => {
    setupDocument();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    const nextGroup = group();
    const sendMessage = vi
      .spyOn(browser.runtime, 'sendMessage')
      .mockImplementation(async (request) => {
        const runtime = request as { type?: string };
        if (runtime.type === 'conversationBranch.prepare') {
          return { ok: true, value: { branch: nextGroup.branches[1], group: nextGroup } };
        }
        return { ok: true };
      });
    const adapter = setupAdapter();
    vi.spyOn(adapter, 'forkConversation').mockResolvedValue({ method: 'manual' });
    const messages = [message('user', 0, 'Question'), message('assistant', 1, 'Answer')];

    render(
      <I18nProvider locale="en">
        <ConversationBranchControls adapter={adapter} messages={messages} configuredModel={null} />
      </I18nProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Branch from message 2' }));
    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'conversationBranch.open',
          branchId: 'branch-1',
        }),
      ),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.querySelector<HTMLTextAreaElement>('#composer')?.value).toBe('');
    adapter.dispose();
  });

  it('uses a native branch without creating a local context-branch record', async () => {
    setupDocument();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    const sendMessage = vi.spyOn(browser.runtime, 'sendMessage');
    const adapter = setupAdapter();
    const forkConversation = vi
      .spyOn(adapter, 'forkConversation')
      .mockResolvedValue({ method: 'native' });
    const messages = [message('user', 0, 'Question')];

    render(
      <I18nProvider locale="en">
        <ConversationBranchControls adapter={adapter} messages={messages} configuredModel={null} />
      </I18nProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Branch from message 1' }));
    await waitFor(() => expect(forkConversation).toHaveBeenCalledWith(messages[0]));
    expect(sendMessage).not.toHaveBeenCalled();
    expect(screen.getByText('The platform branch is opening.')).toBeVisible();
    adapter.dispose();
  });

  it('automatically fills a pending context branch exactly once and never sends it', async () => {
    setupDocument();
    const adapter = setupAdapter();
    const handoff: ConversationBranchHandoff = {
      ...transfer('custom', 'http://localhost/source'),
      id: 'handoff-1',
      branchId: 'branch-1',
      branchName: 'Branch 1',
      method: 'manual',
      createdAt: 1,
      expiresAt: Date.now() + 60_000,
    };
    const sendButton = document.querySelector<HTMLButtonElement>('#send')!;
    const sendClick = vi.fn();
    sendButton.addEventListener('click', sendClick);
    const sendMessage = vi
      .spyOn(browser.runtime, 'sendMessage')
      .mockImplementation(async (request) => {
        const runtime = request as { type?: string };
        if (runtime.type === 'conversationBranch.pending') return { ok: true, value: handoff };
        if (runtime.type === 'conversationBranch.complete') return { ok: true, value: group() };
        return { ok: true };
      });

    render(
      <I18nProvider locale="en">
        <ConversationBranchHandoffBanner adapter={adapter} platformId="custom" routeRevision={0} />
      </I18nProvider>,
    );

    await waitFor(() =>
      expect(document.querySelector<HTMLTextAreaElement>('#composer')?.value).toBe(handoff.context),
    );
    expect(sendClick).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'conversationBranch.complete', id: 'handoff-1' }),
    );
    expect(screen.getByText(/Branch context was filled/)).toBeVisible();
    adapter.dispose();
  });

  it('shows the current branch and routes branch switches through the persisted branch list', async () => {
    setupDocument();
    const adapter = setupAdapter();
    const initial = group('branch-1');
    const switched = group('original-1');
    const sendMessage = vi
      .spyOn(browser.runtime, 'sendMessage')
      .mockImplementation(async (request) => {
        const runtime = request as { type?: string };
        if (runtime.type === 'conversationBranch.observe') return { ok: true, value: initial };
        if (runtime.type === 'conversationBranch.navigate') return { ok: true, value: switched };
        return { ok: true };
      });

    render(
      <I18nProvider locale="en">
        <ConversationBranchNavigator adapter={adapter} platformId="custom" routeRevision={0} />
      </I18nProvider>,
    );

    const navigator = await screen.findByLabelText('Conversation branches');
    fireEvent.click(within(navigator).getByRole('button'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Source chatOriginal conversation/ }));
    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({
        type: 'conversationBranch.navigate',
        branchId: 'original-1',
      }),
    );
    adapter.dispose();
  });
});
