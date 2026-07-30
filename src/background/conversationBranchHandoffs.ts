import browser from 'webextension-polyfill';

import { WorkspaceDatabase } from '../shared/storage/indexedDb';
import type {
  ConversationBranchGroup,
  ConversationBranchHandoff,
  ConversationBranchDelivery,
  ConversationBranchMethod,
  ConversationBranchPreparation,
  ConversationBranchRecord,
  ConversationBranchTransfer,
} from '../shared/types/conversationBranch';
import type { PlatformConversation, PlatformId } from '../shared/types/platform';
import {
  BRANCH_HANDOFF_TTL_MS,
  conversationBranchActiveTabKey,
  conversationBranchSessionKey,
  conversationBranchTabSessionKey,
  isConversationBranchHandoff,
  MAX_BRANCH_DIRECT_CHARACTERS,
  resolveNewConversationUrl,
  validateConversationBranchTransfer,
} from '../shared/utils/conversationBranch';
import { sanitizeConversationUrl } from '../shared/utils/conversationUrl';

function sameConversation(
  record: ConversationBranchRecord,
  conversation: Pick<PlatformConversation, 'conversationId' | 'url'>,
): boolean {
  if (record.conversationId && conversation.conversationId) {
    return record.conversationId === conversation.conversationId;
  }
  return record.url === sanitizeConversationUrl(conversation.url);
}

function originalName(title: string | null): string {
  return title?.trim() || 'Original conversation';
}

export class ConversationBranchHandoffService {
  private readonly handoffs = new Map<string, ConversationBranchHandoff>();
  private readonly activeBranches = new Map<number, string>();

  constructor(private readonly database = new WorkspaceDatabase()) {}

  private get sessionStorage() {
    return (
      browser.storage as typeof browser.storage & {
        session?: Pick<typeof browser.storage.local, 'get' | 'set' | 'remove'>;
      }
    ).session;
  }

  private handoffKey(platformId: PlatformId, tabId?: number): string {
    return tabId === undefined
      ? conversationBranchSessionKey(platformId)
      : conversationBranchTabSessionKey(tabId);
  }

  private async setActiveBranch(tabId: number | undefined, branchId: string): Promise<void> {
    if (tabId === undefined) return;
    this.activeBranches.set(tabId, branchId);
    await this.sessionStorage?.set({ [conversationBranchActiveTabKey(tabId)]: branchId });
  }

  private async getActiveBranchId(tabId?: number): Promise<string | null> {
    if (tabId === undefined) return null;
    const memory = this.activeBranches.get(tabId);
    if (memory) return memory;
    const key = conversationBranchActiveTabKey(tabId);
    const stored = await this.sessionStorage?.get(key);
    const value = stored?.[key];
    if (typeof value !== 'string') return null;
    this.activeBranches.set(tabId, value);
    return value;
  }

  private async group(groupId: string, currentBranchId: string): Promise<ConversationBranchGroup> {
    const branches = (await this.database.getAll('conversationBranches'))
      .filter((record) => record.groupId === groupId)
      .sort((left, right) => {
        if (left.method === 'original') return -1;
        if (right.method === 'original') return 1;
        return left.createdAt - right.createdAt;
      });
    return { groupId, currentBranchId, branches };
  }

  private async currentSourceBranch(
    transfer: ConversationBranchTransfer,
    tabId?: number,
  ): Promise<ConversationBranchRecord | null> {
    const records = await this.database.getAll('conversationBranches');
    const activeId = await this.getActiveBranchId(tabId);
    const active = activeId ? records.find(({ id }) => id === activeId) : undefined;
    if (
      active &&
      active.platformId === transfer.platformId &&
      active.accountScopeId === transfer.accountScopeId
    ) {
      return active;
    }
    return (
      records.find(
        (record) =>
          record.platformId === transfer.platformId &&
          record.accountScopeId === transfer.accountScopeId &&
          ((transfer.sourceConversationId &&
            record.conversationId === transfer.sourceConversationId) ||
            record.url === transfer.sourceUrl),
      ) ?? null
    );
  }

  async prepare(
    transferInput: ConversationBranchTransfer,
    preferredMethod: Exclude<ConversationBranchMethod, 'original'>,
    sourceTabId?: number,
  ): Promise<ConversationBranchPreparation> {
    const transfer = validateConversationBranchTransfer(transferInput);
    const now = Date.now();
    let source = await this.currentSourceBranch(transfer, sourceTabId);
    if (!source) {
      const groupId = crypto.randomUUID();
      source = {
        id: crypto.randomUUID(),
        groupId,
        platformId: transfer.platformId,
        accountScopeId: transfer.accountScopeId,
        parentBranchId: null,
        conversationId: transfer.sourceConversationId,
        url: transfer.sourceUrl,
        title: transfer.sourceTitle,
        name: originalName(transfer.sourceTitle),
        method: 'original',
        state: 'ready',
        branchPointMessageKey: null,
        branchPointOrder: null,
        branchPointRole: null,
        model: transfer.model,
        createdAt: now,
        updatedAt: now,
      };
      await this.database.put('conversationBranches', source);
    }

    const groupRecords = (await this.database.getAll('conversationBranches')).filter(
      ({ groupId }) => groupId === source!.groupId,
    );
    const recentDuplicate = groupRecords.find(
      (record) =>
        record.parentBranchId === source!.id &&
        record.branchPointMessageKey === transfer.branchPointMessageKey &&
        record.state === 'creating' &&
        now - record.createdAt < 10_000,
    );
    if (recentDuplicate) {
      if (preferredMethod === 'native') await this.setActiveBranch(sourceTabId, recentDuplicate.id);
      return {
        branch: recentDuplicate,
        group: await this.group(recentDuplicate.groupId, recentDuplicate.id),
      };
    }

    const branchNumber = groupRecords.filter(({ method }) => method !== 'original').length + 1;
    const branch: ConversationBranchRecord = {
      id: crypto.randomUUID(),
      groupId: source.groupId,
      platformId: transfer.platformId,
      accountScopeId: transfer.accountScopeId,
      parentBranchId: source.id,
      conversationId: null,
      url: null,
      title: null,
      name: `Branch ${branchNumber}`,
      method: preferredMethod,
      state: 'creating',
      branchPointMessageKey: transfer.branchPointMessageKey,
      branchPointOrder: transfer.branchPointOrder,
      branchPointRole: transfer.branchPointRole,
      model: transfer.model,
      createdAt: now,
      updatedAt: now,
    };
    await this.database.put('conversationBranches', branch);
    if (preferredMethod === 'native') await this.setActiveBranch(sourceTabId, branch.id);
    return { branch, group: await this.group(branch.groupId, branch.id) };
  }

  async open(
    branchId: string,
    transferInput: ConversationBranchTransfer,
    sourceTabId?: number,
    delivery: ConversationBranchDelivery = 'direct',
    fileName: string | null = null,
  ): Promise<ConversationBranchHandoff> {
    const transfer = validateConversationBranchTransfer(transferInput);
    const safeDelivery: ConversationBranchDelivery =
      delivery === 'markdown' ? 'markdown' : 'direct';
    if (safeDelivery === 'direct' && transfer.context.length > MAX_BRANCH_DIRECT_CHARACTERS) {
      throw new Error('Long conversation branches require a Markdown handoff.');
    }
    const branch = await this.database.get('conversationBranches', branchId);
    if (!branch || branch.platformId !== transfer.platformId) {
      throw new Error('Conversation branch preparation was not found.');
    }
    const now = Date.now();
    const targetUrl = resolveNewConversationUrl(transfer.platformId, transfer.sourceUrl);
    if (
      sourceTabId !== undefined &&
      branch.parentBranchId &&
      (await this.getActiveBranchId(sourceTabId)) === branch.id
    ) {
      await this.setActiveBranch(sourceTabId, branch.parentBranchId);
    }
    const tab = await browser.tabs.create({ url: targetUrl });
    const targetTabId = tab.id;
    const updatedBranch: ConversationBranchRecord = {
      ...branch,
      method: 'manual',
      url: sanitizeConversationUrl(targetUrl),
      updatedAt: now,
    };
    await this.database.put('conversationBranches', updatedBranch);
    await this.setActiveBranch(targetTabId, branch.id);

    const handoff: ConversationBranchHandoff = {
      ...transfer,
      id: crypto.randomUUID(),
      branchId: branch.id,
      branchName: branch.name,
      method: 'manual',
      delivery: safeDelivery,
      fileName: safeDelivery === 'markdown' ? fileName?.trim().slice(0, 240) || null : null,
      createdAt: now,
      expiresAt: now + BRANCH_HANDOFF_TTL_MS,
    };
    const key = this.handoffKey(handoff.platformId, targetTabId);
    this.handoffs.set(key, handoff);
    await this.sessionStorage?.set({ [key]: handoff });
    return handoff;
  }

  async pending(platformId: PlatformId, tabId?: number): Promise<ConversationBranchHandoff | null> {
    const key = this.handoffKey(platformId, tabId);
    const memoryValue = this.handoffs.get(key);
    const stored = this.sessionStorage ? await this.sessionStorage.get(key) : undefined;
    const storedValue = stored?.[key];
    const handoff = memoryValue ?? (isConversationBranchHandoff(storedValue) ? storedValue : null);
    if (!handoff || handoff.platformId !== platformId) return null;
    if (handoff.expiresAt <= Date.now()) {
      await this.discard(platformId, handoff.id, tabId);
      return null;
    }
    this.handoffs.set(key, handoff);
    return handoff;
  }

  async complete(
    platformId: PlatformId,
    id: string,
    conversation: PlatformConversation,
    tabId?: number,
  ): Promise<ConversationBranchGroup | null> {
    const handoff = await this.pending(platformId, tabId);
    if (!handoff || handoff.id !== id) return null;
    const branch = await this.database.get('conversationBranches', handoff.branchId);
    if (!branch) return null;
    const updated: ConversationBranchRecord = {
      ...branch,
      conversationId: conversation.conversationId,
      url: sanitizeConversationUrl(conversation.url),
      title: conversation.title,
      state: 'ready',
      updatedAt: Date.now(),
    };
    await this.database.put('conversationBranches', updated);
    await this.setActiveBranch(tabId, updated.id);
    await this.clearHandoff(platformId, tabId);
    return this.group(updated.groupId, updated.id);
  }

  async discard(platformId: PlatformId, id: string, tabId?: number): Promise<void> {
    const handoff = await this.pendingWithoutExpiryCheck(platformId, tabId);
    if (!handoff || handoff.id !== id) return;
    await this.clearHandoff(platformId, tabId);
    await this.cancel(handoff.branchId, tabId);
  }

  async cancel(branchId: string, tabId?: number): Promise<void> {
    const branch = await this.database.get('conversationBranches', branchId);
    if (!branch || branch.method === 'original') return;
    await this.database.delete('conversationBranches', branch.id);
    const remaining = (await this.database.getAll('conversationBranches')).filter(
      ({ groupId }) => groupId === branch.groupId,
    );
    if (remaining.length === 1 && remaining[0].method === 'original') {
      await this.database.delete('conversationBranches', remaining[0].id);
    }
    if (tabId !== undefined && (await this.getActiveBranchId(tabId)) === branchId) {
      this.activeBranches.delete(tabId);
      await this.sessionStorage?.remove(conversationBranchActiveTabKey(tabId));
    }
  }

  async observe(
    platformId: PlatformId,
    conversation: PlatformConversation,
    tabId?: number,
  ): Promise<ConversationBranchGroup | null> {
    const records = await this.database.getAll('conversationBranches');
    const activeId = await this.getActiveBranchId(tabId);
    let current = activeId ? records.find(({ id }) => id === activeId) : undefined;
    if (!current || current.platformId !== platformId) {
      const matches = records.filter(
        (record) =>
          record.platformId === platformId &&
          record.accountScopeId === conversation.accountScopeId &&
          sameConversation(record, conversation),
      );
      current = matches.find(({ state }) => state === 'ready') ?? matches[0];
    }
    if (!current) return null;

    const parent = current.parentBranchId
      ? records.find(({ id }) => id === current!.parentBranchId)
      : undefined;
    const stillOnNativeSource =
      current.method === 'native' &&
      current.state === 'creating' &&
      parent !== undefined &&
      sameConversation(parent, conversation);
    if (!stillOnNativeSource) {
      current = {
        ...current,
        conversationId: conversation.conversationId,
        url: sanitizeConversationUrl(conversation.url),
        title: conversation.title,
        state: 'ready',
        updatedAt: Date.now(),
      };
      await this.database.put('conversationBranches', current);
    }
    await this.setActiveBranch(tabId, current.id);
    return this.group(current.groupId, current.id);
  }

  async navigate(branchId: string, tabId?: number): Promise<ConversationBranchGroup> {
    const branch = await this.database.get('conversationBranches', branchId);
    if (!branch || !branch.url) throw new Error('This branch is not ready to open yet.');
    await this.setActiveBranch(tabId, branch.id);
    if (tabId === undefined) await browser.tabs.create({ url: branch.url });
    else await browser.tabs.update(tabId, { url: branch.url });
    return this.group(branch.groupId, branch.id);
  }

  private async clearHandoff(platformId: PlatformId, tabId?: number): Promise<void> {
    const key = this.handoffKey(platformId, tabId);
    this.handoffs.delete(key);
    await this.sessionStorage?.remove(key);
  }

  private async pendingWithoutExpiryCheck(
    platformId: PlatformId,
    tabId?: number,
  ): Promise<ConversationBranchHandoff | null> {
    const key = this.handoffKey(platformId, tabId);
    const memoryValue = this.handoffs.get(key);
    if (memoryValue) return memoryValue;
    if (!this.sessionStorage) return null;
    const stored = await this.sessionStorage.get(key);
    const storedValue = stored[key];
    return isConversationBranchHandoff(storedValue) ? storedValue : null;
  }
}
