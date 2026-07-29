import browser from 'webextension-polyfill';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { STORAGE_KEYS } from '../../src/shared/constants/storage';
import {
  exportRawExtensionData,
  MigrationManager,
  resetExtensionData,
} from '../../src/shared/migrations/migrations';
import { DEFAULT_SETTINGS, ExtensionLocalStorage } from '../../src/shared/storage/localStorage';
import { WorkspaceDatabase } from '../../src/shared/storage/indexedDb';
import type { TimelineMetadataRecord } from '../../src/shared/types/records';
import { MemoryStorage } from './localStorage.test';

const database = new WorkspaceDatabase();

afterEach(async () => {
  await database.reset();
  vi.restoreAllMocks();
});

describe('MigrationManager', () => {
  it('backs up data and applies all schema migrations idempotently', async () => {
    const memory = new MemoryStorage();
    memory.values.legacy = { preserved: true };
    const storage = new ExtensionLocalStorage(memory);
    const manager = new MigrationManager(storage, database);

    const first = await manager.run();
    const second = await manager.run();

    expect(first).toHaveLength(11);
    expect(first.every((result) => result.status === 'success')).toBe(true);
    expect(second).toEqual(first);
    expect(memory.values[STORAGE_KEYS.schemaVersion]).toBe(11);
    expect(memory.values[STORAGE_KEYS.migrationBackup]).toMatchObject({
      sourceVersion: 0,
      localStorage: { legacy: { preserved: true } },
    });
  });

  it('excludes encrypted provider secret payloads from explicit data export', async () => {
    const memory = new MemoryStorage();
    memory.values[`${STORAGE_KEYS.providerSecretPrefix}profile-1`] = {
      ciphertext: 'encrypted-secret',
    };
    memory.values.safeSetting = { preserved: true };
    memory.values[STORAGE_KEYS.migrationBackup] = {
      localStorage: {
        [`${STORAGE_KEYS.providerSecretPrefix}profile-1`]: {
          ciphertext: 'nested-encrypted-secret',
        },
        safeBackupValue: true,
      },
    };

    const exported = await exportRawExtensionData(new ExtensionLocalStorage(memory), database);

    expect(exported.localStorage).toEqual({
      safeSetting: { preserved: true },
      [STORAGE_KEYS.migrationBackup]: {
        localStorage: { safeBackupValue: true },
      },
    });
  });

  it('removes the retired conversation-index setting from version 5 installations', async () => {
    const memory = new MemoryStorage();
    memory.values[STORAGE_KEYS.schemaVersion] = 5;
    memory.values[STORAGE_KEYS.settings] = {
      ...structuredClone(DEFAULT_SETTINGS),
      features: {
        ...DEFAULT_SETTINGS.features,
        conversationIndex: true,
      },
    };

    const results = await new MigrationManager(new ExtensionLocalStorage(memory), database).run();

    expect(results).toHaveLength(6);
    expect(results).toEqual([
      expect.objectContaining({ version: 6, status: 'success' }),
      expect.objectContaining({ version: 7, status: 'success' }),
      expect.objectContaining({ version: 8, status: 'success' }),
      expect.objectContaining({ version: 9, status: 'success' }),
      expect.objectContaining({ version: 10, status: 'success' }),
      expect.objectContaining({ version: 11, status: 'success' }),
    ]);
    expect(memory.values[STORAGE_KEYS.schemaVersion]).toBe(11);
    expect(memory.values[STORAGE_KEYS.settings]).not.toHaveProperty('features.conversationIndex');
  });

  it('removes retired Cloud Sync settings and metadata from version 7 installations', async () => {
    const memory = new MemoryStorage();
    memory.values[STORAGE_KEYS.schemaVersion] = 7;
    memory.values[STORAGE_KEYS.settings] = {
      ...structuredClone(DEFAULT_SETTINGS),
      privacy: {
        ...DEFAULT_SETTINGS.privacy,
        cloudSyncEnabled: true,
      },
      lastSyncAt: 42,
    };
    memory.values['multiAiWorkspace.lastSyncMetadata'] = { etag: 'retired' };

    const results = await new MigrationManager(new ExtensionLocalStorage(memory), database).run();

    expect(results).toEqual([
      expect.objectContaining({ version: 8, status: 'success' }),
      expect.objectContaining({ version: 9, status: 'success' }),
      expect.objectContaining({ version: 10, status: 'success' }),
      expect.objectContaining({ version: 11, status: 'success' }),
    ]);
    expect(memory.values[STORAGE_KEYS.schemaVersion]).toBe(11);
    expect(memory.values[STORAGE_KEYS.settings]).not.toHaveProperty('privacy.cloudSyncEnabled');
    expect(memory.values[STORAGE_KEYS.settings]).not.toHaveProperty('lastSyncAt');
    expect(memory.values).not.toHaveProperty('multiAiWorkspace.lastSyncMetadata');
  });

  it('removes legacy message-star metadata from version 8 installations', async () => {
    const memory = new MemoryStorage();
    memory.values[STORAGE_KEYS.schemaVersion] = 8;
    const legacyRecord = {
      id: 'timeline:custom:anonymous:conversation:user%3A0',
      platformId: 'custom',
      accountScopeId: 'anonymous',
      conversationId: 'conversation',
      messageKey: 'user:0',
      messageId: null,
      starred: true,
      hierarchyLevel: 0,
      collapsed: false,
      note: null,
      observedAt: 1,
      updatedAt: 1,
    } as unknown as TimelineMetadataRecord;
    await database.put('timelineMetadata', legacyRecord);

    const results = await new MigrationManager(new ExtensionLocalStorage(memory), database).run();

    expect(results).toEqual([
      expect.objectContaining({ version: 9, status: 'success' }),
      expect.objectContaining({ version: 10, status: 'success' }),
      expect.objectContaining({ version: 11, status: 'success' }),
    ]);
    expect(memory.values[STORAGE_KEYS.schemaVersion]).toBe(11);
    const [migratedRecord] = await database.getAll('timelineMetadata');
    expect(migratedRecord).not.toHaveProperty('starred');
    expect(migratedRecord).toMatchObject({ note: null, hierarchyLevel: 0, collapsed: false });
  });

  it('removes retired custom websites without deleting built-in platform bindings', async () => {
    const memory = new MemoryStorage();
    memory.values[STORAGE_KEYS.schemaVersion] = 10;
    const baseBinding = {
      accountScopeId: 'anonymous',
      composerSelector: 'textarea',
      sendButtonSelector: null,
      messageContainerSelector: null,
      userMessageSelector: null,
      assistantMessageSelector: null,
      enabled: true,
      lastValidatedAt: null,
      createdAt: 1,
      updatedAt: 1,
    };
    await database.put('customSites', {
      ...baseBinding,
      id: 'binding:custom:https%3A%2F%2Fexample.com',
      platformId: 'custom',
      origin: 'https://example.com',
    });
    await database.put('customSites', {
      ...baseBinding,
      id: 'binding:gemini:https%3A%2F%2Fgemini.google.com',
      platformId: 'gemini',
      origin: 'https://gemini.google.com',
    });
    const removePermission = vi.spyOn(browser.permissions, 'remove');

    const results = await new MigrationManager(new ExtensionLocalStorage(memory), database).run();

    expect(results).toEqual([expect.objectContaining({ version: 11, status: 'success' })]);
    await expect(database.getAll('customSites')).resolves.toEqual([
      expect.objectContaining({ platformId: 'gemini', origin: 'https://gemini.google.com' }),
    ]);
    expect(removePermission).toHaveBeenCalledWith({ origins: ['https://example.com/*'] });
  });

  it('removes dynamic local and session provider secrets during a full reset', async () => {
    const memory = new MemoryStorage();
    const secretKey = `${STORAGE_KEYS.providerSecretPrefix}profile-reset`;
    memory.values[secretKey] = { ciphertext: 'encrypted-secret' };
    await database.put('apiProfiles', {
      id: 'profile-reset',
      providerType: 'openai',
      name: 'Reset test',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      baseUrlOrigin: 'https://api.openai.com',
      model: 'test-model',
      secretStorage: 'encrypted-local',
      hasSecret: true,
      createdAt: 1,
      updatedAt: 1,
    });
    const removedSessionKeys: string[] = [];

    await resetExtensionData(new ExtensionLocalStorage(memory), database, {
      async remove(keys) {
        removedSessionKeys.push(...(typeof keys === 'string' ? [keys] : keys));
      },
    });

    expect(memory.values).not.toHaveProperty(secretKey);
    expect(removedSessionKeys).toContain('providerSession.profile-reset');
    expect(removedSessionKeys).toContain('multiAiWorkspace.conversationBranch.chatgpt');
    expect(removedSessionKeys).toContain('multiAiWorkspace.conversationBranch.custom');
    await expect(database.getAll('apiProfiles')).resolves.toEqual([]);
  });
});
