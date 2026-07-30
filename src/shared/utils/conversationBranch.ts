import { SUPPORTED_PLATFORMS } from '../constants/platforms';
import type {
  ConversationBranchGroup,
  ConversationBranchHandoff,
  ConversationBranchPreparation,
  ConversationBranchRecord,
  ConversationBranchTransfer,
} from '../types/conversationBranch';
import type { PlatformId } from '../types/platform';
import { sanitizeConversationUrl } from './conversationUrl';

export const MAX_BRANCH_TRANSFER_CHARACTERS = 500_000;
export const MAX_BRANCH_DIRECT_CHARACTERS = 20_000;
export const BRANCH_HANDOFF_TTL_MS = 15 * 60 * 1_000;
export const CONVERSATION_BRANCH_SESSION_PREFIX = 'multiAiWorkspace.conversationBranch.';
export const CONVERSATION_BRANCH_TAB_SESSION_PREFIX = 'multiAiWorkspace.conversationBranch.tab.';
export const CONVERSATION_BRANCH_ACTIVE_TAB_PREFIX = 'multiAiWorkspace.conversationBranch.active.';

export function conversationBranchSessionKey(platformId: PlatformId): string {
  return `${CONVERSATION_BRANCH_SESSION_PREFIX}${platformId}`;
}

export function conversationBranchTabSessionKey(tabId: number): string {
  return `${CONVERSATION_BRANCH_TAB_SESSION_PREFIX}${tabId}`;
}

export function conversationBranchActiveTabKey(tabId: number): string {
  return `${CONVERSATION_BRANCH_ACTIVE_TAB_PREFIX}${tabId}`;
}

const NEW_CONVERSATION_URLS: Record<Exclude<PlatformId, 'custom'>, string> = {
  chatgpt: 'https://chatgpt.com/',
  claude: 'https://claude.ai/new',
  gemini: 'https://gemini.google.com/app',
  deepseek: 'https://chat.deepseek.com/',
  grok: 'https://grok.com/',
  kimi: 'https://www.kimi.com/?chat_enter_method=new_chat',
};

export function resolveNewConversationUrl(platformId: PlatformId, sourceUrl: string): string {
  if (platformId !== 'custom') return NEW_CONVERSATION_URLS[platformId];
  const source = new URL(sourceUrl);
  if (source.protocol !== 'https:' && source.protocol !== 'http:') {
    throw new Error('Custom conversation branches require an HTTP(S) source.');
  }
  return `${source.origin}/`;
}

export function isNewConversationUrl(platformId: PlatformId, currentUrl: string): boolean {
  const current = new URL(currentUrl);
  const expected = new URL(resolveNewConversationUrl(platformId, currentUrl));
  const normalizePath = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path);
  return (
    current.origin === expected.origin &&
    normalizePath(current.pathname) === normalizePath(expected.pathname) &&
    !current.hash
  );
}

export function validateConversationBranchTransfer(
  transfer: ConversationBranchTransfer,
): ConversationBranchTransfer {
  if (!transfer.context.trim() || transfer.context.length > MAX_BRANCH_TRANSFER_CHARACTERS) {
    throw new Error('Conversation branch context is empty or too large.');
  }
  if (!Number.isInteger(transfer.messageCount) || transfer.messageCount < 1) {
    throw new Error('Conversation branch message count is invalid.');
  }
  if (!transfer.accountScopeId.trim()) {
    throw new Error('Conversation branch account scope is invalid.');
  }
  if (!transfer.branchPointMessageKey.trim()) {
    throw new Error('Conversation branch message key is invalid.');
  }
  if (!Number.isInteger(transfer.branchPointOrder) || transfer.branchPointOrder < 0) {
    throw new Error('Conversation branch message order is invalid.');
  }
  if (!['user', 'assistant', 'system'].includes(transfer.branchPointRole)) {
    throw new Error('Conversation branch message role is invalid.');
  }
  const sourceUrl = sanitizeConversationUrl(transfer.sourceUrl);
  const source = new URL(sourceUrl);
  if (source.protocol !== 'https:' && source.protocol !== 'http:') {
    throw new Error('Conversation branch source must use HTTP(S).');
  }
  if (transfer.platformId !== 'custom') {
    const platform = SUPPORTED_PLATFORMS.find(({ id }) => id === transfer.platformId);
    if (!platform || source.hostname !== platform.hostname) {
      throw new Error('Conversation branch source does not match the selected platform.');
    }
  }
  return {
    ...transfer,
    accountScopeId: transfer.accountScopeId.trim().slice(0, 300),
    sourceConversationId: transfer.sourceConversationId?.trim().slice(0, 500) || null,
    sourceUrl,
    sourceTitle: transfer.sourceTitle?.trim().slice(0, 500) || null,
    branchPoint: transfer.branchPoint.trim().slice(0, 500),
    branchPointMessageKey: transfer.branchPointMessageKey.trim().slice(0, 700),
    model: transfer.model?.trim().slice(0, 300) || null,
    truncated: false,
  };
}

export function isConversationBranchHandoff(value: unknown): value is ConversationBranchHandoff {
  if (!value || typeof value !== 'object') return false;
  const handoff = value as Partial<ConversationBranchHandoff>;
  return (
    typeof handoff.id === 'string' &&
    typeof handoff.branchId === 'string' &&
    typeof handoff.branchName === 'string' &&
    handoff.method === 'manual' &&
    (handoff.delivery === undefined || ['direct', 'markdown'].includes(handoff.delivery)) &&
    (handoff.fileName === undefined ||
      typeof handoff.fileName === 'string' ||
      handoff.fileName === null) &&
    typeof handoff.platformId === 'string' &&
    typeof handoff.accountScopeId === 'string' &&
    (typeof handoff.sourceConversationId === 'string' || handoff.sourceConversationId === null) &&
    typeof handoff.sourceUrl === 'string' &&
    (typeof handoff.sourceTitle === 'string' || handoff.sourceTitle === null) &&
    typeof handoff.branchPoint === 'string' &&
    typeof handoff.branchPointMessageKey === 'string' &&
    typeof handoff.branchPointOrder === 'number' &&
    ['user', 'assistant', 'system'].includes(handoff.branchPointRole ?? '') &&
    typeof handoff.context === 'string' &&
    typeof handoff.messageCount === 'number' &&
    typeof handoff.truncated === 'boolean' &&
    (typeof handoff.model === 'string' || handoff.model === null) &&
    typeof handoff.createdAt === 'number' &&
    typeof handoff.expiresAt === 'number'
  );
}

export function isConversationBranchRecord(value: unknown): value is ConversationBranchRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<ConversationBranchRecord>;
  return (
    typeof record.id === 'string' &&
    typeof record.groupId === 'string' &&
    typeof record.platformId === 'string' &&
    typeof record.accountScopeId === 'string' &&
    (typeof record.parentBranchId === 'string' || record.parentBranchId === null) &&
    (typeof record.conversationId === 'string' || record.conversationId === null) &&
    (typeof record.url === 'string' || record.url === null) &&
    typeof record.name === 'string' &&
    ['original', 'native', 'manual'].includes(record.method ?? '') &&
    ['creating', 'ready'].includes(record.state ?? '') &&
    typeof record.createdAt === 'number' &&
    typeof record.updatedAt === 'number'
  );
}

export function isConversationBranchGroup(value: unknown): value is ConversationBranchGroup {
  if (!value || typeof value !== 'object') return false;
  const group = value as Partial<ConversationBranchGroup>;
  return (
    typeof group.groupId === 'string' &&
    typeof group.currentBranchId === 'string' &&
    Array.isArray(group.branches) &&
    group.branches.every(isConversationBranchRecord)
  );
}

export function isConversationBranchPreparation(
  value: unknown,
): value is ConversationBranchPreparation {
  if (!value || typeof value !== 'object') return false;
  const preparation = value as Partial<ConversationBranchPreparation>;
  return (
    isConversationBranchRecord(preparation.branch) && isConversationBranchGroup(preparation.group)
  );
}
