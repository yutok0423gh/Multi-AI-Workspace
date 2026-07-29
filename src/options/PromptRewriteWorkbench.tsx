import { useEffect, useState } from 'react';

import { REWRITE_MODES, type PromptRewriteResult, type RewriteMode } from '../shared/ai/types';
import { useI18n } from '../shared/i18n/I18nContext';
import { WorkspaceDatabase } from '../shared/storage/indexedDb';
import type { ApiProfileMetadataRecord, PromptRecord } from '../shared/types/records';
import { sendRuntimeRequest } from './runtime';

const database = new WorkspaceDatabase();

export function PromptRewriteWorkbench({
  onConfigureProvider,
  providerRevision = 0,
}: {
  onConfigureProvider: () => void;
  providerRevision?: number;
}) {
  const t = useI18n();
  const [profiles, setProfiles] = useState<ApiProfileMetadataRecord[]>([]);
  const [profileId, setProfileId] = useState('');
  const [originalPrompt, setOriginalPrompt] = useState('');
  const [mode, setMode] = useState<RewriteMode>('general');
  const [customInstruction, setCustomInstruction] = useState('');
  const [outputLanguage, setOutputLanguage] = useState<'preserve' | 'en' | 'zh-CN'>('preserve');
  const [result, setResult] = useState<PromptRewriteResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void sendRuntimeRequest({ type: 'provider.list' })
      .then((response) => {
        const next = (response.profiles ?? []).map(({ profile }) => profile);
        setProfiles(next);
        setProfileId((current) =>
          next.some((profile) => profile.id === current) ? current : (next[0]?.id ?? ''),
        );
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : t('requestFailed')),
      );
  }, [providerRevision, t]);

  const rewrite = async () => {
    if (!profileId) {
      setError(t('selectProviderFirst'));
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await sendRuntimeRequest({
        type: 'prompt.rewrite',
        profileId,
        request: {
          originalPrompt,
          mode,
          customInstruction: mode === 'custom' ? customInstruction : undefined,
          platformId: 'custom',
          includeConversationContext: false,
          contextMessages: [],
          outputLanguage,
        },
      });
      setResult(response.rewrite ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('requestFailed'));
    } finally {
      setBusy(false);
    }
  };

  const savePrompt = async () => {
    if (!result) return;
    const now = Date.now();
    const prompt: PromptRecord = {
      id: crypto.randomUUID(),
      scope: 'global',
      platformId: null,
      accountScopeId: null,
      title: result.rewrittenPrompt.slice(0, 60) || t('untitledPrompt'),
      content: result.rewrittenPrompt,
      description: result.summaryOfChanges.join(' '),
      tags: ['rewrite'],
      folderId: null,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await database.put('prompts', prompt);
    setNotice(t('promptSaved'));
  };

  return (
    <div className="settings-stack">
      {notice ? <div className="notice">{notice}</div> : null}
      {error ? <div className="notice notice-error">{error}</div> : null}
      {profiles.length === 0 ? (
        <article className="setting-card action-card">
          <div>
            <h2>{t('noProviderConfiguredTitle')}</h2>
            <p className="setting-description">{t('noProviderConfiguredDescription')}</p>
          </div>
          <button className="button button-primary" type="button" onClick={onConfigureProvider}>
            {t('configureProvider')}
          </button>
        </article>
      ) : null}
      <article className="setting-card workspace-card">
        <div className="form-grid two-columns">
          {profiles.length ? (
            <label>
              <span>{t('providerProfile')}</span>
              <select value={profileId} onChange={(event) => setProfileId(event.target.value)}>
                <option value="">{t('chooseProvider')}</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} · {profile.model}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            <span>{t('rewriteMode')}</span>
            <select value={mode} onChange={(event) => setMode(event.target.value as RewriteMode)}>
              {REWRITE_MODES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t('outputLanguage')}</span>
            <select
              value={outputLanguage}
              onChange={(event) =>
                setOutputLanguage(event.target.value as 'preserve' | 'en' | 'zh-CN')
              }
            >
              <option value="preserve">{t('preserveLanguage')}</option>
              <option value="zh-CN">简体中文</option>
              <option value="en">English</option>
            </select>
          </label>
          {mode === 'custom' ? (
            <label>
              <span>{t('customInstruction')}</span>
              <input
                value={customInstruction}
                onChange={(event) => setCustomInstruction(event.target.value)}
              />
            </label>
          ) : null}
          <label className="wide-field">
            <span>{t('originalPrompt')}</span>
            <textarea
              rows={10}
              value={originalPrompt}
              onChange={(event) => setOriginalPrompt(event.target.value)}
            />
          </label>
        </div>
        <button
          className="button button-primary"
          type="button"
          disabled={busy || !originalPrompt.trim() || !profileId}
          onClick={() => void rewrite()}
        >
          {busy ? t('rewriting') : t('rewritePrompt')}
        </button>
      </article>
      {result ? (
        <article className="setting-card workspace-card">
          <h2>{t('rewriteResult')}</h2>
          <div className="diff-grid">
            <label>
              <span>{t('before')}</span>
              <textarea rows={12} readOnly value={originalPrompt} />
            </label>
            <label>
              <span>{t('after')}</span>
              <textarea
                rows={12}
                value={result.rewrittenPrompt}
                onChange={(event) => setResult({ ...result, rewrittenPrompt: event.target.value })}
              />
            </label>
          </div>
          <div className="result-summary">
            <strong>{t('changes')}</strong>
            <ul>
              {result.summaryOfChanges.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="button-row">
            <button
              className="button button-secondary"
              type="button"
              onClick={() => void navigator.clipboard.writeText(result.rewrittenPrompt)}
            >
              {t('copy')}
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => void savePrompt()}
            >
              {t('saveToPromptManager')}
            </button>
            <button className="text-button" type="button" onClick={() => setResult(null)}>
              {t('cancel')}
            </button>
          </div>
        </article>
      ) : null}
    </div>
  );
}
