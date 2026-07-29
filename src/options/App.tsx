import { useEffect, useMemo, useState } from 'react';
import browser from 'webextension-polyfill';

import { I18nProvider, useI18n } from '../shared/i18n/I18nContext';
import {
  exportRawExtensionData,
  MigrationManager,
  resetExtensionData,
} from '../shared/migrations/migrations';
import { DEFAULT_SETTINGS, SettingsRepository } from '../shared/storage/localStorage';
import { WorkspaceDatabase } from '../shared/storage/indexedDb';
import type { DebugReport } from '../shared/types/diagnostics';
import type { AppSettings } from '../shared/types/settings';
import { BrandIcon } from '../ui/components/BrandIcon';
import { LanguageToggle } from '../ui/components/LanguageToggle';
import { AboutPanel } from './AboutPanel';
import { NotificationSettings } from './NotificationSettings';
import { DefaultModelSettings } from './DefaultModelSettings';
import { PromptManager } from './PromptManager';
import { PromptRewriteWorkbench } from './PromptRewriteWorkbench';
import { ProviderSettings } from './ProviderSettings';
import { SettingsIcon } from './SettingsIcon';
import { sendRuntimeRequest } from './runtime';
import type { MessageKey } from '../shared/i18n/messages';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  SETTING_DEFINITIONS,
  VISIBLE_CATEGORY_ORDER,
  type SettingCategory,
  type SettingDefinition,
  type SettingValue,
} from './settingDefinitions';

const settingsRepository = new SettingsRepository();

const CATEGORY_GROUPS: readonly {
  label: MessageKey;
  categories: readonly SettingCategory[];
}[] = [
  {
    label: 'settingsGroupWorkspace',
    categories: ['prompt-rewrite', 'prompt-manager', 'input'],
  },
  {
    label: 'settingsGroupConversation',
    categories: ['timeline', 'markdown', 'export'],
  },
  {
    label: 'settingsGroupAppearance',
    categories: ['layout', 'font', 'experimental'],
  },
  {
    label: 'settingsGroupSystem',
    categories: ['notifications', 'privacy', 'data-management', 'diagnostics', 'about'],
  },
];

function isCategory(value: string): value is SettingCategory {
  return CATEGORY_ORDER.includes(value as SettingCategory);
}

function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function SettingCard({
  definition,
  settings,
  onChange,
}: {
  definition: SettingDefinition;
  settings: AppSettings;
  onChange: (settings: AppSettings) => Promise<void>;
}) {
  const t = useI18n();
  const value = definition.read(settings);
  const update = (nextValue: SettingValue) => onChange(definition.write(settings, nextValue));

  const segmented = definition.control === 'segmented';
  const detailedRadio = definition.control === 'radio';

  return (
    <article
      className={`setting-card${segmented ? ' segmented-setting-card' : ''}${detailedRadio ? ' radio-setting-card' : ''}`}
    >
      <div className="setting-topline">
        <h2>{t(definition.label)}</h2>
        <div className="setting-control">
          {definition.control === 'toggle' ? (
            <button
              className="switch"
              type="button"
              role="switch"
              aria-label={t(definition.label)}
              aria-checked={Boolean(value)}
              onClick={() => void update(!value)}
            />
          ) : definition.control === 'segmented' ? (
            <div className="segmented-control" role="radiogroup" aria-label={t(definition.label)}>
              {definition.options?.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={value === option.value}
                  onClick={() => void update(option.value)}
                >
                  {option.icon ? <span aria-hidden="true">{option.icon}</span> : null}
                  {t(option.label)}
                </button>
              ))}
            </div>
          ) : definition.control === 'radio' ? (
            <div className="setting-radio-list" role="radiogroup" aria-label={t(definition.label)}>
              {definition.options?.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={value === option.value}
                  onClick={() => void update(option.value)}
                >
                  <span className="setting-radio-dot" aria-hidden="true" />
                  <span>
                    <strong>{t(option.label)}</strong>
                    {option.description ? <small>{t(option.description)}</small> : null}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <select
              aria-label={t(definition.label)}
              value={String(value)}
              onChange={(event) => void update(event.target.value)}
            >
              {definition.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.label)}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </article>
  );
}

function DataManagement({ reload }: { reload: () => Promise<void> }) {
  const t = useI18n();
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const exportData = async () => {
    downloadJson('multi-ai-workspace-data.json', await exportRawExtensionData());
    setNotice(t('dataExported'));
  };

  const resetData = async () => {
    if (!window.confirm(t('resetConfirm'))) {
      return;
    }
    try {
      setError('');
      const database = new WorkspaceDatabase();
      const profiles = await database.getAll('apiProfiles');
      const origins = [
        ...new Set(
          [...profiles.map((profile) => profile.baseUrlOrigin)]
            .filter(Boolean)
            .map((origin) => `${origin}/*`),
        ),
      ];
      for (const profile of profiles) {
        await sendRuntimeRequest({ type: 'provider.delete', profileId: profile.id });
      }
      await browser.permissions.remove({
        permissions: ['notifications'],
        ...(origins.length ? { origins } : {}),
      });
      await resetExtensionData();
      await new MigrationManager().run();
      await reload();
      setNotice(t('dataReset'));
    } catch {
      setError(t('requestFailed'));
    }
  };

  return (
    <div className="settings-stack">
      {notice ? (
        <div className="notice" role="status">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      ) : null}
      <article className="setting-card action-card">
        <div>
          <h2>{t('exportRawData')}</h2>
          <p className="setting-description">{t('exportRawDataDescription')}</p>
        </div>
        <button className="button button-secondary" type="button" onClick={() => void exportData()}>
          {t('exportRawData')}
        </button>
      </article>
      <article className="setting-card action-card">
        <div>
          <h2>{t('resetData')}</h2>
          <p className="setting-description">{t('resetDataDescription')}</p>
        </div>
        <button className="button button-danger" type="button" onClick={() => void resetData()}>
          {t('resetData')}
        </button>
      </article>
    </div>
  );
}

function Diagnostics({ settings }: { settings: AppSettings }) {
  const t = useI18n();
  const [notice, setNotice] = useState('');

  const exportReport = () => {
    const report: DebugReport = {
      extensionVersion: browser.runtime.getManifest().version,
      browser: navigator.userAgent,
      platform: 'unknown',
      urlOrigin: location.origin,
      capabilities: {},
      failedSelectors: [],
      errors: [],
      settingsSummary: {
        locale: settings.locale,
        enabledFeatureCount: Object.values(settings.features).filter(Boolean).length,
        onboardingComplete: settings.privacy.onboardingComplete,
      },
    };
    downloadJson('multi-ai-workspace-diagnostics.json', report);
    setNotice(t('diagnosticsExported'));
  };

  return (
    <div className="settings-stack">
      {notice ? (
        <div className="notice" role="status">
          {notice}
        </div>
      ) : null}
      <article className="setting-card action-card">
        <div>
          <h2>{t('exportDiagnostics')}</h2>
          <p className="setting-description">{t('diagnosticsDescription')}</p>
        </div>
        <button className="button button-secondary" type="button" onClick={exportReport}>
          {t('exportDiagnostics')}
        </button>
      </article>
    </div>
  );
}

function PromptRewriteProviderPage({ onConfigureProvider }: { onConfigureProvider: () => void }) {
  const t = useI18n();
  const [providerRevision, setProviderRevision] = useState(0);

  return (
    <div className="settings-stack combined-provider-page">
      <PromptRewriteWorkbench
        onConfigureProvider={onConfigureProvider}
        providerRevision={providerRevision}
      />
      <section
        className="settings-stack provider-settings-section"
        id="provider-settings"
        tabIndex={-1}
        aria-labelledby="provider-settings-title"
      >
        <article className="setting-card combined-section-heading">
          <p className="eyebrow">{t('categoryPromptRewrite')}</p>
          <h2 id="provider-settings-title">{t('categoryAiProvider')}</h2>
          <p className="setting-description">{t('providerSectionDescription')}</p>
        </article>
        <ProviderSettings onProfilesChange={() => setProviderRevision((value) => value + 1)} />
      </section>
    </div>
  );
}

function OptionsContent({
  settings,
  setSettings,
}: {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
}) {
  const t = useI18n();
  const initialHash = location.hash.slice(1);
  const [category, setCategory] = useState<SettingCategory>(
    initialHash === 'ai-provider'
      ? 'prompt-rewrite'
      : initialHash === 'conversation-index' ||
          initialHash === 'favorites' ||
          initialHash === 'platform-specific' ||
          initialHash === 'custom-websites'
        ? 'layout'
        : isCategory(initialHash)
          ? initialHash
          : 'layout',
  );
  const [error, setError] = useState('');
  const categorySettings = useMemo(
    () => SETTING_DEFINITIONS.filter((definition) => definition.category === category),
    [category],
  );
  const toolbarCategories: readonly SettingCategory[] = VISIBLE_CATEGORY_ORDER;

  const selectCategory = (next: SettingCategory) => {
    setCategory(next);
    history.replaceState(null, '', `#${next}`);
  };

  const focusProviderSettings = () => {
    const providerSettings = document.getElementById('provider-settings');
    providerSettings?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    providerSettings?.focus({ preventScroll: true });
  };

  useEffect(() => {
    let frame = 0;
    const applyLocationHash = () => {
      const hash = location.hash.slice(1);
      if (hash === 'ai-provider') {
        setCategory('prompt-rewrite');
        history.replaceState(null, '', '#prompt-rewrite');
        if (frame) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const providerSettings = document.getElementById('provider-settings');
          providerSettings?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          providerSettings?.focus({ preventScroll: true });
        });
      } else if (
        hash === 'conversation-index' ||
        hash === 'favorites' ||
        hash === 'platform-specific' ||
        hash === 'custom-websites'
      ) {
        setCategory('layout');
        history.replaceState(null, '', '#layout');
      } else if (isCategory(hash)) {
        setCategory(hash);
      }
    };

    applyLocationHash();
    window.addEventListener('hashchange', applyLocationHash);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('hashchange', applyLocationHash);
    };
  }, []);

  const save = async (nextSettings: AppSettings) => {
    try {
      setSettings(await settingsRepository.set(nextSettings));
      setError('');
    } catch {
      setError(t('saveError'));
    }
  };

  const reload = async () => setSettings(await settingsRepository.get());

  return (
    <div className="options-layout">
      <aside className="options-sidebar">
        <div className="sidebar-masthead">
          <div className="sidebar-brand">
            <BrandIcon className="brand-mark" />
            <span>
              <strong>{t('productName')}</strong>
              <small>{t('settingsControlDeck')}</small>
            </span>
          </div>
          <LanguageToggle
            locale={settings.locale}
            onChange={(locale) => save({ ...settings, locale })}
          />
        </div>
        <nav className="category-nav" aria-label={t('optionsTitle')}>
          {CATEGORY_GROUPS.map((group) => (
            <section className="category-group" key={group.label} aria-label={t(group.label)}>
              <p>{t(group.label)}</p>
              {group.categories.map((entry) => (
                <button
                  className="category-button"
                  type="button"
                  key={entry}
                  aria-current={category === entry ? 'page' : undefined}
                  onClick={() => selectCategory(entry)}
                >
                  <SettingsIcon category={entry} />
                  <span>{t(CATEGORY_LABELS[entry])}</span>
                  <span className="category-signal" aria-hidden="true" />
                </button>
              ))}
            </section>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span>{t('settingsLocalFirst')}</span>
          <strong>{t('version', { version: browser.runtime.getManifest().version })}</strong>
        </div>
      </aside>
      <main className="options-main">
        <div className="options-toolbar">
          <select
            aria-label={t('optionsTitle')}
            value={category}
            onChange={(event) => selectCategory(event.target.value as SettingCategory)}
          >
            {toolbarCategories.map((entry) => (
              <option key={entry} value={entry}>
                {t(CATEGORY_LABELS[entry])}
              </option>
            ))}
          </select>
          <LanguageToggle
            locale={settings.locale}
            onChange={(locale) => save({ ...settings, locale })}
          />
        </div>
        <header className="options-header">
          <div className="options-header-icon">
            <SettingsIcon category={category} />
          </div>
          <div>
            <p className="eyebrow">{t('optionsTitle')}</p>
            <h1>{t(CATEGORY_LABELS[category])}</h1>
            <p className="muted">{t('optionsSubtitle')}</p>
          </div>
          <span className="options-live-badge">{t('settingsChangesLive')}</span>
        </header>
        {error ? (
          <div className="notice notice-error" role="alert">
            {error}
          </div>
        ) : null}
        {category === 'data-management' ? <DataManagement reload={reload} /> : null}
        {category === 'diagnostics' ? <Diagnostics settings={settings} /> : null}
        {category === 'about' ? <AboutPanel onOpenCategory={selectCategory} /> : null}
        {category === 'prompt-rewrite' ? (
          <PromptRewriteProviderPage onConfigureProvider={focusProviderSettings} />
        ) : null}
        {category === 'prompt-manager' ? <PromptManager /> : null}
        {category === 'notifications' ? (
          <NotificationSettings settings={settings} onChange={save} />
        ) : null}
        {category === 'experimental' ? (
          <div className="settings-stack">
            <DefaultModelSettings settings={settings} onChange={save} />
          </div>
        ) : null}
        <div className="settings-stack">
          {categorySettings.map((definition) => (
            <SettingCard
              key={definition.id}
              definition={definition}
              settings={settings}
              onChange={save}
            />
          ))}
          {categorySettings.length === 0 &&
          category !== 'data-management' &&
          category !== 'diagnostics' &&
          category !== 'about' &&
          category !== 'prompt-rewrite' &&
          category !== 'prompt-manager' &&
          category !== 'notifications' ? (
            <div className="empty-state">{t('noSettings')}</div>
          ) : null}
        </div>
      </main>
    </div>
  );
}

export function App() {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    void settingsRepository.get().then(setSettings);
  }, []);

  const activeSettings = settings ?? DEFAULT_SETTINGS;
  return (
    <I18nProvider locale={activeSettings.locale}>
      <div className="page-shell">
        {settings ? <OptionsContent settings={settings} setSettings={setSettings} /> : null}
      </div>
    </I18nProvider>
  );
}
