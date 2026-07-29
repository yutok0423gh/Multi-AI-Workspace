import { useEffect, useState } from 'react';
import browser from 'webextension-polyfill';

import { I18nProvider, useI18n } from '../shared/i18n/I18nContext';
import type { MessageKey } from '../shared/i18n/messages';
import { DEFAULT_SETTINGS, SettingsRepository } from '../shared/storage/localStorage';
import type { AppSettings } from '../shared/types/settings';
import { BrandIcon } from '../ui/components/BrandIcon';
import { LanguageToggle } from '../ui/components/LanguageToggle';
import {
  CATEGORY_LABELS,
  SETTING_DEFINITIONS,
  type SettingCategory,
  type SettingDefinition,
  type SettingValue,
} from '../options/settingDefinitions';

const settingsRepository = new SettingsRepository();

type VisualEffectMode = AppSettings['ui']['visualEffect'];
type FormulaCopyFormat = AppSettings['markup']['formulaCopyFormat'];

const QUICK_EFFECTS: Array<{
  value: VisualEffectMode;
  label: MessageKey;
}> = [
  { value: 'off', label: 'visualEffectOff' },
  { value: 'snow', label: 'visualEffectSnow' },
  { value: 'sakura', label: 'visualEffectSakura' },
  { value: 'rain', label: 'visualEffectRain' },
  { value: 'mushroom', label: 'visualEffectMushroom' },
  { value: 'dandelion', label: 'visualEffectDandelion' },
];

const FORMULA_FORMAT_DEFINITION = SETTING_DEFINITIONS.find(
  (definition) => definition.id === 'formula-copy-format',
);

const FORMULA_FORMAT_SYMBOLS: Record<FormulaCopyFormat, string> = {
  latex: 'TeX',
  mathml: 'XML',
  word: 'W',
  notion: 'N',
};

function isFormulaCopyFormat(value: string): value is FormulaCopyFormat {
  return value === 'latex' || value === 'mathml' || value === 'word' || value === 'notion';
}

function QuickEffectIcon({ effect }: { effect: VisualEffectMode }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.6,
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      {effect === 'off' && (
        <>
          <circle cx="12" cy="12" r="7.5" {...common} />
          <path d="M6.7 6.7 17.3 17.3" {...common} />
        </>
      )}
      {effect === 'snow' && (
        <>
          <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" {...common} />
          <path d="m9.5 5.2 2.5 2.1 2.5-2.1M9.5 18.8l2.5-2.1 2.5 2.1" {...common} />
        </>
      )}
      {effect === 'sakura' && (
        <>
          <path
            d="M12 11.7c-4-1.2-5.3-4.2-3.5-5.5 1.5-1.1 3.1.2 3.5 2.1.4-1.9 2-3.2 3.5-2.1 1.8 1.3.5 4.3-3.5 5.5Z"
            {...common}
          />
          <path
            d="M12 12.3c4 1.2 5.3 4.2 3.5 5.5-1.5 1.1-3.1-.2-3.5-2.1-.4 1.9-2 3.2-3.5 2.1-1.8-1.3-.5-4.3 3.5-5.5Z"
            {...common}
          />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
        </>
      )}
      {effect === 'rain' && <path d="m8 4-3 6m8-6-4 8m9-8-4 8m3 2-3 6m-4-4-2 4" {...common} />}
      {effect === 'mushroom' && (
        <>
          <path d="M4.5 11.2a7.5 7.5 0 0 1 15 0Z" {...common} />
          <path
            d="M9.5 11.2v4.2c0 2-1.2 3.6-2.7 4.1h10.4c-1.5-.5-2.7-2.1-2.7-4.1v-4.2"
            {...common}
          />
          <path d="M8 8.5h.1m7.8 0h.1M12 6.5h.1" {...common} />
        </>
      )}
      {effect === 'dandelion' && (
        <>
          <path d="M9.5 10.5c1.4 3.6.9 7-1.4 10" {...common} />
          <path
            d="m9.4 10.5-3-4m3 4 .4-5m-.4 5 3.6-3.2m-3.6 3.2-4.8.4m13.8-5.8 1.2-1.2m-3.7 5.5 1.4.7m1.6-4.5 1.7.1"
            {...common}
          />
          <circle cx="9.4" cy="10.5" r="1.2" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

function openOptions(section?: string): Promise<unknown> {
  const suffix = section ? `#${section}` : '';
  return browser.tabs.create({ url: browser.runtime.getURL(`options.html${suffix}`) });
}

function PrivacyOnboarding({ onChange }: { onChange: (settings: AppSettings) => void }) {
  const t = useI18n();
  const [permissionMessage, setPermissionMessage] = useState('');

  const continueOnboarding = async () => {
    onChange(await settingsRepository.update({ privacy: { onboardingComplete: true } }));
  };

  const reviewPermissions = async () => {
    const granted = await browser.permissions.getAll();
    const count = (granted.permissions?.length ?? 0) + (granted.origins?.length ?? 0);
    setPermissionMessage(t('permissionSummary', { count }));
  };

  return (
    <section className="surface-card">
      <p className="eyebrow">{t('productName')}</p>
      <h2>{t('privacyTitle')}</h2>
      <p className="muted">{t('privacyIntro')}</p>
      <ul className="privacy-list">
        <li>{t('privacyVisibleContent')}</li>
        <li>{t('privacyProvider')}</li>
        <li>{t('privacyContext')}</li>
        <li>{t('privacyLocalKeys')}</li>
        <li>{t('privacyNoCredentials')}</li>
      </ul>
      <div className="button-row">
        <button className="button button-primary" type="button" onClick={continueOnboarding}>
          {t('continue')}
        </button>
        <button className="button button-secondary" type="button" onClick={reviewPermissions}>
          {t('reviewPermissions')}
        </button>
        <button
          className="button button-secondary"
          type="button"
          onClick={() => void openOptions('privacy')}
        >
          {t('privacySettings')}
        </button>
      </div>
      {permissionMessage ? (
        <p className="popup-note" role="status">
          {permissionMessage}
        </p>
      ) : null}
    </section>
  );
}

const POPUP_SETTING_CATEGORIES: SettingCategory[] = [
  'layout',
  'font',
  'input',
  'timeline',
  'export',
  'prompt-manager',
  'prompt-rewrite',
  'privacy',
];

function PopupSettingRow({
  definition,
  settings,
  disabled,
  onUpdate,
}: {
  definition: SettingDefinition;
  settings: AppSettings;
  disabled: boolean;
  onUpdate: (value: SettingValue) => void;
}) {
  const t = useI18n();
  const value = definition.read(settings);
  return (
    <div className="popup-setting-row">
      <div className="popup-setting-copy">
        <h3>{t(definition.label)}</h3>
      </div>
      <div className="popup-setting-control">
        {definition.control === 'toggle' ? (
          <button
            className="switch"
            type="button"
            role="switch"
            aria-label={t(definition.label)}
            aria-checked={Boolean(value)}
            disabled={disabled}
            onClick={() => onUpdate(!value)}
          />
        ) : (
          <select
            aria-label={t(definition.label)}
            value={String(value)}
            disabled={disabled}
            onChange={(event) => onUpdate(event.target.value)}
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
  );
}

function QuickVisualEffects({
  value,
  disabled,
  onChange,
}: {
  value: VisualEffectMode;
  disabled: boolean;
  onChange: (effect: VisualEffectMode) => void;
}) {
  const t = useI18n();
  return (
    <section className="popup-effects-card" aria-labelledby="popup-effects-title">
      <div className="popup-effects-heading">
        <div>
          <p className="eyebrow">{t('popupQuickControl')}</p>
          <h2 id="popup-effects-title">{t('popupBackgroundEffects')}</h2>
        </div>
        <span className="popup-effects-live">{t('popupAppliesImmediately')}</span>
      </div>
      <p className="popup-effects-description">{t('popupBackgroundEffectsDescription')}</p>
      <div
        className="popup-effects-options"
        role="radiogroup"
        aria-label={t('popupBackgroundEffects')}
      >
        {QUICK_EFFECTS.map((effect) => (
          <button
            key={effect.value}
            className="popup-effect-option"
            type="button"
            role="radio"
            aria-checked={value === effect.value}
            data-effect={effect.value}
            disabled={disabled}
            onClick={() => onChange(effect.value)}
          >
            <span className="popup-effect-icon" aria-hidden="true">
              <QuickEffectIcon effect={effect.value} />
            </span>
            <span>{t(effect.label)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function QuickFormulaFormat({
  value,
  disabled,
  onChange,
}: {
  value: FormulaCopyFormat;
  disabled: boolean;
  onChange: (format: FormulaCopyFormat) => void;
}) {
  const t = useI18n();
  if (!FORMULA_FORMAT_DEFINITION) return null;

  return (
    <section className="popup-formula-card" aria-labelledby="popup-formula-format-title">
      <div className="popup-effects-heading">
        <div>
          <p className="eyebrow">{t('popupQuickControl')}</p>
          <h2 id="popup-formula-format-title">{t(FORMULA_FORMAT_DEFINITION.label)}</h2>
        </div>
        <span className="popup-effects-live">{t('popupAppliesImmediately')}</span>
      </div>
      <p className="popup-effects-description">{t(FORMULA_FORMAT_DEFINITION.description)}</p>
      <div
        className="popup-formula-options"
        role="radiogroup"
        aria-label={t(FORMULA_FORMAT_DEFINITION.label)}
      >
        {FORMULA_FORMAT_DEFINITION.options?.map((option) => {
          const format = String(option.value);
          if (!isFormulaCopyFormat(format)) return null;
          return (
            <button
              key={format}
              className="popup-formula-option"
              type="button"
              role="radio"
              aria-checked={value === format}
              disabled={disabled}
              onClick={() => onChange(format)}
            >
              <span className="popup-formula-symbol" aria-hidden="true">
                {FORMULA_FORMAT_SYMBOLS[format]}
              </span>
              <span>{t(option.label)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PopupSettings({
  settings,
  onChange,
}: {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
}) {
  const t = useI18n();
  const [busyId, setBusyId] = useState('');
  const [effectBusy, setEffectBusy] = useState(false);
  const [formulaFormatBusy, setFormulaFormatBusy] = useState(false);
  const [error, setError] = useState('');

  const update = async (definition: SettingDefinition, value: SettingValue) => {
    setBusyId(definition.id);
    try {
      onChange(await settingsRepository.set(definition.write(settings, value)));
      setError('');
    } catch {
      setError(t('saveError'));
    } finally {
      setBusyId('');
    }
  };

  const updateVisualEffect = async (effect: VisualEffectMode) => {
    if (effect === settings.ui.visualEffect) return;
    setEffectBusy(true);
    try {
      onChange(await settingsRepository.update({ ui: { visualEffect: effect } }));
      setError('');
    } catch {
      setError(t('saveError'));
    } finally {
      setEffectBusy(false);
    }
  };

  const updateFormulaFormat = async (format: FormulaCopyFormat) => {
    if (format === settings.markup.formulaCopyFormat || !FORMULA_FORMAT_DEFINITION) return;
    setFormulaFormatBusy(true);
    try {
      onChange(await settingsRepository.set(FORMULA_FORMAT_DEFINITION.write(settings, format)));
      setError('');
    } catch {
      setError(t('saveError'));
    } finally {
      setFormulaFormatBusy(false);
    }
  };

  return (
    <div className="popup-settings">
      <QuickVisualEffects
        value={settings.ui.visualEffect}
        disabled={effectBusy}
        onChange={(effect) => void updateVisualEffect(effect)}
      />
      <QuickFormulaFormat
        value={settings.markup.formulaCopyFormat}
        disabled={formulaFormatBusy}
        onChange={(format) => void updateFormulaFormat(format)}
      />
      <header className="popup-settings-header">
        <p className="eyebrow">{t('optionsTitle')}</p>
        <h2>{t('optionsTitle')}</h2>
        <p className="muted">{t('optionsSubtitle')}</p>
      </header>
      {error ? (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      ) : null}
      <div className="popup-settings-stack">
        {POPUP_SETTING_CATEGORIES.map((category) => {
          const definitions = SETTING_DEFINITIONS.filter(
            (definition) => definition.category === category,
          );
          if (!definitions.length) return null;
          return (
            <section className="popup-setting-section" key={category}>
              <h2>{t(CATEGORY_LABELS[category])}</h2>
              <div className="popup-setting-card">
                {definitions.map((definition) => (
                  <PopupSettingRow
                    key={definition.id}
                    definition={definition}
                    settings={settings}
                    disabled={busyId === definition.id}
                    onUpdate={(value) => void update(definition, value)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <div className="popup-settings-footer">
        <button className="button button-primary" type="button" onClick={() => void openOptions()}>
          {t('openFullSettings')}
        </button>
      </div>
    </div>
  );
}

function PopupContent({
  settings,
  onChange,
}: {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
}) {
  const t = useI18n();
  return (
    <main
      className={`popup-shell ${settings.privacy.onboardingComplete ? 'popup-settings-shell' : ''}`}
    >
      <div className="popup-brand">
        <BrandIcon className="brand-mark" />
        <h1>{t('productName')}</h1>
        <LanguageToggle
          locale={settings.locale}
          onChange={async (locale) => onChange(await settingsRepository.update({ locale }))}
        />
      </div>
      {settings.privacy.onboardingComplete ? (
        <PopupSettings settings={settings} onChange={onChange} />
      ) : (
        <PrivacyOnboarding onChange={onChange} />
      )}
    </main>
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
      {settings ? (
        <PopupContent settings={settings} onChange={setSettings} />
      ) : (
        <main className="popup-shell" />
      )}
    </I18nProvider>
  );
}
