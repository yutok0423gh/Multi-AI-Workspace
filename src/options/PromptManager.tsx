import { useEffect, useMemo, useRef, useState } from 'react';

import { useI18n } from '../shared/i18n/I18nContext';
import { promptRecordSchema } from '../shared/schemas/records';
import { WorkspaceDatabase } from '../shared/storage/indexedDb';
import type { PromptRecord } from '../shared/types/records';
import { insertPromptText, validatePromptTextFile } from './promptTextFile';

const database = new WorkspaceDatabase();

interface PromptForm {
  id?: string;
  title: string;
  content: string;
  description: string;
  tags: string;
}

const EMPTY_FORM: PromptForm = {
  title: '',
  content: '',
  description: '',
  tags: '',
};

function sortPrompts(records: PromptRecord[]): PromptRecord[] {
  return records.sort((left, right) => right.updatedAt - left.updatedAt);
}

function download(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function PromptManager() {
  const t = useI18n();
  const [prompts, setPrompts] = useState<PromptRecord[]>([]);
  const [form, setForm] = useState<PromptForm>(EMPTY_FORM);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const promptContentFileInput = useRef<HTMLInputElement>(null);
  const promptContentInput = useRef<HTMLTextAreaElement>(null);

  const load = async () => {
    setPrompts(sortPrompts(await database.getAll('prompts')));
  };

  useEffect(() => {
    let active = true;
    void database.getAll('prompts').then((records) => {
      if (active) setPrompts(sortPrompts(records));
    });
    return () => {
      active = false;
    };
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return prompts;
    return prompts.filter((prompt) =>
      [prompt.title, prompt.content, prompt.description, ...prompt.tags]
        .join('\n')
        .toLocaleLowerCase()
        .includes(needle),
    );
  }, [prompts, query]);

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      setError(t('promptRequiredFields'));
      return;
    }
    const now = Date.now();
    const existing = form.id ? await database.get('prompts', form.id) : undefined;
    const record: PromptRecord = {
      id: form.id ?? crypto.randomUUID(),
      scope: existing?.scope ?? 'global',
      platformId: existing?.platformId ?? null,
      accountScopeId: existing?.accountScopeId ?? null,
      title: form.title.trim(),
      content: form.content,
      description: form.description.trim(),
      tags: [
        ...new Set(
          form.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      ],
      folderId: existing?.folderId ?? null,
      usageCount: existing?.usageCount ?? 0,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await database.put('prompts', record);
    setForm(EMPTY_FORM);
    setError('');
    setNotice(t('promptSaved'));
    await load();
  };

  const edit = (prompt: PromptRecord) =>
    setForm({
      id: prompt.id,
      title: prompt.title,
      content: prompt.content,
      description: prompt.description,
      tags: prompt.tags.join(', '),
    });

  const remove = async (id: string) => {
    if (!confirm(t('promptDeleteConfirm'))) return;
    await database.delete('prompts', id);
    if (form.id === id) setForm(EMPTY_FORM);
    await load();
  };

  const importPrompts = async (file: File) => {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!Array.isArray(parsed)) throw new Error(t('promptImportInvalid'));
      const validated = parsed.map((entry) => promptRecordSchema.safeParse(entry));
      if (validated.some((result) => !result.success)) throw new Error(t('promptImportInvalid'));
      const records = validated.flatMap((result) => (result.success ? [result.data] : []));
      for (const record of records) {
        const existing = await database.get('prompts', record.id);
        await database.put('prompts', {
          ...record,
          createdAt: existing?.createdAt ?? record.createdAt ?? Date.now(),
          updatedAt: Date.now(),
          tags: Array.isArray(record.tags)
            ? record.tags.filter((tag) => typeof tag === 'string')
            : [],
        });
      }
      await load();
      setNotice(t('promptImportComplete', { count: records.length }));
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('promptImportInvalid'));
    }
  };

  const insertPromptFile = async (file: File) => {
    const validationError = validatePromptTextFile(file);
    if (validationError) {
      setNotice('');
      setError(
        validationError === 'too-large' ? t('promptFileTooLarge') : t('promptFileUnsupported'),
      );
      return;
    }

    const textarea = promptContentInput.current;
    const selectionStart = textarea?.selectionStart ?? form.content.length;
    const selectionEnd = textarea?.selectionEnd ?? selectionStart;

    try {
      const fileContent = (await file.text()).replace(/^\uFEFF/, '');
      if (!fileContent) {
        setNotice('');
        setError(t('promptFileEmpty'));
        return;
      }

      const insertion = insertPromptText(form.content, fileContent, selectionStart, selectionEnd);
      setForm((current) => ({ ...current, content: insertion.content }));
      setError('');
      setNotice(t('promptFileInserted', { name: file.name }));
      requestAnimationFrame(() => {
        promptContentInput.current?.focus();
        promptContentInput.current?.setSelectionRange(insertion.caret, insertion.caret);
      });
    } catch {
      setNotice('');
      setError(t('promptFileReadFailed'));
    }
  };

  return (
    <div className="settings-stack">
      {notice ? <div className="notice">{notice}</div> : null}
      {error ? <div className="notice notice-error">{error}</div> : null}
      <article className="setting-card workspace-card">
        <h2>{form.id ? t('editPrompt') : t('newPrompt')}</h2>
        <p className="setting-description">{t('promptVariablesHelp')}</p>
        <div className="form-grid two-columns">
          <label>
            <span>{t('promptTitle')}</span>
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </label>
          <label>
            <span>{t('promptTags')}</span>
            <input
              value={form.tags}
              onChange={(event) => setForm({ ...form, tags: event.target.value })}
            />
          </label>
          <label className="wide-field">
            <span>{t('promptDescription')}</span>
            <input
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </label>
          <div className="wide-field prompt-content-field">
            <div className="prompt-content-heading">
              <label htmlFor="prompt-manager-content">{t('promptContent')}</label>
              <button
                className="prompt-file-button"
                type="button"
                onClick={() => promptContentFileInput.current?.click()}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path d="M14 3H7.75A2.75 2.75 0 0 0 5 5.75v12.5A2.75 2.75 0 0 0 7.75 21h8.5A2.75 2.75 0 0 0 19 18.25V8l-5-5Z" />
                  <path d="M14 3v5h5M9 13h6M9 17h4" />
                </svg>
                {t('promptInsertFile')}
              </button>
            </div>
            <textarea
              id="prompt-manager-content"
              ref={promptContentInput}
              aria-describedby="prompt-file-help"
              rows={9}
              value={form.content}
              onChange={(event) => setForm({ ...form, content: event.target.value })}
            />
            <p className="prompt-file-help" id="prompt-file-help">
              {t('promptInsertFileHelp')}
            </p>
            <input
              ref={promptContentFileInput}
              hidden
              type="file"
              accept=".md,.markdown,.txt,text/markdown,text/plain"
              aria-label={t('promptInsertFile')}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void insertPromptFile(file);
                event.target.value = '';
              }}
            />
          </div>
        </div>
        <div className="button-row">
          <button className="button button-primary" type="button" onClick={() => void save()}>
            {t('savePrompt')}
          </button>
          {form.id ? (
            <button
              className="button button-secondary"
              type="button"
              onClick={() => setForm(EMPTY_FORM)}
            >
              {t('cancel')}
            </button>
          ) : null}
        </div>
      </article>
      <article className="setting-card action-card prompt-tools">
        <input
          className="search-input"
          type="search"
          placeholder={t('searchPrompts')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="button-row">
          <button
            className="button button-secondary"
            type="button"
            onClick={() =>
              download('multi-ai-prompts.json', `${JSON.stringify(prompts, null, 2)}\n`)
            }
          >
            {t('exportPrompts')}
          </button>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => fileInput.current?.click()}
          >
            {t('importPrompts')}
          </button>
          <input
            ref={fileInput}
            hidden
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importPrompts(file);
              event.target.value = '';
            }}
          />
        </div>
      </article>
      <div className="card-grid">
        {visible.map((prompt) => (
          <article className="setting-card compact-card" key={prompt.id}>
            <h2>{prompt.title}</h2>
            {prompt.description ? <p className="muted">{prompt.description}</p> : null}
            <pre className="prompt-preview">{prompt.content}</pre>
            <div className="tag-row">
              {prompt.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <div className="button-row">
              <button className="text-button" type="button" onClick={() => edit(prompt)}>
                {t('edit')}
              </button>
              <button
                className="text-button"
                type="button"
                onClick={() => void navigator.clipboard.writeText(prompt.content)}
              >
                {t('copy')}
              </button>
              <button
                className="text-button danger-text"
                type="button"
                onClick={() => void remove(prompt.id)}
              >
                {t('delete')}
              </button>
            </div>
          </article>
        ))}
      </div>
      {visible.length === 0 ? <div className="empty-state">{t('noPrompts')}</div> : null}
    </div>
  );
}
