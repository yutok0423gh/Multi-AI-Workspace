import type { PlatformId } from './platform';

export type ConversationBranchMethod = 'original' | 'native' | 'manual';
export type ConversationBranchState = 'creating' | 'ready';
export type ConversationBranchMessageRole = 'user' | 'assistant' | 'system';
export type ConversationBranchDelivery = 'direct' | 'markdown';

export interface ConversationBranchTransfer {
  platformId: PlatformId;
  accountScopeId: string;
  sourceConversationId: string | null;
  sourceUrl: string;
  sourceTitle: string | null;
  branchPoint: string;
  branchPointMessageKey: string;
  branchPointOrder: number;
  branchPointRole: ConversationBranchMessageRole;
  context: string;
  messageCount: number;
  truncated: boolean;
  model: string | null;
}

export interface ConversationBranchHandoff extends ConversationBranchTransfer {
  id: string;
  branchId: string;
  branchName: string;
  method: 'manual';
  delivery?: ConversationBranchDelivery;
  fileName?: string | null;
  createdAt: number;
  expiresAt: number;
}

export interface ConversationBranchRecord {
  id: string;
  groupId: string;
  platformId: PlatformId;
  accountScopeId: string;
  parentBranchId: string | null;
  conversationId: string | null;
  url: string | null;
  title: string | null;
  name: string;
  method: ConversationBranchMethod;
  state: ConversationBranchState;
  branchPointMessageKey: string | null;
  branchPointOrder: number | null;
  branchPointRole: ConversationBranchMessageRole | null;
  model: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ConversationBranchGroup {
  groupId: string;
  currentBranchId: string;
  branches: ConversationBranchRecord[];
}

export interface ConversationBranchPreparation {
  branch: ConversationBranchRecord;
  group: ConversationBranchGroup;
}
