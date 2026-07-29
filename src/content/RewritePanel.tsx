import { useEffect, useState } from 'react';

import type { UserBoundPlatformAdapter } from '../platforms/base/UserBoundPlatformAdapter';
import { REWRITE_MODES, type PromptRewriteResult, type RewriteMode } from '../shared/ai/types';
import { useI18n } from '../shared/i18n/I18nContext';
import type { ApiProfileMetadataRecord, PromptRecord } from '../shared/types/records';
import { putRecord } from './database';
import { sendContentRequest } from './runtime';

export function RewritePanel({
  adapter,
  allowContext,
  initialText = '',
}: {
  adapter: UserBoundPlatformAdapter;
  allowContext: boolean;
  initialText?: string;
}) {
  const t = useI18n();
  const [profiles, setProfiles] = useState<ApiProfileMetadataRecord[]>([]);
  const [profileId, setProfileId] = useState('');
  const [original, setOriginal] = useState(initialText);
  const [mode, setMode] = useState<RewriteMode>('general');
  const [customInstruction, setCustomInstruction] = useState('');
  const [result, setResult] = useState<PromptRewriteResult | null>(null);
  const [includeContext, setIncludeContext] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void sendContentRequest({ type: 'provider.list' })
      .then((response) => {
        const next = (response.profiles ?? []).map(({ profile }) => profile);
        setProfiles(next);
        setProfileId(next[0]?.id ?? '');
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : t('requestFailed')),
      );
    if (!initialText.trim() && adapter.getCapabilities().has('composer.read')) {
      void adapter.readComposer().then(setOriginal);
    }
  }, [adapter, initialText, t]);

  const openProviderSettings = async () => {
    try {
      await sendContentRequest({ type: 'options.open', section: 'ai-provider' });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('requestFailed'));
    }
  };

  const rewrite = async () => {
    if (!profileId) {
      setError(t('selectProviderFirst'));
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (includeContext && !confirm(t('contextSendConfirm'))) {
        setBusy(false);
        return;
      }
      const messages =
        includeContext && adapter.getCapabilities().has('messages.read')
          ? (await adapter.getMessages())
              .filter(
                (message): message is typeof message & { role: 'user' | 'assistant' } =>
                  message.role === 'user' || message.role === 'assistant',
              )
              .slice(-10)
              .map((message) => ({
                role: message.role,
                content: message.plainText,
              }))
          : [];
      const response = await sendContentRequest({
        type: 'prompt.rewrite',
        profileId,
        request: {
          originalPrompt: original,
          mode,
          customInstruction: mode === 'custom' ? customInstruction : undefined,
          platformId: adapter.id,
          includeConversationContext: includeContext,
          contextMessages: messages,
          outputLanguage: 'preserve',
        },
      });
      setResult(response.rewrite ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('requestFailed'));
    } finally {
      setBusy(false);
    }
  };

  const apply = async (writeMode: 'replace' | 'insert-at-cursor' | 'append') => {
    if (!result) return;
    await adapter.writeComposer(result.rewrittenPrompt, { mode: writeMode, focus: true });
    setNotice(t('rewriteApplied'));
  };

  const save = async () => {
    if (!result) return;
    const now = Date.now();
    const record: PromptRecord = {
      id: crypto.randomUUID(),
      scope: 'global',
      platformId: null,
      accountScopeId: null,
      title: result.rewrittenPrompt.slice(0, 60) || t('untitledPrompt'),
      content: result.rewrittenPrompt,
      description: result.summaryOfChanges.join(' '),
      tags: ['rewrite', adapter.id],
      folderId: null,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await putRecord('prompts', record);
    setNotice(t('promptSaved'));
  };

  return (
    <div className="maw-feature-stack">
      {notice ? <div className="maw-notice">{notice}</div> : null}
      {error ? <div className="maw-error">{error}</div> : null}
      {profiles.length ? (
        <label className="maw-field">
          <span>{t('providerProfile')}</span>
          <select value={profileId} onChange={(event) => setProfileId(event.target.value)}>
            <option value="">{t('chooseProvider')}</option>
            {profiles.map((profile) => (
              <option value={profile.id} key={profile.id}>
                {profile.name} · {profile.model}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <section className="maw-provider-empty">
          <strong>{t('noProviderConfiguredTitle')}</strong>
          <p>{t('noProviderConfiguredDescription')}</p>
          <button type="button" onClick={() => void openProviderSettings()}>
            {t('configureProvider')}
          </button>
        </section>
      )}
      <div className="maw-two-fields">
        <label className="maw-field">
          <span>{t('rewriteMode')}</span>
          <select value={mode} onChange={(event) => setMode(event.target.value as RewriteMode)}>
            {REWRITE_MODES.map((entry) => (
              <option key={entry}>{entry}</option>
            ))}
          </select>
        </label>
        <button
          className="maw-button secondary"
          type="button"
          onClick={() => void adapter.readComposer().then(setOriginal)}
          disabled={!adapter.getCapabilities().has('composer.read')}
        >
          {t('loadComposer')}
        </button>
      </div>
      {mode === 'custom' ? (
        <label className="maw-field">
          <span>{t('customInstruction')}</span>
          <input
            value={customInstruction}
            onChange={(event) => setCustomInstruction(event.target.value)}
          />
        </label>
      ) : null}
      <label className="maw-field">
        <span>{t('originalPrompt')}</span>
        <textarea rows={7} value={original} onChange={(event) => setOriginal(event.target.value)} />
      </label>
      <label className="maw-check">
        <input
          type="checkbox"
          checked={includeContext}
          disabled={!allowContext || !adapter.getCapabilities().has('messages.read')}
          onChange={(event) => setIncludeContext(event.target.checked)}
        />
        <span>{t('includeContextThisTime')}</span>
      </label>
      <button
        className="maw-button primary"
        type="button"
        disabled={busy || !original.trim() || !profileId}
        onClick={() => void rewrite()}
      >
        {busy ? t('rewriting') : t('rewritePrompt')}
      </button>
      {result ? (
        <section className="maw-result">
          <label className="maw-field">
            <span>{t('rewriteResult')}</span>
            <textarea
              rows={8}
              value={result.rewrittenPrompt}
              onChange={(event) => setResult({ ...result, rewrittenPrompt: event.target.value })}
            />
          </label>
          {result.summaryOfChanges.length ? (
            <ul>
              {result.summaryOfChanges.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          <div className="maw-actions">
            <button type="button" onClick={() => void apply('replace')}>
              {t('replaceComposer')}
            </button>
            <button type="button" onClick={() => void apply('insert-at-cursor')}>
              {t('insertAtCursor')}
            </button>
            <button type="button" onClick={() => void apply('append')}>
              {t('appendComposer')}
            </button>
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(result.rewrittenPrompt)}
            >
              {t('copy')}
            </button>
            <button type="button" onClick={() => void save()}>
              {t('savePrompt')}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
