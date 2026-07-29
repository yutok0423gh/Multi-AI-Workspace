import { expect, test, type Page } from '@playwright/test';
import { preview, type PreviewServer } from 'vite';

let previewServer: PreviewServer;

test.beforeAll(async () => {
  previewServer = await preview({
    configFile: false,
    build: { outDir: 'dist/chrome' },
    preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  });
});

test.afterAll(async () => {
  await previewServer.close();
});

async function installChromeApiMock(page: Page) {
  await page.addInitScript(() => {
    const snapshotKey = 'multi-ai-workspace-e2e-storage';
    const storedSnapshot = sessionStorage.getItem(snapshotKey);
    const values: Record<string, unknown> = storedSnapshot ? JSON.parse(storedSnapshot) : {};
    const persistValues = () => sessionStorage.setItem(snapshotKey, JSON.stringify(values));
    const listeners = new Set<(changes: Record<string, unknown>, area: string) => void>();
    const runtime = {
      id: 'multi-ai-workspace-test',
      getManifest: () => ({
        version: '0.1.0',
      }),
      getURL: (path: string) => `chrome-extension://multi-ai-workspace-test/${path}`,
      sendMessage(
        message: { type?: string },
        callback: (response: Record<string, unknown>) => void,
      ) {
        if (message.type === 'provider.list') {
          callback({ ok: true, profiles: [] });
          return;
        }
        callback({ ok: true, value: [] });
      },
    };
    const storage = {
      local: {
        get(
          keys: string | string[] | Record<string, unknown> | null,
          callback: (result: Record<string, unknown>) => void,
        ) {
          if (keys === null || keys === undefined) {
            callback(structuredClone(values));
          } else if (typeof keys === 'string') {
            callback(keys in values ? { [keys]: structuredClone(values[keys]) } : {});
          } else if (Array.isArray(keys)) {
            callback(
              Object.fromEntries(
                keys
                  .filter((key) => key in values)
                  .map((key) => [key, structuredClone(values[key])]),
              ),
            );
          } else {
            callback(
              Object.fromEntries(
                Object.entries(keys).map(([key, fallback]) => [
                  key,
                  key in values ? structuredClone(values[key]) : fallback,
                ]),
              ),
            );
          }
        },
        set(items: Record<string, unknown>, callback: () => void) {
          const changes = Object.fromEntries(
            Object.entries(items).map(([key, value]) => [
              key,
              { oldValue: values[key], newValue: structuredClone(value) },
            ]),
          );
          Object.assign(values, structuredClone(items));
          persistValues();
          for (const listener of listeners) {
            listener(changes, 'local');
          }
          callback();
        },
        remove(keys: string | string[], callback: () => void) {
          for (const key of typeof keys === 'string' ? [keys] : keys) {
            delete values[key];
          }
          persistValues();
          callback();
        },
      },
      onChanged: {
        addListener(listener: (changes: Record<string, unknown>, area: string) => void) {
          listeners.add(listener);
        },
        removeListener(listener: (changes: Record<string, unknown>, area: string) => void) {
          listeners.delete(listener);
        },
      },
    };
    const permissions = {
      getAll(callback: (result: { permissions: string[]; origins: string[] }) => void) {
        callback({ permissions: ['storage'], origins: [] });
      },
      request(_request: unknown, callback: (granted: boolean) => void) {
        callback(true);
      },
      remove(_request: unknown, callback: (removed: boolean) => void) {
        callback(true);
      },
      contains(_request: unknown, callback: (granted: boolean) => void) {
        callback(true);
      },
    };
    const tabs = {
      create(properties: { url: string }, callback: (tab: { id: number; url: string }) => void) {
        callback({ id: 1, url: properties.url });
      },
    };
    const chromeApi = (globalThis as unknown as { chrome: Record<string, unknown> }).chrome;
    Object.assign(chromeApi, { runtime, storage, permissions, tabs });
  });
}

async function installContentChromeApiMock(
  page: Page,
  options: { draftEnabled?: boolean; initialDraftContent?: string } = {},
) {
  await page.addInitScript(
    ({ draftEnabled, initialDraftContent }) => {
      (globalThis as unknown as { __mawBindingGetCount: number }).__mawBindingGetCount = 0;
      const databaseRecords: Record<string, Array<Record<string, unknown>>> = {
        drafts: [],
        conversationPins: [],
        textHighlights: [],
        conversationBranches: [],
      };
      let branchGroup: Record<string, unknown> | null = null;
      (
        globalThis as unknown as {
          __mawDatabaseRecords: Record<string, Array<Record<string, unknown>>>;
        }
      ).__mawDatabaseRecords = databaseRecords;
      const listeners = new Set<(changes: Record<string, unknown>, area: string) => void>();
      const settings = {
        schemaVersion: 1,
        locale: 'en',
        logLevel: 'warn',
        privacy: {
          onboardingComplete: true,
          includeConversationContext: false,
        },
        features: {
          foundationPanel: true,
          promptRewrite: true,
          promptManager: true,
          draft: draftEnabled,
          timeline: true,
          export: true,
        },
        platformPermissions: {},
        input: { sendShortcut: 'platform', preventAutoScroll: false },
        conversationExport: { format: 'markdown-standard' },
        markup: {
          mermaidEnabled: true,
          mermaidDefaultView: 'diagram',
          formulaCopyEnabled: true,
          formulaCopyFormat: 'latex',
        },
        ui: {
          launcherPosition: 'bottom-right',
          fontScale: 1,
          panelWidth: 'standard',
          visualEffect: 'off',
        },
        notifications: { completionEnabled: false },
      };
      const platformByHostname: Record<string, string> = {
        'chatgpt.com': 'chatgpt',
        'claude.ai': 'claude',
        'gemini.google.com': 'gemini',
        'chat.deepseek.com': 'deepseek',
        'grok.com': 'grok',
        'www.kimi.com': 'kimi',
      };
      const testPlatformId = platformByHostname[location.hostname] ?? 'custom';
      const testOrigin = location.origin;
      const binding = {
        id: `binding:${testPlatformId}:${testOrigin}`,
        origin: testOrigin,
        platformId: testPlatformId,
        accountScopeId: 'anonymous',
        composerSelector: '#composer',
        sendButtonSelector: '#send',
        messageContainerSelector: '#messages',
        userMessageSelector: '.user-message',
        assistantMessageSelector: '.assistant-message',
        enabled: true,
        bindingSource: 'manual',
        automaticBindingVersion: null,
        lastValidatedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      (
        globalThis as unknown as {
          __mawSetVisualEffect: (
            effect: 'off' | 'snow' | 'sakura' | 'rain' | 'mushroom' | 'dandelion',
          ) => void;
        }
      ).__mawSetVisualEffect = (effect) => {
        const oldValue = structuredClone(settings);
        Object.assign(settings.ui, { visualEffect: effect });
        const newValue = structuredClone(settings);
        for (const listener of listeners) {
          listener({ 'multiAiWorkspace.settings': { oldValue, newValue } }, 'local');
        }
      };
      (
        globalThis as unknown as {
          __mawSetPreventAutoScroll: (enabled: boolean) => void;
        }
      ).__mawSetPreventAutoScroll = (enabled) => {
        const oldValue = structuredClone(settings);
        Object.assign(settings.input, { preventAutoScroll: enabled });
        const newValue = structuredClone(settings);
        for (const listener of listeners) {
          listener({ 'multiAiWorkspace.settings': { oldValue, newValue } }, 'local');
        }
      };
      (
        globalThis as unknown as {
          __mawSetConversationExportFormat: (
            format:
              | 'markdown-standard'
              | 'markdown-simple'
              | 'json-standard'
              | 'json-simple'
              | 'html-simple',
          ) => void;
        }
      ).__mawSetConversationExportFormat = (format) => {
        const oldValue = structuredClone(settings);
        Object.assign(settings.conversationExport, { format });
        const newValue = structuredClone(settings);
        for (const listener of listeners) {
          listener({ 'multiAiWorkspace.settings': { oldValue, newValue } }, 'local');
        }
      };
      const runtime = {
        id: 'multi-ai-workspace-test',
        getManifest: () => ({ version: '1.0.15' }),
        getURL: (path: string) => `http://127.0.0.1:4173/${path}`,
        sendMessage(
          message: {
            type?: string;
            store?: string;
            id?: string;
            record?: Record<string, unknown>;
            transfer?: Record<string, unknown>;
            preferredMethod?: 'native' | 'manual';
            branchId?: string;
            patch?: {
              features?: Partial<(typeof settings)['features']>;
              ui?: Partial<(typeof settings)['ui']>;
            };
          },
          callback: (response: Record<string, unknown>) => void,
        ) {
          if (message.type === 'settings.get') {
            callback({ ok: true, settings });
            return;
          }
          if (message.type === 'settings.update') {
            const oldValue = structuredClone(settings);
            if (message.patch?.features) Object.assign(settings.features, message.patch.features);
            if (message.patch?.ui) Object.assign(settings.ui, message.patch.ui);
            const newValue = structuredClone(settings);
            for (const listener of listeners) {
              listener({ 'multiAiWorkspace.settings': { oldValue, newValue } }, 'local');
            }
            callback({ ok: true, settings: newValue });
            return;
          }
          if (message.type === 'binding.get') {
            const state = globalThis as unknown as { __mawBindingGetCount: number };
            state.__mawBindingGetCount += 1;
            callback({ ok: true, binding });
            return;
          }
          if (message.type === 'binding.save') {
            callback({ ok: true, binding });
            return;
          }
          if (message.type === 'database.get' && message.store && message.id) {
            const records = (databaseRecords[message.store] ??= []);
            let record = records.find((candidate) => candidate.id === message.id);
            if (!record && message.store === 'drafts' && initialDraftContent) {
              record = {
                id: message.id,
                platformId: testPlatformId,
                accountScopeId: 'anonymous',
                conversationId: location.pathname,
                conversationUrl: location.href,
                content: initialDraftContent,
                selectionStart: initialDraftContent.length,
                selectionEnd: initialDraftContent.length,
                updatedAt: Date.now(),
              };
              records.push(record);
            }
            callback({ ok: true, value: structuredClone(record) });
            return;
          }
          if (message.type === 'database.list') {
            callback({
              ok: true,
              value: structuredClone(databaseRecords[message.store ?? ''] ?? []),
            });
            return;
          }
          if (message.type === 'database.put' && message.store) {
            const records = (databaseRecords[message.store] ??= []);
            const index = records.findIndex((record) => record.id === message.record?.id);
            if (index >= 0) records[index] = structuredClone(message.record ?? {});
            else records.push(structuredClone(message.record ?? {}));
            callback({ ok: true, value: message.record });
            return;
          }
          if (message.type === 'database.delete' && message.store) {
            const records = (databaseRecords[message.store] ??= []);
            const index = records.findIndex((record) => record.id === message.id);
            if (index >= 0) records.splice(index, 1);
            callback({ ok: true });
            return;
          }
          if (message.type === 'provider.list') {
            callback({ ok: true, profiles: [] });
            return;
          }
          if (message.type === 'conversationBranch.observe') {
            callback({ ok: true, value: branchGroup });
            return;
          }
          if (message.type === 'conversationBranch.prepare' && message.transfer) {
            const now = Date.now();
            const original = {
              id: 'original-e2e',
              groupId: 'group-e2e',
              platformId: message.transfer.platformId,
              accountScopeId: message.transfer.accountScopeId,
              parentBranchId: null,
              conversationId: message.transfer.sourceConversationId,
              url: message.transfer.sourceUrl,
              title: message.transfer.sourceTitle,
              name: message.transfer.sourceTitle || 'Original conversation',
              method: 'original',
              state: 'ready',
              branchPointMessageKey: null,
              branchPointOrder: null,
              branchPointRole: null,
              model: message.transfer.model,
              createdAt: now,
              updatedAt: now,
            };
            const branch = {
              ...original,
              id: 'branch-e2e',
              parentBranchId: original.id,
              conversationId: null,
              url: null,
              title: null,
              name: 'Branch 1',
              method: message.preferredMethod ?? 'manual',
              state: 'creating',
              branchPointMessageKey: message.transfer.branchPointMessageKey,
              branchPointOrder: message.transfer.branchPointOrder,
              branchPointRole: message.transfer.branchPointRole,
              createdAt: now + 1,
              updatedAt: now + 1,
            };
            branchGroup = {
              groupId: 'group-e2e',
              currentBranchId: branch.id,
              branches: [original, branch],
            };
            databaseRecords.conversationBranches = [original, branch];
            callback({ ok: true, value: { branch, group: branchGroup } });
            return;
          }
          if (message.type === 'conversationBranch.open') {
            callback({ ok: true, value: { branchId: message.branchId } });
            return;
          }
          callback({ ok: true, value: [] });
        },
      };
      const storage = {
        local: {
          get(
            keys: string | string[] | Record<string, unknown> | null,
            callback: (result: Record<string, unknown>) => void,
          ) {
            if (keys === null || keys === undefined)
              callback({ 'multiAiWorkspace.settings': settings });
            else if (keys === 'multiAiWorkspace.settings') {
              callback({ 'multiAiWorkspace.settings': settings });
            } else callback({});
          },
          set(_items: Record<string, unknown>, callback: () => void) {
            callback();
          },
          remove(_keys: string | string[], callback: () => void) {
            callback();
          },
        },
        onChanged: {
          addListener(listener: (changes: Record<string, unknown>, area: string) => void) {
            listeners.add(listener);
          },
          removeListener(listener: (changes: Record<string, unknown>, area: string) => void) {
            listeners.delete(listener);
          },
        },
      };
      const chromeApi = (globalThis as unknown as { chrome: Record<string, unknown> }).chrome;
      Object.assign(chromeApi, { runtime, storage });
    },
    {
      draftEnabled: options.draftEnabled ?? false,
      initialDraftContent: options.initialDraftContent,
    },
  );
}

async function selectHighlightFixtureText(page: Page, selector = '#highlight-target') {
  await page.evaluate((targetSelector) => {
    const target = document.querySelector(targetSelector);
    if (!target) throw new Error('Highlight fixture target is missing.');
    const range = document.createRange();
    range.selectNodeContents(target);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  }, selector);
}

async function selectHighlightFixtureRange(page: Page, startSelector: string, endSelector: string) {
  await page.evaluate(
    ({ startSelector: rangeStartSelector, endSelector: rangeEndSelector }) => {
      const start = document.querySelector(rangeStartSelector);
      const end = document.querySelector(rangeEndSelector);
      if (!start || !end) throw new Error('Highlight range fixture target is missing.');
      const range = document.createRange();
      range.setStart(start, 0);
      range.setEnd(end, end.childNodes.length);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      end.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    },
    { startSelector, endSelector },
  );
}

test('local fixture keeps the host page interactive', async ({ page }) => {
  await page.setContent(`
    <main>
      <label for="host-input">Host input</label>
      <input id="host-input" />
      <button id="host-button">Host action</button>
    </main>
  `);
  await page.getByLabel('Host input').fill('still interactive');
  await page.getByRole('button', { name: 'Host action' }).click();
  await expect(page.getByLabel('Host input')).toHaveValue('still interactive');
});

test('production popup exposes live background effects and settings after privacy onboarding', async ({
  page,
}) => {
  await installChromeApiMock(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  const response = await page.goto('http://127.0.0.1:4173/popup.html');
  expect(response?.status()).toBe(200);
  await page.waitForTimeout(100);
  expect(errors).toEqual([]);
  const brandIcon = page.locator('svg.brand-mark[data-maw-brand-icon="true"]');
  await expect(brandIcon).toBeVisible();
  await expect(brandIcon.locator('[data-letter="m"]')).toHaveCount(1);
  await expect(brandIcon.locator('[data-letter="w"]')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Privacy first' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  const backgroundEffects = page.getByRole('radiogroup', { name: 'Background effects' });
  await expect(backgroundEffects).toBeVisible();
  await expect(backgroundEffects.getByRole('radio')).toHaveCount(6);
  await expect(backgroundEffects.getByRole('radio', { name: 'Tiny mushrooms' })).toBeVisible();
  await expect(backgroundEffects.getByRole('radio', { name: 'Dandelion' })).toBeVisible();
  const snow = backgroundEffects.getByRole('radio', { name: 'Snow' });
  await expect(snow).toHaveAttribute('aria-checked', 'false');
  await snow.click();
  await expect(snow).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await expect(
    page
      .getByRole('radiogroup', { name: 'Background effects' })
      .getByRole('radio', { name: 'Snow' }),
  ).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('heading', { name: 'Layout', exact: true })).toBeVisible();
  await expect(page.getByText(/Show a small isolated launcher/i)).toHaveCount(0);
  const launcherSwitch = page.getByRole('switch', { name: 'Page status launcher' });
  await expect(launcherSwitch).toHaveAttribute('aria-checked', 'true');
  await launcherSwitch.click();
  await expect(launcherSwitch).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByText('Platform readiness')).toHaveCount(0);
  await expect(page.getByText('ChatGPT')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Page status launcher' })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  expect(errors).toEqual([]);
});

test('production options applies an implemented setting immediately', async ({ page }) => {
  await installChromeApiMock(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  const response = await page.goto('http://127.0.0.1:4173/options.html#layout');
  expect(response?.status()).toBe(200);
  await page.waitForTimeout(100);
  expect(errors).toEqual([]);
  await expect(page.getByRole('heading', { name: 'Layout', level: 1 })).toBeVisible();
  const promptManagerEntry = page
    .locator('.category-nav')
    .getByRole('button', { name: 'Prompt Manager' });
  await expect(promptManagerEntry).toBeVisible();
  const launcherSwitch = page.getByRole('switch', { name: 'Page status launcher' });
  await expect(launcherSwitch).toHaveAttribute('aria-checked', 'true');
  await launcherSwitch.click();
  await expect(launcherSwitch).toHaveAttribute('aria-checked', 'false');
  await page.getByLabel('Launcher position').selectOption('bottom-left');
  await expect(page.getByLabel('Launcher position')).toHaveValue('bottom-left');
  await promptManagerEntry.click();
  await expect(page.getByRole('heading', { name: 'Prompt Manager', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'New prompt', level: 2 })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Prompt Manager is editable from full settings and its direct shortcut route', async ({
  page,
}) => {
  await installChromeApiMock(page);
  const response = await page.goto('http://127.0.0.1:4173/options.html#prompt-manager');
  expect(response?.status()).toBe(200);

  await expect(page.getByRole('heading', { name: 'Prompt Manager', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'New prompt', level: 2 })).toBeVisible();

  await page.getByLabel('Title').fill('Research brief');
  await page.getByLabel('Tags (comma separated)').fill('research, concise');
  await page.getByLabel('Description').fill('Creates a short research brief.');
  await page.getByLabel('Prompt content').fill('Summarize {{selection}} in three points.');
  await page.getByRole('button', { name: 'Save prompt' }).click();
  await expect(page.getByText('Prompt saved.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Research brief', level: 2 })).toBeVisible();

  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Edit prompt', level: 2 })).toBeVisible();
  await expect(page.getByLabel('Prompt content')).toHaveValue(
    'Summarize {{selection}} in three points.',
  );
  await page.getByLabel('Prompt content').fill('Summarize {{selection}} in five points.');
  await page.getByRole('button', { name: 'Save prompt' }).click();
  await expect(page.locator('.prompt-preview')).toHaveText(
    'Summarize {{selection}} in five points.',
  );
});

test('About lists every built-in website and the installation boundaries', async ({ page }) => {
  await installChromeApiMock(page);
  const response = await page.goto('http://127.0.0.1:4173/options.html#about');
  expect(response?.status()).toBe(200);

  await expect(page.getByRole('heading', { name: 'About', level: 1 })).toBeVisible();
  await expect(page.locator('.about-hero svg[data-maw-brand-icon="true"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Supported websites' })).toBeVisible();
  await expect(page.locator('.about-platform-card')).toHaveCount(6);
  for (const [name, hostname] of [
    ['ChatGPT', 'chatgpt.com'],
    ['Claude', 'claude.ai'],
    ['Gemini', 'gemini.google.com'],
    ['DeepSeek', 'chat.deepseek.com'],
    ['Grok', 'grok.com'],
    ['Kimi', 'www.kimi.com'],
  ]) {
    const platform = page.getByRole('link', { name: new RegExp(name) });
    await expect(platform).toBeVisible();
    await expect(platform).toHaveAttribute('href', `https://${hostname}/`);
  }
  await expect(
    page.getByText('Prompt navigator is available when conversation messages are detected.'),
  ).toHaveCount(3);
  await expect(
    page.getByText('The extension timeline is not provided on this platform.'),
  ).toHaveCount(3);
  await expect(page.getByText('Chrome Manifest V3 and Firefox Manifest V3')).toBeVisible();
  await expect(
    page.getByText('English, Simplified Chinese, and Traditional Chinese'),
  ).toBeVisible();
  await expect(page.getByText(/raw data export happens only when you request it/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Custom Websites' })).toHaveCount(0);
});

test('Markdown settings expose working Mermaid and formula controls', async ({ page }) => {
  await installChromeApiMock(page);
  const response = await page.goto('http://127.0.0.1:4173/options.html#markdown');
  expect(response?.status()).toBe(200);

  await expect(
    page.getByRole('heading', { name: 'Markdown / Mermaid / Formula', level: 1 }),
  ).toBeVisible();
  const mermaidSwitch = page.getByRole('switch', { name: 'Mermaid diagram tools' });
  const formulaSwitch = page.getByRole('switch', { name: 'Formula copy tools' });
  await expect(mermaidSwitch).toHaveAttribute('aria-checked', 'true');
  await expect(formulaSwitch).toHaveAttribute('aria-checked', 'true');
  await page.getByLabel('Default Mermaid view').selectOption('source');
  await expect(page.getByLabel('Default Mermaid view')).toHaveValue('source');
  await page.getByLabel('Preferred formula format').selectOption('notion');
  await expect(page.getByLabel('Preferred formula format')).toHaveValue('notion');
  const settingCards = page.locator('.setting-card');
  await expect(settingCards.getByText('Default', { exact: true })).toHaveCount(0);
  await expect(settingCards.getByText('Current', { exact: true })).toHaveCount(0);
  await expect(settingCards.getByText('Applies to', { exact: true })).toHaveCount(0);
  await expect(settingCards.getByText('Permission', { exact: true })).toHaveCount(0);
  await expect(settingCards.getByText('Experimental', { exact: true })).toHaveCount(0);
  await expect(settingCards.getByRole('button', { name: 'Reset', exact: true })).toHaveCount(0);
  await expect(settingCards.getByText(/Recognize explicit Mermaid code blocks/i)).toHaveCount(0);
  await expect(page.getByText(/no separate setting/i)).toHaveCount(0);
});

test('conversation export settings expose and persist all five formats', async ({ page }) => {
  await installChromeApiMock(page);
  const response = await page.goto('http://127.0.0.1:4173/options.html#export');
  expect(response?.status()).toBe(200);

  await expect(page.getByRole('heading', { name: 'Export', level: 1 })).toBeVisible();
  const formats = [
    'Standard Markdown',
    'Simplified Markdown',
    'Standard JSON',
    'Simplified JSON',
    'HTML (simplified)',
  ];
  for (const format of formats) {
    const escapedFormat = format.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await expect(page.getByRole('radio', { name: new RegExp(`^${escapedFormat}`) })).toBeVisible();
  }
  await page.getByRole('radio', { name: /^Simplified JSON/ }).click();
  await expect(page.getByRole('radio', { name: /^Simplified JSON/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  await page.reload();
  await expect(page.getByRole('radio', { name: /^Simplified JSON/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

test('default models persist from the canonical settings page', async ({ page }) => {
  await installChromeApiMock(page);
  const response = await page.goto('http://127.0.0.1:4173/options.html#experimental');
  expect(response?.status()).toBe(200);

  await expect(page.getByRole('heading', { name: 'Default model for new chats' })).toBeVisible();
  const geminiModel = page.getByLabel('Gemini default model');
  await geminiModel.fill('Gemini Test Model');
  await geminiModel.press('Tab');
  await expect(geminiModel).toHaveValue('Gemini Test Model');
  await page.reload();
  await expect(page.getByLabel('Gemini default model')).toHaveValue('Gemini Test Model');
});

test('the retired Cloud Sync route and controls are absent', async ({ page }) => {
  await installChromeApiMock(page);
  const response = await page.goto('http://127.0.0.1:4173/options.html#cloud-sync');
  expect(response?.status()).toBe(200);

  await expect(page.getByRole('heading', { name: 'Layout', level: 1 })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Cloud Sync' })).toHaveCount(0);
  await expect(page.getByText(/Google Drive manual sync/i)).toHaveCount(0);
});

test('Visual Effects settings use an adaptive six-way control', async ({ page }) => {
  await installChromeApiMock(page);
  const response = await page.goto('http://127.0.0.1:4173/options.html#experimental');
  expect(response?.status()).toBe(200);

  await expect(page.getByRole('heading', { name: 'Visual effects' })).toBeVisible();
  const control = page.getByRole('radiogroup', { name: 'Visual effects' });
  expect(
    await control.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ')),
  ).toHaveLength(6);
  const sakura = page.getByRole('radio', { name: /Sakura/ });
  await expect(sakura).toHaveAttribute('aria-checked', 'false');
  await sakura.click();
  await expect(sakura).toHaveAttribute('aria-checked', 'true');
  const mushroom = page.getByRole('radio', { name: /Tiny mushrooms/ });
  await mushroom.click();
  await expect(mushroom).toHaveAttribute('aria-checked', 'true');
  const dandelion = page.getByRole('radio', { name: /Dandelion/ });
  await dandelion.click();
  await expect(dandelion).toHaveAttribute('aria-checked', 'true');

  await page.setViewportSize({ width: 600, height: 900 });
  expect(
    await control.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ')),
  ).toHaveLength(2);
});

test('production settings switches between English and Simplified Chinese', async ({ page }) => {
  await installChromeApiMock(page);
  const response = await page.goto('http://127.0.0.1:4173/options.html#prompt-rewrite');
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { name: 'Prompt Rewrite / AI Provider', level: 1 }),
  ).toBeVisible();
  await page.getByRole('button', { name: '中文' }).first().click();
  await expect(
    page.getByRole('heading', { name: 'Prompt Rewrite / AI Provider', level: 1 }),
  ).toBeVisible();
  await expect(page.getByText('原始 Prompt')).toBeVisible();
  await page.getByRole('button', { name: 'EN' }).first().click();
  await expect(page.getByText('Original prompt')).toBeVisible();
});

test('empty provider state links to quick provider templates', async ({ page }) => {
  await installChromeApiMock(page);
  const response = await page.goto('http://127.0.0.1:4173/options.html#prompt-rewrite');
  expect(response?.status()).toBe(200);

  await expect(page.getByRole('heading', { name: 'No AI provider configured' })).toBeVisible();
  await expect(
    page.getByRole('navigation').getByRole('button', { name: 'AI Provider', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Configure provider' }).click();
  await expect(page.locator('#provider-settings')).toBeFocused();
  await expect(page).toHaveURL(/#prompt-rewrite$/);
  await expect(
    page.getByRole('heading', { name: 'AI Provider', exact: true, level: 2 }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Quick provider templates' })).toBeVisible();
  await page.getByRole('button', { name: 'deepseek', exact: true }).click();
  await expect(page.getByLabel('Provider type')).toHaveValue('deepseek');
  await expect(page.getByLabel('API endpoint')).toHaveValue(
    'https://api.deepseek.com/chat/completions',
  );

  await page.goto('http://127.0.0.1:4173/options.html#ai-provider');
  await expect(
    page.getByRole('heading', { name: 'Prompt Rewrite / AI Provider', level: 1 }),
  ).toBeVisible();
  await expect(page).toHaveURL(/#prompt-rewrite$/);
  await expect(page.locator('#provider-settings')).toBeFocused();
});

test('retired conversation-index links return to Layout without exposing the removed feature', async ({
  page,
}) => {
  await installChromeApiMock(page);
  const response = await page.goto('http://127.0.0.1:4173/options.html#conversation-index');
  expect(response?.status()).toBe(200);

  await expect(page).toHaveURL(/#layout$/);
  await expect(page.getByRole('heading', { name: 'Layout', level: 1 })).toBeVisible();
  await expect(page.getByRole('navigation').getByText('Conversation Index')).toHaveCount(0);
  await expect(page.getByText('Automatic local conversation index')).toHaveCount(0);
});

test('retired favorites links return to Layout without exposing message favorites', async ({
  page,
}) => {
  await installChromeApiMock(page);
  const response = await page.goto('http://127.0.0.1:4173/options.html#favorites');
  expect(response?.status()).toBe(200);

  await expect(page).toHaveURL(/#layout$/);
  await expect(page.getByRole('heading', { name: 'Layout', level: 1 })).toBeVisible();
  await expect(page.getByRole('navigation').getByText('Favorites', { exact: true })).toHaveCount(0);
  await expect(page.getByPlaceholder('Search favorite messages')).toHaveCount(0);
});

test('retired platform-specific links return to Layout without exposing the empty category', async ({
  page,
}) => {
  await installChromeApiMock(page);
  const response = await page.goto('http://127.0.0.1:4173/options.html#platform-specific');
  expect(response?.status()).toBe(200);

  await expect(page).toHaveURL(/#layout$/);
  await expect(page.getByRole('heading', { name: 'Layout', level: 1 })).toBeVisible();
  await expect(
    page.getByRole('navigation').getByText('Platform-specific', { exact: true }),
  ).toHaveCount(0);
});

test('retired custom-website links return to Layout without exposing site authorization', async ({
  page,
}) => {
  await installChromeApiMock(page);
  const response = await page.goto('http://127.0.0.1:4173/options.html#custom-websites');
  expect(response?.status()).toBe(200);

  await expect(page).toHaveURL(/#layout$/);
  await expect(page.getByRole('heading', { name: 'Layout', level: 1 })).toBeVisible();
  await expect(page.getByText('Custom Websites', { exact: true })).toHaveCount(0);
  await expect(page.getByPlaceholder('https://example.com')).toHaveCount(0);
});

test('prompt rail keeps one visible dot per Prompt in an internal scroll container', async ({
  page,
}) => {
  await installContentChromeApiMock(page);
  await page.route('**/internal-scroll-fixture.html', async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html>
        <html><head><meta charset="utf-8"><title>Internal scroll fixture</title><style>
          body { margin: 0; overflow: hidden; font: 18px sans-serif; }
          #messages { height: 100vh; overflow-y: auto; }
          article { min-height: 520px; padding: 40px; }
        </style></head><body>
          <main id="messages">
            <article class="user-message">Question one</article>
            <article class="user-message">Question two</article>
            <article class="user-message">Question three</article>
            <article class="user-message">Question four</article>
            <article class="user-message">Question five</article>
          </main>
          <textarea id="composer" aria-label="Composer"></textarea>
          <button id="send">Send</button>
          <script src="/content.js"></script>
        </body></html>`,
    });
  });

  await page.goto('http://127.0.0.1:4173/internal-scroll-fixture.html');
  const promptMarks = page.locator('.maw-message-jump');
  await expect(promptMarks).toHaveCount(5);
  const positions = await promptMarks.evaluateAll((elements) =>
    elements.map((element) => Math.round(element.getBoundingClientRect().top)),
  );
  expect(new Set(positions).size).toBe(5);
  await expect(page.locator('.maw-prompt-card')).toBeHidden();
  await page.locator('.maw-prompt-navigator').hover();
  await expect(page.locator('.maw-prompt-list button')).toHaveCount(5);
  await expect(page.locator('.maw-prompt-card')).toBeVisible();
  await page.evaluate(() => {
    (
      globalThis as unknown as {
        __mawSetPreventAutoScroll: (enabled: boolean) => void;
      }
    ).__mawSetPreventAutoScroll(true);
  });
  await promptMarks.last().click();
  await expect
    .poll(() => page.locator('#messages').evaluate((element) => element.scrollTop))
    .toBeGreaterThan(1_500);
});

test('ChatGPT adds a Share-adjacent download button that uses the configured format', async ({
  page,
}) => {
  await installContentChromeApiMock(page);
  await page.addInitScript(() => {
    (
      globalThis as unknown as {
        __mawDownloads: Array<{ filename: string; content: string }>;
      }
    ).__mawDownloads = [];
    HTMLAnchorElement.prototype.click = function () {
      const downloads = (
        globalThis as unknown as {
          __mawDownloads: Array<{ filename: string; content: string }>;
        }
      ).__mawDownloads;
      const record = { filename: this.download, content: '' };
      downloads.push(record);
      void fetch(this.href)
        .then((response) => response.text())
        .then((content) => {
          record.content = content;
        });
    };
  });
  const contentScript = await fetch('http://127.0.0.1:4173/content.js').then((response) =>
    response.text(),
  );
  await page.route('https://chatgpt.com/content.js', async (route) => {
    await route.fulfill({ contentType: 'text/javascript', body: contentScript });
  });
  await page.route('https://chatgpt.com/c/export-fixture', async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html>
        <html><head><meta charset="utf-8"><title>ChatGPT export fixture</title></head><body>
          <header><button type="button" aria-label="Share conversation">Share</button></header>
          <main id="messages">
            <article class="user-message">User request</article>
            <article class="assistant-message">
              <p data-content-type="reasoning">Intermediate narration</p>
              <section data-testid="code-interpreter"><pre><code>print(42)</code></pre></section>
              <p>Final answer</p>
            </article>
          </main>
          <textarea id="composer" aria-label="Message ChatGPT"></textarea>
          <button id="send">Send</button>
          <script src="/content.js"></script>
        </body></html>`,
    });
  });

  await page.goto('https://chatgpt.com/c/export-fixture');
  await expect(page.getByRole('button', { name: 'Download conversation' })).toBeVisible();
  await page.evaluate(() => {
    (
      globalThis as unknown as {
        __mawSetConversationExportFormat: (format: 'json-simple') => void;
      }
    ).__mawSetConversationExportFormat('json-simple');
  });
  const downloadButton = page.getByRole('button', { name: 'Download conversation' });
  await expect(downloadButton).toBeVisible();
  await downloadButton.click();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const download = (
          globalThis as unknown as {
            __mawDownloads: Array<{ filename: string; content: string }>;
          }
        ).__mawDownloads[0];
        return download?.content ? download : null;
      }),
    )
    .not.toBeNull();
  const download = await page.evaluate(
    () =>
      (
        globalThis as unknown as {
          __mawDownloads: Array<{ filename: string; content: string }>;
        }
      ).__mawDownloads[0],
  );
  expect(download.filename).toMatch(/\.json$/);
  expect(download.content).toContain('User request');
  expect(download.content).toContain('Final answer');
  expect(download.content).not.toContain('Intermediate narration');
  expect(download.content).not.toContain('print(42)');
});

test('prevent auto-scroll preserves a user-selected reading position during new content', async ({
  page,
}) => {
  await installContentChromeApiMock(page);
  await page.route('**/auto-scroll-fixture.html', async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html>
        <html><head><meta charset="utf-8"><title>Auto-scroll fixture</title><style>
          body { margin: 0; overflow: hidden; font: 18px sans-serif; }
          #messages { height: 300px; overflow-y: auto; }
          article { min-height: 400px; padding: 20px; }
        </style></head><body>
          <main id="messages">
            <article class="user-message">Question one</article>
            <article class="assistant-message">Answer one</article>
            <article class="user-message">Question two</article>
            <article class="assistant-message" id="streaming-answer">Answer two</article>
          </main>
          <textarea id="composer" aria-label="Composer"></textarea>
          <button id="send">Send</button>
          <script src="/content.js"></script>
        </body></html>`,
    });
  });

  await page.goto('http://127.0.0.1:4173/auto-scroll-fixture.html');
  await expect(page.locator('.maw-prompt-navigator')).toBeVisible();
  await page.evaluate(() => {
    (
      globalThis as unknown as {
        __mawSetPreventAutoScroll: (enabled: boolean) => void;
      }
    ).__mawSetPreventAutoScroll(true);
  });
  await page.waitForTimeout(100);

  await page.locator('#messages').evaluate((element) => {
    const container = element as HTMLElement;
    container.dispatchEvent(new WheelEvent('wheel', { bubbles: true }));
    container.scrollTop = 360;
    container.dispatchEvent(new Event('scroll'));
    document.querySelector('#streaming-answer')?.append(' streamed token');
    container.scrollTop = 1_100;
  });

  await expect
    .poll(() => page.locator('#messages').evaluate((element) => element.scrollTop))
    .toBe(360);
});

test('Kimi timeline jump scrolls its internal conversation viewport', async ({ page }) => {
  await installContentChromeApiMock(page);
  const contentScript = await fetch('http://127.0.0.1:4173/content.js').then((response) =>
    response.text(),
  );
  await page.route('https://www.kimi.com/content.js', async (route) => {
    await route.fulfill({ contentType: 'text/javascript', body: contentScript });
  });
  await page.route('https://www.kimi.com/chat/timeline-jump-fixture', async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html>
        <html><head><meta charset="utf-8"><title>Kimi timeline fixture</title><style>
          body { margin: 0; overflow: hidden; font: 18px sans-serif; }
          #messages { height: 100vh; overflow-y: auto; }
          article { min-height: 520px; padding: 40px; }
        </style></head><body>
          <main id="messages">
            <article class="user-message">Kimi question one</article>
            <article class="assistant-message">Kimi answer one</article>
            <article class="user-message">Kimi question two</article>
            <article class="assistant-message">Kimi answer two</article>
            <article class="user-message">Kimi question three</article>
          </main>
          <textarea id="composer" aria-label="Ask Kimi"></textarea>
          <button id="send">Send</button>
          <script src="/content.js"></script>
        </body></html>`,
    });
  });

  await page.goto('https://www.kimi.com/chat/timeline-jump-fixture');
  const promptMarks = page.locator('.maw-message-jump');
  await expect(promptMarks).toHaveCount(3);
  await promptMarks.last().click();
  await expect
    .poll(() => page.locator('#messages').evaluate((element) => element.scrollTop))
    .toBeGreaterThan(1_500);
});

test('extension timeline is available on Claude, Gemini, and Kimi', async ({ page }) => {
  await installContentChromeApiMock(page);
  const contentScript = await fetch('http://127.0.0.1:4173/content.js').then((response) =>
    response.text(),
  );
  await page.route('**/content.js', async (route) => {
    await route.fulfill({ contentType: 'text/javascript', body: contentScript });
  });
  await page.route('**/timeline-policy-fixture', async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html>
        <html><head><meta charset="utf-8"><title>Timeline policy fixture</title></head><body>
          <main id="messages">
            <article class="user-message">Timeline policy question</article>
            <article class="assistant-message">Timeline policy answer</article>
          </main>
          <textarea id="composer" aria-label="Composer"></textarea>
          <button id="send">Send</button>
          <script src="/content.js"></script>
        </body></html>`,
    });
  });

  for (const [hostname, expected] of [
    ['chatgpt.com', false],
    ['claude.ai', true],
    ['gemini.google.com', true],
    ['chat.deepseek.com', false],
    ['grok.com', false],
    ['www.kimi.com', true],
  ] as const) {
    await page.goto(`https://${hostname}/timeline-policy-fixture`);
    await expect(page.locator('[data-multi-ai-workspace-root="true"]')).toHaveCount(1);
    await expect(page.locator('.maw-prompt-navigator')).toHaveCount(expected ? 1 : 0);
  }
});

test('saved input restores by default and can be undone or restored from page shortcuts', async ({
  page,
}) => {
  await installContentChromeApiMock(page, {
    draftEnabled: true,
    initialDraftContent: 'Recovered input',
  });
  await page.route('**/draft-restore-fixture.html', async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html>
        <html><head><meta charset="utf-8"><title>Draft restore fixture</title></head><body>
          <main>
            <textarea id="composer" aria-label="Composer"></textarea>
            <button id="send">Send</button>
          </main>
          <script src="/content.js"></script>
        </body></html>`,
    });
  });

  await page.goto('http://127.0.0.1:4173/draft-restore-fixture.html');
  const composer = page.getByLabel('Composer');
  await expect(composer).toHaveValue('Recovered input');
  await page.getByRole('button', { name: 'Open page shortcut menu' }).click();
  const quickMenu = page.getByLabel('Page shortcuts');
  await expect(quickMenu.getByRole('button', { name: 'Undo restore' })).toBeVisible();
  await expect(quickMenu.getByRole('button', { name: 'Restore', exact: true })).toHaveCount(0);

  await quickMenu.getByRole('button', { name: 'Undo restore' }).click();
  await expect(composer).toHaveValue('');
  await expect(
    quickMenu.getByText('Restore undone. You can restore the input again.'),
  ).toBeVisible();
  await expect(quickMenu.getByRole('button', { name: 'Restore', exact: true })).toBeVisible();
  await expect(quickMenu.getByRole('button', { name: 'Undo restore' })).toHaveCount(0);

  await quickMenu.getByRole('button', { name: 'Restore', exact: true }).click();
  await expect(composer).toHaveValue('Recovered input');
  await expect(quickMenu.getByRole('button', { name: 'Undo restore' })).toBeVisible();
  await composer.fill('Recovered input edited');
  await expect(quickMenu.getByRole('button', { name: 'Undo restore' })).toHaveCount(0);
  await expect(page.locator('.maw-draft-banner')).toHaveCount(0);
});

test('content feature switches remove disabled surfaces while preserving chat summary', async ({
  page,
}) => {
  await installContentChromeApiMock(page);
  await page.route('**/feature-gates-fixture.html', async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html>
        <html><head><meta charset="utf-8"><title>Feature gates fixture</title></head><body>
          <main id="messages">
            <article class="user-message">First prompt</article>
            <article class="assistant-message">First response</article>
          </main>
          <textarea id="composer" aria-label="Composer"></textarea>
          <button id="send">Send</button>
          <script src="/content.js"></script>
        </body></html>`,
    });
  });

  await page.goto('http://127.0.0.1:4173/feature-gates-fixture.html');
  await page.evaluate(() => {
    const records = (
      globalThis as unknown as {
        __mawDatabaseRecords: Record<string, Array<Record<string, unknown>>>;
      }
    ).__mawDatabaseRecords;
    records.prompts = [
      {
        id: 'prompt-e2e',
        scope: 'global',
        platformId: null,
        accountScopeId: null,
        title: 'Concise summary',
        content: 'Summarize for {{platform}} on {{date}}.',
        description: '',
        tags: ['summary'],
        folderId: null,
        usageCount: 0,
        favorite: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
  });
  await page.getByRole('button', { name: 'Open page shortcut menu' }).click();
  const quickMenu = page.getByLabel('Page shortcuts');
  await expect(quickMenu).toBeVisible();
  await expect(quickMenu.getByRole('button', { name: 'Prompts', exact: true })).toBeVisible();
  await expect(quickMenu.getByRole('button', { name: 'Pin a spot' })).toBeVisible();
  await expect(quickMenu.getByRole('button', { name: 'Branch conversation' })).toBeVisible();
  await expect(quickMenu.getByRole('button', { name: 'Export now' })).toBeVisible();
  await expect(quickMenu.getByText('Visual effects', { exact: true })).toHaveCount(0);
  await expect(quickMenu.locator('.maw-quick-actions .maw-quick-icon')).toHaveCount(4);
  await expect(quickMenu.locator('.maw-quick-effects')).toHaveCount(0);
  await quickMenu.getByRole('button', { name: 'Prompts', exact: true }).click();
  const promptRegion = quickMenu.getByRole('region', { name: 'Prompts' });
  await expect(promptRegion.getByText('Concise summary', { exact: true })).toBeVisible();
  await promptRegion.getByRole('button', { name: 'Insert' }).click();
  await expect(page.getByLabel('Composer')).toHaveValue(
    /Summarize for custom on \d{4}-\d{2}-\d{2}\./,
  );
  await expect(quickMenu).toBeHidden();
  await page.getByRole('button', { name: 'Open page shortcut menu' }).click();
  await quickMenu.getByRole('button', { name: 'Branch conversation' }).click();
  await expect(quickMenu.getByRole('button', { name: 'Branch from message 1' })).toBeVisible();
  await quickMenu.getByRole('button', { name: 'Open full workspace' }).click();
  const compatibility = page.getByLabel('Compatibility self-check');
  await expect(compatibility).toBeVisible();
  await expect(compatibility.getByText('Pin', { exact: true })).toBeVisible();
  await expect(compatibility.getByText('Timeline', { exact: true })).toBeVisible();
  await expect(compatibility.getByText('Branch', { exact: true })).toBeVisible();
  await expect(compatibility.getByText('Quote reply', { exact: true })).toBeVisible();
  await expect(compatibility.getByText('Export', { exact: true })).toBeVisible();
  await compatibility.getByRole('button', { name: 'Run self-check' }).click();
  await expect(
    compatibility.getByText('Self-check complete. Available features were reconnected.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rewrite', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prompts', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Conversation', exact: true })).toBeVisible();
  await expect(page.locator('.maw-prompt-navigator')).toBeVisible();

  await page.evaluate(() => {
    (
      globalThis as unknown as {
        __mawSetVisualEffect: (effect: 'mushroom') => void;
      }
    ).__mawSetVisualEffect('mushroom');
  });
  const effectLayer = page.locator('.maw-effect-layer[data-effect="mushroom"]');
  await expect(effectLayer).toBeVisible();
  await expect(effectLayer).toHaveCSS('pointer-events', 'none');
  await expect
    .poll(() =>
      effectLayer.evaluate((element) => {
        const canvas = element as HTMLCanvasElement;
        const pixels = canvas
          .getContext('2d')
          ?.getImageData(0, 0, canvas.width, canvas.height).data;
        if (!pixels) return 0;
        let paintedSamples = 0;
        for (let alpha = 3; alpha < pixels.length; alpha += 64) {
          if (pixels[alpha] > 0) paintedSamples += 1;
        }
        return paintedSamples;
      }),
    )
    .toBeGreaterThan(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(effectLayer).toBeHidden();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(effectLayer).toBeVisible();

  await page.evaluate(() => {
    (
      globalThis as unknown as {
        __mawSetVisualEffect: (effect: 'dandelion') => void;
      }
    ).__mawSetVisualEffect('dandelion');
  });
  const dandelionLayer = page.locator('.maw-effect-layer[data-effect="dandelion"]');
  await expect(dandelionLayer).toBeVisible();
  await expect
    .poll(() =>
      dandelionLayer.evaluate((element) => {
        const canvas = element as HTMLCanvasElement;
        const pixels = canvas
          .getContext('2d')
          ?.getImageData(0, 0, canvas.width, canvas.height).data;
        if (!pixels) return 0;
        let paintedSamples = 0;
        for (let alpha = 3; alpha < pixels.length; alpha += 64) {
          if (pixels[alpha] > 0) paintedSamples += 1;
        }
        return paintedSamples;
      }),
    )
    .toBeGreaterThan(0);

  await page.evaluate(() => {
    (
      globalThis as unknown as {
        __mawSetVisualEffect: (effect: 'off') => void;
      }
    ).__mawSetVisualEffect('off');
  });
  await expect(page.locator('.maw-effect-layer')).toHaveCount(0);

  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const chromeApi = (
          globalThis as unknown as {
            chrome: {
              runtime: {
                sendMessage(message: unknown, callback: () => void): void;
              };
            };
          }
        ).chrome;
        chromeApi.runtime.sendMessage(
          {
            type: 'settings.update',
            patch: {
              features: {
                promptRewrite: false,
                promptManager: false,
                timeline: false,
                export: false,
              },
            },
          },
          () => resolve(),
        );
      }),
  );

  await expect(page.getByRole('button', { name: 'Rewrite', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Prompts', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Conversation', exact: true })).toBeVisible();
  await expect(page.locator('.maw-prompt-navigator')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open page shortcut menu' }).click();
  await expect(
    page.getByLabel('Page shortcuts').getByRole('button', { name: 'Prompts', exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Conversation', exact: true }).click();
  await expect(page.getByText('Summarize the chat', { exact: true })).toBeVisible();
});

test('prompt navigation survives a delayed SPA conversation replacement', async ({ page }) => {
  await installContentChromeApiMock(page);
  await page.route('**/spa-route-fixture.html', async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html>
        <html><head><meta charset="utf-8"><title>SPA route fixture</title></head><body>
          <main id="messages">
            <article class="user-message">Old prompt</article>
            <article class="assistant-message">Old response</article>
          </main>
          <textarea id="composer" aria-label="Composer"></textarea>
          <button id="send">Send</button>
          <script src="/content.js"></script>
        </body></html>`,
    });
  });

  await page.goto('http://127.0.0.1:4173/spa-route-fixture.html');
  await expect(page.locator('.maw-message-jump')).toHaveCount(1);
  await page.evaluate(() => {
    (
      globalThis as unknown as {
        __mawSetVisualEffect: (effect: 'snow') => void;
      }
    ).__mawSetVisualEffect('snow');
  });
  await expect(page.locator('.maw-effect-layer[data-effect="snow"]')).toBeVisible();
  await page.evaluate(() => {
    history.pushState(null, '', '/spa-route-fixture.html?conversation=next');
  });
  await page.waitForTimeout(350);
  await page.evaluate(() => {
    document.querySelector('[data-multi-ai-workspace-root="true"]')?.remove();
    const replacement = document.createElement('main');
    replacement.id = 'messages';
    replacement.innerHTML = `
      <article class="user-message">New prompt one</article>
      <article class="assistant-message">New response one</article>
      <article class="user-message">New prompt two</article>
      <article class="assistant-message">New response two</article>
      <article class="user-message">New prompt three</article>
    `;
    document.querySelector('#messages')?.replaceWith(replacement);
  });

  await expect(page.locator('[data-multi-ai-workspace-root="true"]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Open page shortcut menu' })).toBeVisible();
  await expect(page.locator('.maw-effect-layer[data-effect="snow"]')).toBeVisible();
  await expect(page.locator('.maw-message-jump')).toHaveCount(3);
  await page.getByRole('button', { name: 'Open page shortcut menu' }).click();
  const recoveredQuickMenu = page.getByLabel('Page shortcuts');
  await expect(recoveredQuickMenu.getByRole('button', { name: 'Pin a spot' })).toBeVisible();
  await expect(
    recoveredQuickMenu.getByRole('button', { name: 'Branch conversation' }),
  ).toBeVisible();
  await expect(recoveredQuickMenu.getByRole('button', { name: 'Export now' })).toBeVisible();
  await recoveredQuickMenu.getByRole('button', { name: 'Branch conversation' }).click();
  await expect(recoveredQuickMenu.getByText(/^Branch from message /)).toHaveCount(5);
  await page.keyboard.press('Escape');
  await expect(recoveredQuickMenu).toBeHidden();
  expect(
    await page.evaluate(
      () => (globalThis as unknown as { __mawBindingGetCount: number }).__mawBindingGetCount,
    ),
  ).toBeGreaterThanOrEqual(2);
  await page.locator('.maw-prompt-navigator').hover();
  await expect(page.locator('.maw-prompt-list button')).toHaveCount(3);
  await expect(page.locator('.maw-prompt-list button').last()).toContainText('New prompt three');
});

test('DeepSeek can pin an arbitrary page position without detected message selectors', async ({
  page,
}) => {
  await installContentChromeApiMock(page);
  const contentScript = await fetch('http://127.0.0.1:4173/content.js').then((response) =>
    response.text(),
  );
  await page.route('https://chat.deepseek.com/content.js', async (route) => {
    await route.fulfill({ contentType: 'text/javascript', body: contentScript });
  });
  await page.route('https://chat.deepseek.com/a/chat/first', async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html>
        <html><head><meta charset="utf-8"><title>DeepSeek pin fixture</title></head><body>
          <main>
            <div class="neutral-turn-shell">
              <div id="deepseek-pin-target" aria-label="Empty DeepSeek chart" style="height: 120px"></div>
            </div>
            <textarea id="composer" aria-label="Message DeepSeek"></textarea>
            <button id="send">Send</button>
          </main>
          <script src="/content.js"></script>
        </body></html>`,
    });
  });

  await page.goto('https://chat.deepseek.com/a/chat/first');
  await expect(page.locator('[data-multi-ai-workspace-root="true"]')).toHaveCount(1);
  await expect(page.locator('.maw-prompt-navigator')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open page shortcut menu' }).click();
  const quickMenu = page.getByLabel('Page shortcuts');
  await expect(quickMenu.getByRole('button', { name: 'Prompts', exact: true })).toBeVisible();
  await expect(quickMenu.getByRole('button', { name: 'Pin a spot' })).toBeVisible();
  await expect(quickMenu.getByRole('button', { name: 'Branch conversation' })).toHaveCount(0);
  await expect(quickMenu.getByRole('button', { name: 'Export now' })).toHaveCount(0);
  await expect(quickMenu.getByText('Visual effects', { exact: true })).toHaveCount(0);
  await quickMenu.getByRole('button', { name: 'Pin a spot' }).click();
  await page.locator('#deepseek-pin-target').click({ position: { x: 30, y: 90 } });
  await expect(page.locator('.maw-pin-jump')).toHaveCount(1);

  const storedPin = await page.evaluate(() => {
    const records = (
      globalThis as unknown as {
        __mawDatabaseRecords: Record<string, Array<Record<string, unknown>>>;
      }
    ).__mawDatabaseRecords;
    return records.conversationPins?.[0];
  });
  expect(storedPin).toMatchObject({
    platformId: 'deepseek',
    messageId: null,
    anchorKind: 'point',
  });
  expect(storedPin?.anchorPath).toMatch(/^[0-9a-z.]+$/);
  expect(storedPin).not.toHaveProperty('text');
  expect(storedPin).not.toHaveProperty('plainText');

  await page.evaluate(() => history.pushState(null, '', '/a/chat/second'));
  await expect(page.locator('.maw-pin-jump')).toHaveCount(0);
  await page.evaluate(() => history.pushState(null, '', '/a/chat/first'));
  await expect(page.locator('.maw-pin-jump')).toHaveCount(1);
});

test('selected text tools highlight, quote, and expose direct prompt navigation', async ({
  page,
}) => {
  await installContentChromeApiMock(page);
  await page.route('**/conversation-fixture.html', async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html>
        <html><head><meta charset="utf-8"><title>Conversation fixture</title><style>
          body { margin: 0; font: 18px sans-serif; }
          main { width: min(760px, 90vw); margin: auto; }
          article { min-height: 560px; padding: 60px 20px; }
          .user-message { background: #f2f7ff; }
          .assistant-message { background: #fff; }
          textarea { width: 100%; min-height: 100px; }
        </style></head><body>
          <main>
            <section id="messages">
              <article class="user-message">You said: First user question</article>
              <article class="assistant-message">
                <p id="highlight-target">A precise answer with selectable text.</p>
                <div id="wide-highlight-target"><p>Short title</p><p>Another short line</p></div>
                <div id="blank-pin-target" aria-label="Empty chart position" style="height: 120px"></div>
                <pre id="mermaid-target"><code class="language-mermaid">graph TD
                  A[Question] --&gt; B[Answer]
                </code></pre>
                <span id="formula-target" class="katex">x squared
                  <math><semantics><msup><mi>x</mi><mn>2</mn></msup><annotation encoding="application/x-tex">x^2</annotation></semantics></math>
                </span>
                <span id="fallback-formula-target" class="katex">x² + y₁ ≤ √(α + 1)</span>
              </article>
              <article id="second-user-message" class="user-message">Follow-up question</article>
            </section>
            <textarea id="composer" aria-label="Composer"></textarea>
            <button id="send">Send</button>
          </main>
          <script src="/content.js"></script>
        </body></html>`,
    });
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto('http://127.0.0.1:4173/conversation-fixture.html');
  expect(response?.status()).toBe(200);
  await page.waitForTimeout(300);
  expect(errors).toEqual([]);
  await expect(page.locator('[data-multi-ai-workspace-root="true"]')).toHaveCount(1);

  const inlineMermaid = page.locator('[data-maw-mermaid-inline="true"]');
  await expect(inlineMermaid.locator('svg')).toBeVisible({ timeout: 15_000 });
  await inlineMermaid.getByRole('button', { name: 'Open Mermaid diagram tools' }).click();
  await expect(page.getByRole('dialog', { name: 'Mermaid diagram' })).toBeVisible();
  await expect(page.locator('.maw-mermaid-preview svg')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Export SVG' })).toBeEnabled();
  await page.getByRole('button', { name: 'Close' }).click();

  await page.locator('#formula-target').hover();
  await page.getByRole('button', { name: 'Open formula copy tools' }).click();
  await expect(page.getByRole('dialog', { name: 'Copy formula' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Copy LaTeX/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Copy MathML' })).toBeEnabled();
  await page.getByRole('button', { name: 'Close' }).click();

  await page.locator('#fallback-formula-target').hover();
  await page.getByRole('button', { name: 'Open formula copy tools' }).click();
  const fallbackFormulaDialog = page.getByRole('dialog', { name: 'Copy formula' });
  await expect(fallbackFormulaDialog).toBeVisible();
  await expect(
    fallbackFormulaDialog.getByText('Only the displayed formula is available'),
  ).toBeVisible();
  await expect(
    fallbackFormulaDialog.getByRole('button', { name: /^Copy compatible formula/ }),
  ).toBeEnabled();
  await expect(
    fallbackFormulaDialog.getByRole('button', {
      name: 'Convert and copy LaTeX (review required)',
    }),
  ).toBeEnabled();
  await expect(fallbackFormulaDialog.locator('button:disabled')).toHaveCount(0);
  await fallbackFormulaDialog.getByRole('button', { name: 'Close' }).click();

  const promptMarks = page.locator('.maw-message-jump');
  const promptCards = page.locator('.maw-prompt-list button');
  const promptNavigator = page.locator('.maw-prompt-navigator');
  await expect(promptMarks).toHaveCount(2);
  await expect(promptCards).toHaveCount(2);
  await expect(page.locator('.maw-prompt-card')).toBeHidden();
  await promptNavigator.hover();
  await expect(page.locator('.maw-prompt-card')).toBeVisible();
  await expect(promptCards.first()).toContainText('First user question');
  await expect(promptCards.first()).not.toContainText('You said');
  await expect(promptCards.last()).toContainText('Follow-up question');

  await page.getByRole('button', { name: 'Branch from message 2' }).click();
  await expect(page.getByText(/A new branch chat was opened/)).toBeVisible();
  const branchNavigator = page.getByLabel('Conversation branches');
  await expect(branchNavigator).toBeVisible();
  await expect(branchNavigator).toContainText('Conversation fixture');
  await branchNavigator.getByRole('button').click();
  await expect(branchNavigator.getByRole('menuitem', { name: /Branch 1/ })).toBeVisible();
  await branchNavigator.locator('.maw-branch-current').click();
  await expect(page.getByRole('dialog', { name: 'Conversation branch preview' })).toHaveCount(0);
  const storedBranch = await page.evaluate(() => {
    const records = (
      globalThis as unknown as {
        __mawDatabaseRecords: Record<string, Array<Record<string, unknown>>>;
      }
    ).__mawDatabaseRecords;
    return records.conversationBranches?.find((record) => record.id === 'branch-e2e');
  });
  expect(storedBranch).toMatchObject({
    parentBranchId: 'original-e2e',
    branchPointOrder: 1,
  });
  expect(storedBranch).not.toHaveProperty('context');

  await selectHighlightFixtureText(page);
  await expect(page.getByRole('button', { name: 'Quote Reply' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pin', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Highlight', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Improve Prompt' })).toBeVisible();
  const pinNavigator = page.getByRole('navigation', { name: 'Conversation pins' });
  const pinMarks = page.locator('.maw-pin-jump');

  await selectHighlightFixtureText(page);
  await page.getByRole('button', { name: 'Highlight color: pink' }).click();
  const originalMarkup = await page.locator('#highlight-target').innerHTML();
  await page.getByRole('button', { name: 'Highlight', exact: true }).click();
  const highlightRectangles = page.locator('.maw-highlight-rectangle');
  await expect(highlightRectangles).not.toHaveCount(0);
  await expect(page.locator('#highlight-target')).toHaveJSProperty('innerHTML', originalMarkup);
  const originalHighlightCount = await highlightRectangles.count();

  await selectHighlightFixtureText(page);
  await expect(page.getByRole('button', { name: 'Highlight', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove highlight' })).toBeVisible();
  await page.getByRole('button', { name: 'Highlight', exact: true }).click();
  await expect(highlightRectangles).toHaveCount(originalHighlightCount);
  expect(
    await highlightRectangles.evaluateAll((elements) =>
      elements.map((element) => (element as HTMLElement).style.background),
    ),
  ).toEqual(Array(originalHighlightCount).fill('rgba(236, 104, 164, 0.38)'));

  await selectHighlightFixtureText(page);
  await page.getByRole('button', { name: 'Highlight color: blue' }).click();
  await page.getByRole('button', { name: 'Highlight', exact: true }).click();
  await expect(highlightRectangles).toHaveCount(originalHighlightCount);
  await expect
    .poll(() =>
      highlightRectangles.evaluateAll((elements) =>
        elements.map((element) => (element as HTMLElement).style.background),
      ),
    )
    .toEqual(Array(originalHighlightCount).fill('rgba(91, 137, 242, 0.38)'));

  await selectHighlightFixtureText(page);
  await expect(page.getByRole('button', { name: 'Remove highlight' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove highlight' }).click();
  await expect(highlightRectangles).toHaveCount(0);

  await selectHighlightFixtureText(page, '#wide-highlight-target');
  await page.getByRole('button', { name: 'Highlight', exact: true }).click();
  await expect(page.locator('.maw-highlight-rectangle')).not.toHaveCount(0);
  const targetWidth = await page
    .locator('#wide-highlight-target')
    .evaluate((element) => element.getBoundingClientRect().width);
  const highlightWidths = await page
    .locator('.maw-highlight-rectangle')
    .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().width));
  expect(Math.max(...highlightWidths)).toBeLessThan(targetWidth * 0.75);
  await selectHighlightFixtureText(page, '#wide-highlight-target');
  await page.getByRole('button', { name: 'Remove highlight' }).click();
  await expect(page.locator('.maw-highlight-rectangle')).toHaveCount(0);

  await selectHighlightFixtureRange(page, '#highlight-target', '#second-user-message');
  await page.getByRole('button', { name: 'Highlight', exact: true }).click();
  await expect
    .poll(async () => page.locator('.maw-highlight-rectangle').count())
    .toBeGreaterThan(1);
  const highlightRows = await page
    .locator('.maw-highlight-rectangle')
    .evaluateAll((elements) =>
      elements.map((element) => Math.round(element.getBoundingClientRect().top)),
    );
  expect(new Set(highlightRows).size).toBeGreaterThan(1);
  await selectHighlightFixtureRange(page, '#highlight-target', '#second-user-message');
  await page.getByRole('button', { name: 'Remove highlight' }).click();
  await expect(page.locator('.maw-highlight-rectangle')).toHaveCount(0);

  await selectHighlightFixtureText(page);
  await page.getByRole('button', { name: 'Quote Reply' }).click();
  await expect(page.getByLabel('Composer')).toHaveValue(
    '> A precise answer with selectable text.\n\n',
  );
  const openPinMode = async () => {
    await page.getByRole('button', { name: 'Open page shortcut menu' }).click();
    await page.getByLabel('Page shortcuts').getByRole('button', { name: 'Pin a spot' }).click();
  };
  await openPinMode();
  await expect(
    page.getByText('Click anywhere on the page to pin that exact position. Press Esc to cancel.'),
  ).toBeVisible();
  await page.locator('#blank-pin-target').hover({ position: { x: 20, y: 80 } });
  await expect(page.locator('.maw-pin-target-preview')).toBeVisible();
  await page.locator('#blank-pin-target').click({ position: { x: 20, y: 80 } });
  await expect(page.getByText('Location pinned.')).toBeVisible();
  await expect(pinMarks).toHaveCount(1);
  const storedPin = await page.evaluate(() => {
    const records = (
      globalThis as unknown as {
        __mawDatabaseRecords: Record<string, Array<Record<string, unknown>>>;
      }
    ).__mawDatabaseRecords;
    return records.conversationPins?.[0];
  });
  expect(storedPin).toMatchObject({
    platformId: 'custom',
    accountScopeId: 'anonymous',
    conversationId: '/conversation-fixture.html',
    anchorKind: 'point',
  });
  expect(storedPin).not.toHaveProperty('text');
  expect(storedPin).not.toHaveProperty('plainText');
  expect(storedPin).not.toHaveProperty('preview');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(pinMarks).toHaveCount(0);

  await openPinMode();
  await page.locator('#highlight-target').click();
  await expect(pinMarks).toHaveCount(1);
  await openPinMode();
  await page.locator('#second-user-message').click();
  await expect(pinMarks).toHaveCount(2);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByRole('button', { name: 'Previous pin' }).click();
  await page.waitForTimeout(500);
  await expect
    .poll(() =>
      page.locator('#highlight-target').evaluate((element) => element.getBoundingClientRect().top),
    )
    .toBeLessThan(500);
  await page.getByRole('button', { name: 'Next pin' }).click();
  await page.waitForTimeout(500);
  await expect
    .poll(() =>
      page
        .locator('#second-user-message')
        .evaluate((element) => element.getBoundingClientRect().top),
    )
    .toBeLessThan(500);
  await pinNavigator.hover();
  await page.locator('.maw-pin-remove').last().click();
  await expect(pinMarks).toHaveCount(1);
  await pinNavigator.hover();
  await page.locator('.maw-pin-remove').first().click();
  await expect(pinMarks).toHaveCount(0);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await promptNavigator.hover();
  await promptCards.first().click();
  await page.waitForTimeout(750);
  const firstMessageTop = await page
    .locator('.user-message')
    .first()
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(firstMessageTop).toBeLessThan(500);

  await page.getByRole('button', { name: 'Open page shortcut menu' }).click();
  await page.getByRole('button', { name: 'Open full workspace' }).click();
  await page.getByRole('button', { name: 'Conversation', exact: true }).click();
  await expect(page.getByText('Summarize the chat', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Add an AI Provider before summarizing a conversation.'),
  ).toBeVisible();
  await expect(page.getByLabel('Search message text or node notes')).toBeVisible();
  const timeline = page.locator('.maw-timeline');
  await expect(timeline.locator('article')).toHaveCount(3);
  await timeline.getByLabel('Collapse child nodes').first().click();
  await expect(timeline.locator('article')).toHaveCount(2);
  await timeline.getByLabel('Expand child nodes').click();
  await expect(timeline.locator('article')).toHaveCount(3);
  await timeline.getByLabel('Edit node note').first().click();
  await timeline.getByLabel('Local node note').fill('Check the first claim');
  await timeline.getByRole('button', { name: 'Save' }).click();
  await expect(timeline.getByText('Check the first claim')).toBeVisible();
  await timeline.getByLabel('Select timeline node 1').check();
  await expect(page.getByText('1 selected')).toBeVisible();
  const timelineExports = page.locator('.maw-timeline-export-actions');
  await expect(timelineExports.getByRole('button', { name: 'Export now' })).toBeVisible();
  await page.getByRole('button', { name: 'Rewrite', exact: true }).click();
  await expect(page.getByText('No AI provider configured')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Configure provider' })).toBeVisible();
  expect(errors).toEqual([]);
});
