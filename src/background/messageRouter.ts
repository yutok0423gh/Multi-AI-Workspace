import browser from 'webextension-polyfill';

import { AppError } from '../shared/errors/AppError';
import { logger } from '../shared/logger/logger';
import { MigrationManager } from '../shared/migrations/migrations';
import { WorkspaceDatabase } from '../shared/storage/indexedDb';
import { SettingsRepository } from '../shared/storage/localStorage';
import type { RuntimeRequest, RuntimeResponse } from '../shared/types/messages';
import type { DatabaseRecord } from '../shared/types/records';
import { createBindingId } from '../shared/utils/bindingKey';
import { rewritePromptWithProvider, summarizeChatWithProvider } from './providerClient';
import { ProviderProfileService } from './providerProfiles';
import { ConversationBranchHandoffService } from './conversationBranchHandoffs';

const settingsRepository = new SettingsRepository();
const database = new WorkspaceDatabase();
const providerProfiles = new ProviderProfileService(database);
const conversationBranches = new ConversationBranchHandoffService();
const shownCompletionNotifications = new Set<string>();

export interface RuntimeMessageContext {
  tabId?: number;
}

async function releaseOptionalOriginIfUnused(origin: string): Promise<void> {
  const profiles = await database.getAll('apiProfiles');
  const stillUsed = profiles.some((profile) => profile.baseUrlOrigin === origin);
  if (!stillUsed) {
    await browser.permissions.remove({ origins: [`${origin}/*`] });
  }
}

function hasRecordId(value: unknown): value is DatabaseRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as { id?: unknown }).id === 'string'
  );
}

export async function routeMessage(
  request: RuntimeRequest,
  context: RuntimeMessageContext = {},
): Promise<RuntimeResponse> {
  try {
    switch (request.type) {
      case 'settings.get':
        return { ok: true, settings: await settingsRepository.get() };
      case 'settings.update':
        return {
          ok: true,
          settings: await settingsRepository.update(request.patch),
        };
      case 'options.open': {
        const suffix = request.section ? `#${encodeURIComponent(request.section)}` : '';
        await browser.tabs.create({ url: browser.runtime.getURL(`options.html${suffix}`) });
        return { ok: true };
      }
      case 'diagnostics.export':
        return { ok: true, value: `${JSON.stringify(request.report, null, 2)}\n` };
      case 'migration.run':
        return { ok: true, value: await new MigrationManager().run() };
      case 'provider.list':
        return { ok: true, profiles: await providerProfiles.list() };
      case 'provider.save': {
        const previous = request.input.id
          ? await database.get('apiProfiles', request.input.id)
          : undefined;
        const profile = await providerProfiles.save(request.input);
        if (previous && previous.baseUrlOrigin !== profile.baseUrlOrigin) {
          await releaseOptionalOriginIfUnused(previous.baseUrlOrigin);
        }
        return { ok: true, value: profile };
      }
      case 'provider.unlock':
        await providerProfiles.unlock(request.profileId, request.encryptionPassword);
        return { ok: true };
      case 'provider.delete': {
        const profile = await database.get('apiProfiles', request.profileId);
        await providerProfiles.delete(request.profileId);
        if (profile) await releaseOptionalOriginIfUnused(profile.baseUrlOrigin);
        return { ok: true };
      }
      case 'prompt.rewrite': {
        const { profile, apiKey } = await providerProfiles.getForRequest(request.profileId);
        return {
          ok: true,
          rewrite: await rewritePromptWithProvider(profile, apiKey, request.request),
        };
      }
      case 'chat.summarize': {
        const { profile, apiKey } = await providerProfiles.getForRequest(request.profileId);
        return {
          ok: true,
          summary: await summarizeChatWithProvider(profile, apiKey, request.request),
        };
      }
      case 'binding.get': {
        const binding = await database.get(
          'customSites',
          createBindingId(request.platformId, request.origin),
        );
        return { ok: true, binding: binding?.enabled ? binding : null };
      }
      case 'binding.save':
        await database.put('customSites', request.binding);
        return { ok: true, binding: request.binding };
      case 'binding.delete':
        await database.delete('customSites', request.id);
        return { ok: true };
      case 'database.get':
        return { ok: true, value: await database.get(request.store, request.id) };
      case 'database.list':
        return { ok: true, value: await database.getAll(request.store) };
      case 'database.put':
        if (!hasRecordId(request.record)) {
          throw new AppError('DATABASE_RECORD_INVALID', 'Database records require a string id.');
        }
        await database.put(request.store, request.record as never);
        return { ok: true, value: request.record };
      case 'database.delete':
        await database.delete(request.store, request.id);
        return { ok: true };
      case 'conversationBranch.prepare':
        return {
          ok: true,
          value: await conversationBranches.prepare(
            request.transfer,
            request.preferredMethod,
            context.tabId,
          ),
        };
      case 'conversationBranch.open':
        return {
          ok: true,
          value: await conversationBranches.open(
            request.branchId,
            request.transfer,
            context.tabId,
            request.delivery,
            request.fileName,
          ),
        };
      case 'conversationBranch.pending':
        return {
          ok: true,
          value: await conversationBranches.pending(request.platformId, context.tabId),
        };
      case 'conversationBranch.clear':
        await conversationBranches.discard(request.platformId, request.id, context.tabId);
        return { ok: true };
      case 'conversationBranch.complete':
        return {
          ok: true,
          value: await conversationBranches.complete(
            request.platformId,
            request.id,
            request.conversation,
            context.tabId,
          ),
        };
      case 'conversationBranch.cancel':
        await conversationBranches.cancel(request.branchId, context.tabId);
        return { ok: true };
      case 'conversationBranch.observe':
        return {
          ok: true,
          value: await conversationBranches.observe(
            request.platformId,
            request.conversation,
            context.tabId,
          ),
        };
      case 'conversationBranch.navigate':
        return {
          ok: true,
          value: await conversationBranches.navigate(request.branchId, context.tabId),
        };
      case 'notification.show': {
        if (request.dedupeKey && shownCompletionNotifications.has(request.dedupeKey)) {
          return { ok: true };
        }
        const allowed = await browser.permissions.contains({ permissions: ['notifications'] });
        if (!allowed) {
          throw new AppError(
            'NOTIFICATION_PERMISSION_MISSING',
            'Notification permission has not been granted.',
          );
        }
        await browser.notifications.create(
          request.dedupeKey ? `maw-answer-${request.dedupeKey}` : undefined,
          {
            type: 'basic',
            iconUrl: browser.runtime.getURL('icon-128.png'),
            title: request.title.slice(0, 100),
            message: request.message.slice(0, 240),
          },
        );
        if (request.dedupeKey) {
          shownCompletionNotifications.add(request.dedupeKey);
          if (shownCompletionNotifications.size > 500) {
            shownCompletionNotifications.delete(
              shownCompletionNotifications.values().next().value!,
            );
          }
        }
        return { ok: true };
      }
      default:
        return { ok: false, error: { code: 'UNKNOWN_MESSAGE', message: 'Unknown request type.' } };
    }
  } catch (error) {
    const code = error instanceof AppError ? error.code : 'BACKGROUND_REQUEST_FAILED';
    logger.error(code, 'A background request failed.', { error });
    return {
      ok: false,
      error: {
        code,
        message: error instanceof AppError ? error.message : 'The request could not be completed.',
      },
    };
  }
}
