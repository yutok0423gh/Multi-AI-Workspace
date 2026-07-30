import type { DebugReport } from './diagnostics';
import type {
  ApiProfileInput,
  ChatSummaryRequest,
  ChatSummaryResult,
  PromptRewriteRequest,
  PromptRewriteResult,
} from '../ai/types';
import type { DatabaseStoreName } from '../constants/storage';
import type { ApiProfileMetadataRecord, CustomSiteBindingRecord } from './records';
import type { PlatformConversation, PlatformId } from './platform';
import type { AppSettings, DeepPartial } from './settings';
import type {
  ConversationBranchDelivery,
  ConversationBranchTransfer,
} from './conversationBranch';

export type RuntimeRequest =
  | { type: 'settings.get' }
  | { type: 'settings.update'; patch: DeepPartial<AppSettings> }
  | { type: 'options.open'; section?: string }
  | { type: 'diagnostics.export'; report: DebugReport }
  | { type: 'migration.run' }
  | { type: 'provider.list' }
  | { type: 'provider.save'; input: ApiProfileInput }
  | { type: 'provider.unlock'; profileId: string; encryptionPassword: string }
  | { type: 'provider.delete'; profileId: string }
  | { type: 'prompt.rewrite'; profileId: string; request: PromptRewriteRequest }
  | { type: 'chat.summarize'; profileId: string; request: ChatSummaryRequest }
  | { type: 'binding.get'; origin: string; platformId: PlatformId }
  | { type: 'binding.save'; binding: CustomSiteBindingRecord }
  | { type: 'binding.delete'; id: string }
  | { type: 'database.get'; store: DatabaseStoreName; id: string }
  | { type: 'database.list'; store: DatabaseStoreName }
  | { type: 'database.put'; store: DatabaseStoreName; record: unknown }
  | { type: 'database.delete'; store: DatabaseStoreName; id: string }
  | {
      type: 'conversationBranch.prepare';
      transfer: ConversationBranchTransfer;
      preferredMethod: 'native' | 'manual';
    }
  | {
      type: 'conversationBranch.open';
      branchId: string;
      transfer: ConversationBranchTransfer;
      delivery?: ConversationBranchDelivery;
      fileName?: string | null;
    }
  | { type: 'conversationBranch.pending'; platformId: PlatformId }
  | { type: 'conversationBranch.clear'; platformId: PlatformId; id: string }
  | {
      type: 'conversationBranch.complete';
      platformId: PlatformId;
      id: string;
      conversation: PlatformConversation;
    }
  | { type: 'conversationBranch.cancel'; branchId: string }
  | {
      type: 'conversationBranch.observe';
      platformId: PlatformId;
      conversation: PlatformConversation;
    }
  | { type: 'conversationBranch.navigate'; branchId: string }
  | { type: 'notification.show'; title: string; message: string; dedupeKey?: string };

export type RuntimeResponse =
  | {
      ok: true;
      settings?: AppSettings;
      value?: unknown;
      profiles?: Array<{ profile: ApiProfileMetadataRecord; unlocked: boolean }>;
      rewrite?: PromptRewriteResult;
      summary?: ChatSummaryResult;
      binding?: CustomSiteBindingRecord | null;
    }
  | { ok: false; error: { code: string; message: string } };
