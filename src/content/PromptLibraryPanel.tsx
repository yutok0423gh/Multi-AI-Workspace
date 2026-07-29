import { useEffect, useMemo, useState } from 'react';

import type { UserBoundPlatformAdapter } from '../platforms/base/UserBoundPlatformAdapter';
import { useI18n } from '../shared/i18n/I18nContext';
import type { PromptRecord } from '../shared/types/records';
import { listRecords, putRecord } from './database';
import { sendContentRequest } from './runtime';

const currentTimestamp = () => Date.now();

async function expandVariables(
  content: string,
  adapter: UserBoundPlatformAdapter,
): Promise<string> {
  const selection = window.getSelection()?.toString().slice(0, 5000) ?? '';
  let clipboard = '';
  if (content.includes('{{clipboard}}')) {
    try {
      clipboard = await navigator.clipboard.readText();
    } catch {
      clipboard = '';
    }
  }
  const conversation = await adapter.getCurrentConversation();
  const variables: Record<string, string> = {
    selection,
    clipboard,
    platform: adapter.id,
    conversationTitle: conversation.title ?? '',
    date: new Date().toISOString().slice(0, 10),
  };
  return content.replace(
    /\{\{(selection|clipboard|platform|conversationTitle|date)\}\}/g,
    (_, key: string) => variables[key] ?? '',
  );
}

export function PromptLibraryPanel({
  adapter,
  onInserted,
}: {
  adapter: UserBoundPlatformAdapter;
  onInserted?: () => void;
}) {
  const t = useI18n();
  const [prompts, setPrompts] = useState<PromptRecord[]>([]);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');

  const load = () =>
    void listRecords('prompts').then((records) =>
      setPrompts(records.sort((left, right) => right.updatedAt - left.updatedAt)),
    );
  useEffect(load, []);

  const visible = useMemo(() => {
    const needle = query.toLocaleLowerCase();
    return prompts.filter((prompt) =>
      `${prompt.title}\n${prompt.content}\n${prompt.tags.join(' ')}`
        .toLocaleLowerCase()
        .includes(needle),
    );
  }, [prompts, query]);

  const insert = async (prompt: PromptRecord) => {
    const content = await expandVariables(prompt.content, adapter);
    await adapter.writeComposer(content, { mode: 'insert-at-cursor', focus: true });
    await putRecord('prompts', {
      ...prompt,
      usageCount: prompt.usageCount + 1,
      updatedAt: currentTimestamp(),
    });
    setNotice(t('promptInserted'));
    load();
    onInserted?.();
  };

  const quote = async () => {
    const selected = window.getSelection()?.toString().trim().slice(0, 5000) ?? '';
    if (!selected) {
      setNotice(t('selectTextFirst'));
      return;
    }
    const quoted = `${selected
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n')}\n\n`;
    await adapter.writeComposer(quoted, { mode: 'insert-at-cursor', focus: true });
    setNotice(t('quoteInserted'));
  };

  return (
    <div className="maw-feature-stack">
      {notice ? <div className="maw-notice">{notice}</div> : null}
      <div className="maw-two-fields">
        <input
          type="search"
          placeholder={t('searchPrompts')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button className="maw-button secondary" type="button" onClick={() => void quote()}>
          {t('quoteSelection')}
        </button>
      </div>
      <div className="maw-list">
        {visible.map((prompt) => (
          <article key={prompt.id}>
            <div>
              <strong>{prompt.title}</strong>
              <span>{prompt.tags.join(' · ')}</span>
            </div>
            <p>{prompt.content}</p>
            <button
              type="button"
              disabled={!adapter.getCapabilities().has('composer.write')}
              onClick={() => void insert(prompt)}
            >
              {t('insertPrompt')}
            </button>
          </article>
        ))}
      </div>
      {visible.length === 0 ? <div className="maw-empty">{t('noPrompts')}</div> : null}
      <button
        className="maw-text"
        type="button"
        onClick={() => void sendContentRequest({ type: 'options.open', section: 'prompt-manager' })}
      >
        {t('openPromptManager')}
      </button>
    </div>
  );
}
