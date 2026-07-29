import type { PlatformId } from './platform';
import type { ConversationBranchRecord } from './conversationBranch';

export interface PromptRecord {
  id: string;
  scope: 'global' | 'platform' | 'account';
  platformId: PlatformId | null;
  accountScopeId: string | null;
  title: string;
  content: string;
  description: string;
  tags: string[];
  folderId: string | null;
  usageCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface PromptFolderRecord {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface DraftRecord {
  id: string;
  platformId: PlatformId;
  accountScopeId: string;
  conversationId: string | null;
  conversationUrl: string;
  content: string;
  selectionStart: number | null;
  selectionEnd: number | null;
  updatedAt: number;
}

export interface TimelineMetadataRecord {
  id: string;
  platformId: PlatformId;
  accountScopeId: string;
  conversationId: string;
  messageKey: string;
  messageId: string | null;
  hierarchyLevel: number;
  collapsed: boolean;
  note: string | null;
  observedAt: number;
  updatedAt: number;
}

export interface ConversationPinRecord {
  id: string;
  platformId: PlatformId;
  accountScopeId: string;
  conversationId: string;
  messageKey: string;
  messageId: string | null;
  anchorPath?: string | null;
  anchorKind?: 'point' | 'text';
  anchorXRatio?: number;
  anchorYRatio?: number;
  documentYRatio?: number;
  startOffset: number;
  endOffset: number;
  textHash: string;
  createdAt: number;
  updatedAt: number;
}

export type TextHighlightColor = 'yellow' | 'green' | 'blue' | 'pink';

export interface TextHighlightRecord {
  id: string;
  platformId: PlatformId;
  accountScopeId: string;
  conversationId: string;
  messageKey: string;
  messageId: string | null;
  startOffset: number;
  endOffset: number;
  textHash: string;
  color: TextHighlightColor;
  createdAt: number;
  updatedAt: number;
}

export interface CustomSiteBindingRecord {
  id: string;
  origin: string;
  platformId: PlatformId;
  accountScopeId: string;
  composerSelector: string;
  sendButtonSelector: string | null;
  messageContainerSelector: string | null;
  userMessageSelector: string | null;
  assistantMessageSelector: string | null;
  modelControlSelector?: string | null;
  generationIndicatorSelector?: string | null;
  enabled: boolean;
  bindingSource?: 'manual' | 'automatic' | 'mixed';
  automaticBindingVersion?: number | null;
  lastValidatedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export type ApiProviderType =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'deepseek'
  | 'xai'
  | 'moonshot'
  | 'openai-compatible'
  | 'ollama';

export interface ApiProfileMetadataRecord {
  id: string;
  providerType: ApiProviderType;
  name: string;
  endpoint: string;
  baseUrlOrigin: string;
  model: string;
  secretStorage: 'session' | 'encrypted-local';
  hasSecret: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface MetadataRecord {
  id: string;
  value: unknown;
  updatedAt: number;
}

export type DatabaseRecord =
  | PromptRecord
  | PromptFolderRecord
  | DraftRecord
  | TimelineMetadataRecord
  | ConversationPinRecord
  | TextHighlightRecord
  | CustomSiteBindingRecord
  | ApiProfileMetadataRecord
  | ConversationBranchRecord
  | MetadataRecord;
