import type { ConversationBranchTransfer } from '../shared/types/conversationBranch';
import type { PlatformConversation, PlatformMessage } from '../shared/types/platform';
import {
  MAX_BRANCH_DIRECT_CHARACTERS,
  MAX_BRANCH_TRANSFER_CHARACTERS,
} from '../shared/utils/conversationBranch';
import { sanitizeConversationUrl } from '../shared/utils/conversationUrl';

export const BRANCH_CONTEXT_WARNING_CHARACTERS = MAX_BRANCH_DIRECT_CHARACTERS;
export const BRANCH_DIRECT_CONTEXT_MAX_CHARACTERS = BRANCH_CONTEXT_WARNING_CHARACTERS;

export interface ConversationBranchDraft extends ConversationBranchTransfer {
  warning: boolean;
}

function safeDownloadName(value: string): string {
  const cleaned = value
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*]/g, '-')
    .split('')
    .map((character) => (character.charCodeAt(0) < 32 ? '-' : character))
    .join('')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 120);
  return cleaned || 'conversation';
}

export function conversationBranchMarkdownFileName(
  draft: Pick<ConversationBranchDraft, 'sourceTitle'>,
): string {
  return `${safeDownloadName(draft.sourceTitle ?? 'conversation')}-branch.md`;
}

export function downloadConversationBranchMarkdown(
  draft: Pick<ConversationBranchDraft, 'context' | 'sourceTitle'>,
  preferredFileName?: string | null,
): string {
  const fileName = preferredFileName?.trim() || conversationBranchMarkdownFileName(draft);
  const url = URL.createObjectURL(
    new Blob([`${draft.context.trimEnd()}\n`], { type: 'text/markdown;charset=utf-8' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return fileName;
}

function roleHeading(role: PlatformMessage['role']): string | null {
  if (role === 'system') return 'System';
  if (role === 'user') return 'User';
  if (role === 'assistant') return 'Assistant';
  return null;
}

function oneLine(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized;
}

function messageKey(message: PlatformMessage): string {
  return `${message.runtimeMessageId}:${message.order}:${message.role}`;
}

export function buildConversationBranchDraft(
  messages: PlatformMessage[],
  branchMessage: PlatformMessage,
  conversation: PlatformConversation,
  model: string | null,
): ConversationBranchDraft {
  const unique = new Map<string, PlatformMessage>();
  for (const message of messages) {
    if (message.order > branchMessage.order || roleHeading(message.role) === null) continue;
    unique.set(messageKey(message), message);
  }
  const eligible = [...unique.values()].sort((left, right) => left.order - right.order);
  const branchIndex = eligible.findIndex(
    (message) =>
      message.runtimeMessageId === branchMessage.runtimeMessageId &&
      message.order === branchMessage.order,
  );
  if (branchIndex < 0) throw new Error('The selected branch message is no longer available.');

  const segments = eligible.map((message) => {
    const heading = roleHeading(message.role)!;
    return `### ${heading}\n${message.plainText.trim()}`;
  });
  const branchPoint = `${branchMessage.role} ${branchMessage.order + 1}: ${oneLine(
    branchMessage.plainText,
    180,
  )}`;
  const context = [
    '# Conversation Branch Context',
    '',
    `Source platform: ${branchMessage.platform}`,
    `Source conversation: ${sanitizeConversationUrl(conversation.url)}`,
    `Branch point: ${branchPoint}`,
    ...(model ? [`Model: ${model}`] : []),
    '',
    '## Previous conversation',
    '',
    segments.join('\n\n'),
    '',
    '## New direction',
    '',
    '[Continue from this point.]',
  ].join('\n');
  if (context.length > MAX_BRANCH_TRANSFER_CHARACTERS) {
    throw new Error('The complete conversation is too large to transfer safely.');
  }

  return {
    platformId: branchMessage.platform,
    accountScopeId: conversation.accountScopeId,
    sourceConversationId: conversation.conversationId,
    sourceUrl: sanitizeConversationUrl(conversation.url),
    sourceTitle: conversation.title,
    branchPoint,
    branchPointMessageKey: messageKey(branchMessage),
    branchPointOrder: branchMessage.order,
    branchPointRole: branchMessage.role as 'user' | 'assistant' | 'system',
    context,
    messageCount: segments.length,
    truncated: false,
    model,
    warning: context.length > BRANCH_CONTEXT_WARNING_CHARACTERS,
  };
}
