import browser from 'webextension-polyfill';

import { DATABASE_SCHEMA_VERSION, STORAGE_KEYS } from '../constants/storage';
import { AppError } from '../errors/AppError';
import {
  DEFAULT_SETTINGS,
  ExtensionLocalStorage,
  SettingsRepository,
} from '../storage/localStorage';
import { WorkspaceDatabase } from '../storage/indexedDb';
import type { TimelineMetadataRecord } from '../types/records';
import { SUPPORTED_PLATFORMS } from '../constants/platforms';
import {
  CONVERSATION_BRANCH_ACTIVE_TAB_PREFIX,
  CONVERSATION_BRANCH_SESSION_PREFIX,
  CONVERSATION_BRANCH_TAB_SESSION_PREFIX,
  conversationBranchSessionKey,
} from '../utils/conversationBranch';

export interface MigrationResult {
  version: number;
  status: 'success' | 'failed';
  timestamp: number;
  errorCode?: string;
}

interface MigrationContext {
  localStorage: ExtensionLocalStorage;
  settings: SettingsRepository;
  database: WorkspaceDatabase;
}

interface Migration {
  version: number;
  run(context: MigrationContext): Promise<void>;
}

const LEGACY_CLOUD_SYNC_METADATA_KEY = 'multiAiWorkspace.lastSyncMetadata';

const migrations: readonly Migration[] = [
  {
    version: 1,
    async run({ settings }) {
      const current = await settings.get();
      await settings.set({ ...DEFAULT_SETTINGS, ...current, schemaVersion: 1 });
    },
  },
  {
    version: 2,
    async run({ settings }) {
      await settings.update({
        features: {
          promptRewrite: true,
          promptManager: true,
          draft: true,
          timeline: true,
          export: true,
        },
      });
    },
  },
  {
    version: 3,
    async run() {
      // IndexedDB applies the version 3 store set during the database upgrade.
    },
  },
  {
    version: 4,
    async run() {
      // IndexedDB creates the content-free text-highlight anchor store during the upgrade.
    },
  },
  {
    version: 5,
    async run() {
      // IndexedDB removes the retired conversation-folder stores during the version upgrade.
    },
  },
  {
    version: 6,
    async run({ settings }) {
      // The database upgrade removes the retired index store; rewriting validated settings
      // also drops its former feature toggle from installations upgraded in place.
      await settings.set(await settings.get());
    },
  },
  {
    version: 7,
    async run() {
      // IndexedDB creates the content-free, conversation-scoped pin anchor store.
    },
  },
  {
    version: 8,
    async run({ localStorage, settings }) {
      // Rewriting through the current schema removes retired Cloud Sync settings.
      await settings.set(await settings.get());
      await localStorage.remove(LEGACY_CLOUD_SYNC_METADATA_KEY);
    },
  },
  {
    version: 9,
    async run({ database }) {
      const records = await database.getAll('timelineMetadata');
      await Promise.all(
        records.map(async (record) => {
          if (!('starred' in record)) return;
          const legacyRecord = record as TimelineMetadataRecord & { starred?: unknown };
          const { starred, ...currentRecord } = legacyRecord;
          void starred;
          await database.put('timelineMetadata', currentRecord);
        }),
      );
    },
  },
  {
    version: 10,
    async run() {
      // IndexedDB creates the content-free conversation branch relation store.
    },
  },
  {
    version: 11,
    async run({ database }) {
      const [bindings, profiles] = await Promise.all([
        database.getAll('customSites'),
        database.getAll('apiProfiles'),
      ]);
      const retiredSites = bindings.filter((binding) => binding.platformId === 'custom');

      await Promise.all(retiredSites.map((site) => database.delete('customSites', site.id)));
      const providerOrigins = new Set(profiles.map((profile) => profile.baseUrlOrigin));
      const retiredOrigins = [...new Set(retiredSites.map((site) => site.origin))].filter(
        (origin) => !providerOrigins.has(origin),
      );
      if (retiredOrigins.length) {
        await browser.permissions.remove({
          origins: retiredOrigins.map((origin) => `${origin}/*`),
        });
      }
    },
  },
];

export class MigrationManager {
  private readonly settings: SettingsRepository;

  constructor(
    private readonly localStorage = new ExtensionLocalStorage(),
    private readonly database = new WorkspaceDatabase(),
  ) {
    this.settings = new SettingsRepository(localStorage);
  }

  async run(): Promise<MigrationResult[]> {
    const currentVersion =
      (await this.localStorage.getValue<number>(STORAGE_KEYS.schemaVersion)) ?? 0;
    const existingResults =
      (await this.localStorage.getValue<MigrationResult[]>(STORAGE_KEYS.migrationResults)) ?? [];

    if (currentVersion >= DATABASE_SCHEMA_VERSION) {
      return existingResults;
    }

    const localSnapshot = await this.localStorage.getAll();
    delete localSnapshot[STORAGE_KEYS.migrationBackup];
    const backup = {
      createdAt: Date.now(),
      sourceVersion: currentVersion,
      localStorage: localSnapshot,
      indexedDb: await this.database.exportRawData(),
    };
    await this.localStorage.setValues({ [STORAGE_KEYS.migrationBackup]: backup });

    const results = [...existingResults];
    for (const migration of migrations) {
      if (migration.version <= currentVersion) {
        continue;
      }

      try {
        await migration.run({
          localStorage: this.localStorage,
          settings: this.settings,
          database: this.database,
        });
        results.push({ version: migration.version, status: 'success', timestamp: Date.now() });
        await this.localStorage.setValues({
          [STORAGE_KEYS.schemaVersion]: migration.version,
          [STORAGE_KEYS.migrationResults]: results,
        });
      } catch (error) {
        const failure: MigrationResult = {
          version: migration.version,
          status: 'failed',
          timestamp: Date.now(),
          errorCode: error instanceof AppError ? error.code : 'MIGRATION_FAILED',
        };
        results.push(failure);
        await this.localStorage.setValues({ [STORAGE_KEYS.migrationResults]: results });
        throw new AppError(
          'MIGRATION_FAILED',
          `Storage migration ${migration.version} failed; the pre-migration backup was preserved.`,
          error,
        );
      }
    }

    return results;
  }
}

export async function resetExtensionData(
  localStorage = new ExtensionLocalStorage(),
  database = new WorkspaceDatabase(),
  sessionStorage:
    | (Pick<typeof browser.storage.local, 'remove'> &
        Partial<Pick<typeof browser.storage.local, 'get'>>)
    | undefined = browser.storage.session,
): Promise<void> {
  const [localValues, profiles] = await Promise.all([
    localStorage.getAll(),
    database.getAll('apiProfiles'),
  ]);
  const secretKeys = Object.keys(localValues).filter((key) =>
    key.startsWith(STORAGE_KEYS.providerSecretPrefix),
  );
  const profileIds = new Set([
    ...profiles.map((profile) => profile.id),
    ...secretKeys.map((key) => key.slice(STORAGE_KEYS.providerSecretPrefix.length)),
  ]);

  await database.reset();
  await localStorage.remove([
    ...new Set([...Object.values(STORAGE_KEYS), LEGACY_CLOUD_SYNC_METADATA_KEY, ...secretKeys]),
  ]);
  if (sessionStorage) {
    const sessionValues = sessionStorage.get ? await sessionStorage.get(null) : {};
    const dynamicBranchKeys = Object.keys(sessionValues).filter(
      (key) =>
        key.startsWith(CONVERSATION_BRANCH_SESSION_PREFIX) ||
        key.startsWith(CONVERSATION_BRANCH_TAB_SESSION_PREFIX) ||
        key.startsWith(CONVERSATION_BRANCH_ACTIVE_TAB_PREFIX),
    );
    await sessionStorage.remove([
      ...[...profileIds].map((id) => `providerSession.${id}`),
      ...SUPPORTED_PLATFORMS.map(({ id }) => conversationBranchSessionKey(id)),
      conversationBranchSessionKey('custom'),
      ...dynamicBranchKeys,
    ]);
  }
}

function removeProviderSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeProviderSecrets);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !key.startsWith(STORAGE_KEYS.providerSecretPrefix))
      .map(([key, nested]) => [key, removeProviderSecrets(nested)]),
  );
}

export async function exportRawExtensionData(
  localStorage = new ExtensionLocalStorage(),
  database = new WorkspaceDatabase(),
): Promise<{
  schemaVersion: number;
  exportedAt: number;
  localStorage: unknown;
  indexedDb: unknown;
}> {
  const localValues = removeProviderSecrets(await localStorage.getAll());
  return {
    schemaVersion: DATABASE_SCHEMA_VERSION,
    exportedAt: Date.now(),
    localStorage: localValues,
    indexedDb: await database.exportRawData(),
  };
}
