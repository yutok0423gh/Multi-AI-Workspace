import { afterEach, describe, expect, it } from 'vitest';

import { DATABASE_STORES, REMOVED_DATABASE_STORES } from '../../src/shared/constants/storage';
import { upgradeWorkspaceSchema, WorkspaceDatabase } from '../../src/shared/storage/indexedDb';

const database = new WorkspaceDatabase();

afterEach(async () => {
  await database.reset();
});

describe('WorkspaceDatabase', () => {
  it('deletes every retired store during schema upgrade', () => {
    const stores = new Set<string>([...DATABASE_STORES, ...REMOVED_DATABASE_STORES]);
    const deleted: string[] = [];

    upgradeWorkspaceSchema({
      objectStoreNames: { contains: (name) => stores.has(name) },
      deleteObjectStore: (name) => {
        deleted.push(name);
        stores.delete(name);
      },
      createObjectStore: (name) => void stores.add(name),
    });

    expect(stores).toEqual(new Set(DATABASE_STORES));
    expect(deleted).toContain('conversationIndex');
    expect(deleted).toContain('syncQueue');
    expect(deleted).toContain('favorites');
    expect(deleted).toContain('exportHistory');
  });

  it('stores and retrieves a scoped draft record', async () => {
    const draft = {
      id: 'chatgpt::anonymous::conversation-1',
      platformId: 'chatgpt' as const,
      accountScopeId: 'anonymous',
      conversationId: 'conversation-1',
      conversationUrl: 'https://chatgpt.com/c/conversation-1',
      content: 'Unsaved draft',
      selectionStart: 4,
      selectionEnd: 4,
      updatedAt: 1,
    };

    await database.put('drafts', draft);

    await expect(database.get('drafts', draft.id)).resolves.toEqual(draft);
    await expect(database.getAll('drafts')).resolves.toHaveLength(1);
  });

  it('exports every required object store', async () => {
    const exported = await database.exportRawData();
    expect(Object.keys(exported)).toEqual([
      'prompts',
      'promptFolders',
      'drafts',
      'timelineMetadata',
      'conversationPins',
      'textHighlights',
      'customSites',
      'apiProfiles',
      'conversationBranches',
      'metadata',
    ]);
  });
});
