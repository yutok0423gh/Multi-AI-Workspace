import { type DBSchema, type IDBPDatabase, openDB } from 'idb';

import {
  DATABASE_NAME,
  DATABASE_SCHEMA_VERSION,
  DATABASE_STORES,
  REMOVED_DATABASE_STORES,
  type DatabaseStoreName,
} from '../constants/storage';
import type {
  ApiProfileMetadataRecord,
  ConversationPinRecord,
  CustomSiteBindingRecord,
  DraftRecord,
  MetadataRecord,
  PromptFolderRecord,
  PromptRecord,
  TextHighlightRecord,
  TimelineMetadataRecord,
} from '../types/records';
import type { ConversationBranchRecord } from '../types/conversationBranch';

export interface StoreRecordMap {
  prompts: PromptRecord;
  promptFolders: PromptFolderRecord;
  drafts: DraftRecord;
  timelineMetadata: TimelineMetadataRecord;
  conversationPins: ConversationPinRecord;
  textHighlights: TextHighlightRecord;
  customSites: CustomSiteBindingRecord;
  apiProfiles: ApiProfileMetadataRecord;
  conversationBranches: ConversationBranchRecord;
  metadata: MetadataRecord;
}

interface MultiAiWorkspaceDatabase extends DBSchema {
  prompts: { key: string; value: PromptRecord };
  promptFolders: { key: string; value: PromptFolderRecord };
  drafts: { key: string; value: DraftRecord };
  timelineMetadata: { key: string; value: TimelineMetadataRecord };
  conversationPins: { key: string; value: ConversationPinRecord };
  textHighlights: { key: string; value: TextHighlightRecord };
  customSites: { key: string; value: CustomSiteBindingRecord };
  apiProfiles: { key: string; value: ApiProfileMetadataRecord };
  conversationBranches: { key: string; value: ConversationBranchRecord };
  metadata: { key: string; value: MetadataRecord };
}

export type DatabaseFactory = () => Promise<IDBPDatabase<MultiAiWorkspaceDatabase>>;

let sharedDatabase: Promise<IDBPDatabase<MultiAiWorkspaceDatabase>> | null = null;

interface WorkspaceDatabaseUpgradeTarget {
  objectStoreNames: { contains(name: string): boolean };
  deleteObjectStore(name: string): void;
  createObjectStore(name: string, options: { keyPath: string }): unknown;
}

export function upgradeWorkspaceSchema(database: WorkspaceDatabaseUpgradeTarget): void {
  for (const storeName of REMOVED_DATABASE_STORES) {
    if (database.objectStoreNames.contains(storeName)) {
      database.deleteObjectStore(storeName);
    }
  }
  for (const storeName of DATABASE_STORES) {
    if (!database.objectStoreNames.contains(storeName)) {
      database.createObjectStore(storeName, { keyPath: 'id' });
    }
  }
}

export async function openWorkspaceDatabase(): Promise<IDBPDatabase<MultiAiWorkspaceDatabase>> {
  sharedDatabase ??= openDB<MultiAiWorkspaceDatabase>(DATABASE_NAME, DATABASE_SCHEMA_VERSION, {
    upgrade(database) {
      upgradeWorkspaceSchema(database as unknown as WorkspaceDatabaseUpgradeTarget);
    },
  });
  return sharedDatabase;
}

export class WorkspaceDatabase {
  constructor(private readonly openDatabase: DatabaseFactory = openWorkspaceDatabase) {}

  async get<S extends DatabaseStoreName>(
    storeName: S,
    id: string,
  ): Promise<StoreRecordMap[S] | undefined> {
    const database = await this.openDatabase();
    return database.get(storeName, id) as Promise<StoreRecordMap[S] | undefined>;
  }

  async getAll<S extends DatabaseStoreName>(storeName: S): Promise<StoreRecordMap[S][]> {
    const database = await this.openDatabase();
    return database.getAll(storeName) as Promise<StoreRecordMap[S][]>;
  }

  async put<S extends DatabaseStoreName>(storeName: S, record: StoreRecordMap[S]): Promise<string> {
    const database = await this.openDatabase();
    return database.put(storeName, record) as Promise<string>;
  }

  async delete(storeName: DatabaseStoreName, id: string): Promise<void> {
    const database = await this.openDatabase();
    await database.delete(storeName, id);
  }

  async clear(storeName: DatabaseStoreName): Promise<void> {
    const database = await this.openDatabase();
    await database.clear(storeName);
  }

  async exportRawData(): Promise<Record<DatabaseStoreName, unknown[]>> {
    const database = await this.openDatabase();
    const entries = await Promise.all(
      DATABASE_STORES.map(
        async (storeName) => [storeName, await database.getAll(storeName)] as const,
      ),
    );
    return Object.fromEntries(entries) as Record<DatabaseStoreName, unknown[]>;
  }

  async reset(): Promise<void> {
    const database = await this.openDatabase();
    const transaction = database.transaction([...DATABASE_STORES], 'readwrite');
    await Promise.all(
      DATABASE_STORES.map((storeName) => transaction.objectStore(storeName).clear()),
    );
    await transaction.done;
  }
}
