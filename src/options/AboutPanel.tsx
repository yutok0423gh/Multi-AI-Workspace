import browser from 'webextension-polyfill';

import chatgptIcon from '../assets/platforms/chatgpt.svg';
import claudeIcon from '../assets/platforms/claude.ico';
import deepseekIcon from '../assets/platforms/deepseek.ico';
import geminiIcon from '../assets/platforms/gemini.svg';
import grokIcon from '../assets/platforms/grok.svg';
import kimiIcon from '../assets/platforms/kimi.ico';
import { shouldShowExtensionTimeline } from '../platforms/nativeFeatures';
import { SUPPORTED_PLATFORMS } from '../shared/constants/platforms';
import { useI18n } from '../shared/i18n/I18nContext';
import { BrandIcon } from '../ui/components/BrandIcon';

const PLATFORM_ICONS: Record<(typeof SUPPORTED_PLATFORMS)[number]['id'], string> = {
  chatgpt: chatgptIcon,
  claude: claudeIcon,
  gemini: geminiIcon,
  deepseek: deepseekIcon,
  grok: grokIcon,
  kimi: kimiIcon,
};

export function AboutPanel({ onOpenCategory }: { onOpenCategory: (category: 'privacy') => void }) {
  const t = useI18n();
  const version = browser.runtime.getManifest().version;

  return (
    <div className="settings-stack about-page">
      <article className="setting-card about-hero">
        <BrandIcon className="brand-mark about-brand-mark" />
        <div className="about-hero-copy">
          <p className="eyebrow">{t('categoryAbout')}</p>
          <h2>{t('productName')}</h2>
          <p className="setting-description">{t('aboutDescription')}</p>
        </div>
        <span className="about-version">{t('version', { version })}</span>
      </article>

      <article className="setting-card about-section">
        <div className="about-section-heading">
          <div>
            <h2>{t('aboutSupportedWebsites')}</h2>
            <p className="setting-description">
              {t('aboutSupportedWebsitesDescription', { count: SUPPORTED_PLATFORMS.length })}
            </p>
          </div>
          <span className="about-count" aria-label={t('aboutWebsiteCountLabel')}>
            {SUPPORTED_PLATFORMS.length}
          </span>
        </div>
        <div className="about-platform-grid">
          {SUPPORTED_PLATFORMS.map((platform) => (
            <a
              className="about-platform-card"
              href={`https://${platform.hostname}/`}
              key={platform.id}
              rel="noreferrer"
              target="_blank"
            >
              <span className="about-platform-icon-frame" aria-hidden="true">
                <img src={PLATFORM_ICONS[platform.id]} alt="" />
              </span>
              <span className="about-platform-copy">
                <strong>{platform.label}</strong>
                <small>{platform.hostname}</small>
              </span>
              <span className="about-support-badge">{t('aboutBuiltInSupport')}</span>
              <span className="about-platform-note">
                {t(
                  shouldShowExtensionTimeline(platform.id)
                    ? 'aboutExtensionNavigator'
                    : 'aboutTimelineUnavailable',
                )}
              </span>
            </a>
          ))}
        </div>
      </article>

      <article className="setting-card about-section">
        <div className="about-section-heading">
          <div>
            <h2>{t('aboutBasicInformation')}</h2>
            <p className="setting-description">{t('aboutBasicInformationDescription')}</p>
          </div>
        </div>
        <dl className="about-facts-grid">
          <div>
            <dt>{t('aboutVersionLabel')}</dt>
            <dd>{version}</dd>
          </div>
          <div>
            <dt>{t('aboutBrowserBuilds')}</dt>
            <dd>{t('aboutBrowserBuildsValue')}</dd>
          </div>
          <div>
            <dt>{t('aboutInterfaceLanguages')}</dt>
            <dd>{t('aboutInterfaceLanguagesValue')}</dd>
          </div>
          <div>
            <dt>{t('aboutConnectionModel')}</dt>
            <dd>{t('aboutConnectionModelValue')}</dd>
          </div>
          <div>
            <dt>{t('aboutDataModel')}</dt>
            <dd>{t('aboutDataModelValue')}</dd>
          </div>
          <div>
            <dt>{t('aboutProviderModel')}</dt>
            <dd>{t('aboutProviderModelValue')}</dd>
          </div>
        </dl>
      </article>

      <article className="setting-card about-section about-privacy-card">
        <div>
          <h2>{t('aboutPrivacyTitle')}</h2>
          <p className="setting-description">{t('aboutPrivacyDescription')}</p>
        </div>
        <ul className="about-privacy-list">
          <li>{t('privacyLocalKeys')}</li>
          <li>{t('privacyNoCredentials')}</li>
        </ul>
        <button
          className="button button-secondary"
          type="button"
          onClick={() => onOpenCategory('privacy')}
        >
          {t('privacySettings')}
        </button>
      </article>
    </div>
  );
}
