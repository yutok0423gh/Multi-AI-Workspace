import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { UserBoundPlatformAdapter } from '../platforms/base/UserBoundPlatformAdapter';
import { useI18n } from '../shared/i18n/I18nContext';
import type {
  ConversationBranchDelivery,
  ConversationBranchGroup,
  ConversationBranchHandoff,
} from '../shared/types/conversationBranch';
import type { PlatformId, PlatformMessage } from '../shared/types/platform';
import {
  isConversationBranchGroup,
  isConversationBranchHandoff,
  isConversationBranchPreparation,
} from '../shared/utils/conversationBranch';
import {
  BRANCH_DIRECT_CONTEXT_MAX_CHARACTERS,
  buildConversationBranchDraft,
  type ConversationBranchDraft,
  downloadConversationBranchMarkdown,
} from './conversationBranches';
import { sendContentRequest } from './runtime';
import { isExtensionContextUnavailable } from '../shared/runtime/sendRuntimeRequest';

const BRANCH_GROUP_EVENT = 'multi-ai-workspace:conversation-branch-group';
const HANDOFF_FETCH_RETRY_DELAYS = [120, 250, 500, 1_000, 1_500, 2_500, 4_000] as const;
const HANDOFF_APPLY_RETRY_DELAYS = [180, 350, 700, 1_200, 2_000, 3_000, 4_000, 5_000] as const;
const COMPOSER_CONFIRMATION_DELAYS = [0, 80, 220] as const;

interface BranchButtonPosition {
  key: string;
  message: PlatformMessage;
  top: number;
  left: number;
}

async function copyText(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
}

function announceBranchGroup(group: ConversationBranchGroup): void {
  window.dispatchEvent(new CustomEvent(BRANCH_GROUP_EVENT, { detail: group }));
}

function composerContains(current: string, expected: string): boolean {
  if (current.includes(expected)) return true;
  const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
  const normalizedExpected = normalize(expected);
  return Boolean(normalizedExpected) && normalize(current).includes(normalizedExpected);
}

function branchErrorMessage(reason: unknown, fallback: string, reloadRequired: string): string {
  if (isExtensionContextUnavailable(reason)) return reloadRequired;
  return reason instanceof Error && reason.message !== 'BRANCH_PREPARATION_INVALID'
    ? reason.message
    : fallback;
}

async function confirmComposerContent(
  adapter: UserBoundPlatformAdapter,
  expected: string,
): Promise<boolean> {
  for (const delay of COMPOSER_CONFIRMATION_DELAYS) {
    if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay));
    const current = await adapter.readComposer();
    if (composerContains(current, expected)) return true;
  }
  return false;
}

export type ConversationBranchDraftPreparation =
  { method: 'native' } | { method: 'manual'; draft: ConversationBranchDraft };

export async function prepareConversationBranch(
  adapter: UserBoundPlatformAdapter,
  messages: PlatformMessage[],
  message: PlatformMessage,
  configuredModel: string | null,
): Promise<ConversationBranchDraftPreparation> {
  const result = await adapter.forkConversation(message);
  if (result.method === 'native') return { method: 'native' };

  const conversation = await adapter.getCurrentConversation();
  const selectedModel = (await adapter.getSelectedModel?.()) || configuredModel;
  return {
    method: 'manual',
    draft: buildConversationBranchDraft(messages, message, conversation, selectedModel),
  };
}

export async function openConversationBranch(
  draft: ConversationBranchDraft,
  delivery: ConversationBranchDelivery,
): Promise<void> {
  let preparedBranchId = '';
  try {
    const preparationResponse = await sendContentRequest({
      type: 'conversationBranch.prepare',
      transfer: draft,
      preferredMethod: 'manual',
    });
    if (!isConversationBranchPreparation(preparationResponse.value)) {
      throw new Error('BRANCH_PREPARATION_INVALID');
    }
    const preparation = preparationResponse.value;
    preparedBranchId = preparation.branch.id;
    announceBranchGroup(preparation.group);

    const fileName = delivery === 'markdown' ? downloadConversationBranchMarkdown(draft) : null;
    await sendContentRequest({
      type: 'conversationBranch.open',
      branchId: preparedBranchId,
      transfer: draft,
      delivery,
      fileName,
    });
    if (preparation.branch.parentBranchId) {
      announceBranchGroup({
        ...preparation.group,
        currentBranchId: preparation.branch.parentBranchId,
      });
    }
  } catch (error) {
    if (preparedBranchId) {
      await sendContentRequest({
        type: 'conversationBranch.cancel',
        branchId: preparedBranchId,
      }).catch(() => undefined);
    }
    throw error;
  }
}

export function ConversationBranchPreviewDialog({
  draft,
  busy,
  error,
  onClose,
  onOpen,
}: {
  draft: ConversationBranchDraft;
  busy: boolean;
  error: string;
  onClose: () => void;
  onOpen: (delivery: ConversationBranchDelivery) => void;
}) {
  const t = useI18n();
  const [copied, setCopied] = useState(false);
  const directAvailable = draft.context.length <= BRANCH_DIRECT_CONTEXT_MAX_CHARACTERS;

  const copy = async () => {
    try {
      await copyText(draft.context);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="maw-branch-preview-backdrop" role="presentation">
      <section
        className="maw-branch-preview"
        role="dialog"
        aria-modal="true"
        aria-labelledby="maw-branch-preview-title"
      >
        <header>
          <div>
            <span>{t('branchConversation')}</span>
            <strong id="maw-branch-preview-title">{t('branchPreviewTitle')}</strong>
          </div>
          <button type="button" aria-label={t('close')} disabled={busy} onClick={onClose}>
            ×
          </button>
        </header>
        <p className="maw-branch-preview-description">{t('branchPreviewDescription')}</p>
        <div className="maw-branch-meta">
          <div>
            <span>{t('branchSource')}</span>
            <strong>{draft.sourceTitle ?? draft.sourceUrl}</strong>
          </div>
          <div>
            <span>{t('branchPoint')}</span>
            <strong>{draft.branchPoint}</strong>
          </div>
          <div>
            <span>{t('branchContextLength')}</span>
            <strong>{draft.context.length.toLocaleString()}</strong>
          </div>
        </div>
        <label className="maw-branch-context-preview">
          <span>{t('branchContextPreview')}</span>
          <textarea readOnly value={draft.context} />
        </label>
        {!directAvailable ? (
          <div className="maw-branch-preview-warning">{t('branchContextWarning')}</div>
        ) : null}
        {error ? (
          <div className="maw-error" role="alert">
            {error}
          </div>
        ) : null}
        <footer>
          <button type="button" disabled={busy} onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="button" disabled={busy} onClick={() => void copy()}>
            {t(copied ? 'branchContextCopied' : 'copyBranchContext')}
          </button>
          <button
            type="button"
            disabled={busy || !directAvailable}
            title={!directAvailable ? t('branchDirectUnavailable') : undefined}
            onClick={() => onOpen('direct')}
          >
            {t('openBranchDirect')}
          </button>
          <button
            className="primary"
            type="button"
            disabled={busy}
            onClick={() => onOpen('markdown')}
          >
            {t('downloadBranchMarkdown')}
          </button>
        </footer>
      </section>
    </div>
  );
}

export function ConversationBranchControls({
  adapter,
  messages,
  configuredModel,
}: {
  adapter: UserBoundPlatformAdapter;
  messages: PlatformMessage[];
  configuredModel: string | null;
}) {
  const t = useI18n();
  const [positions, setPositions] = useState<BranchButtonPosition[]>([]);
  const [busyKey, setBusyKey] = useState('');
  const [draft, setDraft] = useState<ConversationBranchDraft | null>(null);
  const [dialogBusy, setDialogBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const branchableMessages = useMemo(
    () => messages.filter(({ role }) => role === 'user' || role === 'assistant'),
    [messages],
  );

  useEffect(() => {
    if (!status) return undefined;
    const timer = window.setTimeout(() => setStatus(''), 4_000);
    return () => window.clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      const next = branchableMessages.flatMap((message) => {
        if (!message.element.isConnected) return [];
        const rect = message.element.getBoundingClientRect();
        if (
          rect.width <= 0 ||
          rect.height <= 0 ||
          rect.bottom < 0 ||
          rect.top > window.innerHeight
        ) {
          return [];
        }
        const preferredLeft = rect.right + 8;
        const left = Math.max(
          8,
          Math.min(
            window.innerWidth - 38,
            preferredLeft <= window.innerWidth - 38 ? preferredLeft : rect.right - 32,
          ),
        );
        return [
          {
            key: `${message.runtimeMessageId}:${message.order}`,
            message,
            top: Math.max(8, Math.min(window.innerHeight - 34, rect.top + 8)),
            left,
          },
        ];
      });
      setPositions(next);
    };
    const schedule = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
    };
  }, [branchableMessages]);

  const createBranch = async (message: PlatformMessage) => {
    const key = `${message.runtimeMessageId}:${message.order}`;
    try {
      setBusyKey(key);
      setError('');
      setStatus(t('branchCreating'));
      const preparation = await prepareConversationBranch(
        adapter,
        messages,
        message,
        configuredModel,
      );
      if (preparation.method === 'native') {
        setStatus(t('branchNativeOpened'));
      } else {
        setDraft(preparation.draft);
        setStatus('');
      }
    } catch (reason) {
      setError(
        branchErrorMessage(
          reason,
          t('branchContextUnavailable'),
          t('extensionContextReloadRequired'),
        ),
      );
      setStatus('');
    } finally {
      setBusyKey('');
    }
  };

  const openBranch = async (delivery: ConversationBranchDelivery) => {
    if (!draft) return;
    try {
      setDialogBusy(true);
      setError('');
      await openConversationBranch(draft, delivery);
      setDraft(null);
      setStatus(t(delivery === 'markdown' ? 'branchMarkdownChatOpened' : 'branchChatOpened'));
    } catch (reason) {
      setError(
        branchErrorMessage(
          reason,
          t('branchContextUnavailable'),
          t('extensionContextReloadRequired'),
        ),
      );
    } finally {
      setDialogBusy(false);
    }
  };

  return (
    <>
      <div className="maw-branch-button-layer">
        {positions.map((position) => {
          const key = `${position.message.runtimeMessageId}:${position.message.order}`;
          return (
            <button
              className="maw-branch-trigger"
              type="button"
              key={position.key}
              style={{ top: position.top, left: position.left } as CSSProperties}
              title={t('branchFromMessage', { number: position.message.order + 1 })}
              aria-label={t('branchFromMessage', { number: position.message.order + 1 })}
              disabled={Boolean(busyKey)}
              onClick={() => void createBranch(position.message)}
            >
              {busyKey === key ? (
                <span aria-hidden="true">…</span>
              ) : (
                <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16">
                  <path
                    d="M6 4v5c0 2.2 1.8 4 4 4h7m-4-4 4 4-4 4M6 13v7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          );
        })}
      </div>
      {status ? <div className="maw-branch-floating-status">{status}</div> : null}
      {error ? (
        <div className="maw-branch-floating-error" role="alert">
          {error}
        </div>
      ) : null}
      {draft ? (
        <ConversationBranchPreviewDialog
          draft={draft}
          busy={dialogBusy}
          error={error}
          onClose={() => {
            if (!dialogBusy) {
              setDraft(null);
              setError('');
            }
          }}
          onOpen={(delivery) => void openBranch(delivery)}
        />
      ) : null}
    </>
  );
}

export function ConversationBranchNavigator({
  adapter,
  platformId,
  routeRevision,
}: {
  adapter: UserBoundPlatformAdapter;
  platformId: PlatformId;
  routeRevision: number;
}) {
  const t = useI18n();
  const [group, setGroup] = useState<ConversationBranchGroup | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (isConversationBranchGroup(detail)) setGroup(detail);
    };
    window.addEventListener(BRANCH_GROUP_EVENT, receive);
    return () => window.removeEventListener(BRANCH_GROUP_EVENT, receive);
  }, []);

  useEffect(() => {
    let active = true;
    void adapter
      .getCurrentConversation()
      .then((conversation) =>
        sendContentRequest({
          type: 'conversationBranch.observe',
          platformId,
          conversation,
        }),
      )
      .then((response) => {
        if (!active) return;
        setGroup(isConversationBranchGroup(response.value) ? response.value : null);
      })
      .catch(() => {
        if (active) setGroup(null);
      });
    return () => {
      active = false;
    };
  }, [adapter, platformId, routeRevision]);

  if (!group || group.branches.length < 2) return null;
  const current = group.branches.find(({ id }) => id === group.currentBranchId);

  const navigate = async (branchId: string) => {
    if (branchId === group.currentBranchId) {
      setOpen(false);
      return;
    }
    try {
      setBusy(branchId);
      setError('');
      const response = await sendContentRequest({
        type: 'conversationBranch.navigate',
        branchId,
      });
      if (isConversationBranchGroup(response.value)) {
        setGroup(response.value);
        announceBranchGroup(response.value);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('requestFailed'));
    } finally {
      setBusy('');
      setOpen(false);
    }
  };

  return (
    <aside className="maw-branch-navigator" aria-label={t('branchList')}>
      <button
        className="maw-branch-current"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{t('currentBranch')}</span>
        <strong>{current?.name ?? t('originalConversation')}</strong>
        <span aria-hidden="true">⌄</span>
      </button>
      {open ? (
        <div className="maw-branch-menu" role="menu">
          {group.branches.map((branch) => (
            <button
              type="button"
              role="menuitem"
              key={branch.id}
              className={branch.id === group.currentBranchId ? 'active' : undefined}
              disabled={branch.state === 'creating' || Boolean(busy)}
              onClick={() => void navigate(branch.id)}
            >
              <span>{branch.name}</span>
              <small>
                {branch.method === 'original'
                  ? t('originalConversation')
                  : branch.state === 'creating'
                    ? t('branchCreating')
                    : branch.method === 'native'
                      ? t('nativeBranch')
                      : t('contextBranch')}
              </small>
            </button>
          ))}
        </div>
      ) : null}
      {error ? <span className="maw-error">{error}</span> : null}
    </aside>
  );
}

export function ConversationBranchHandoffBanner({
  adapter,
  platformId,
  routeRevision,
}: {
  adapter: UserBoundPlatformAdapter;
  platformId: PlatformId;
  routeRevision: number;
}) {
  const t = useI18n();
  const [handoff, setHandoff] = useState<ConversationBranchHandoff | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [, setCapabilityRevision] = useState(0);
  const [applyRevision, setApplyRevision] = useState(0);
  const attempted = useRef('');
  const fetchTimer = useRef<number | null>(null);
  const applyTimer = useRef<number | null>(null);
  const applyRetryCount = useRef(0);
  const canInsert = adapter.getCapabilities().has('composer.write');
  const canSelectModel =
    adapter.getCapabilities().has('model.select') && Boolean(adapter.selectModel);
  const composerContent = handoff
    ? handoff.delivery === 'markdown'
      ? t('branchMarkdownComposerPrompt', {
          fileName: handoff.fileName ?? t('conversationBranchFile'),
        })
      : handoff.context
    : '';

  useEffect(() => {
    if (!success) return undefined;
    const timer = window.setTimeout(() => setSuccess(''), 5_000);
    return () => window.clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    return adapter.subscribeBindingChanges(() => {
      setCapabilityRevision((value) => value + 1);
    });
  }, [adapter]);

  useEffect(() => {
    let active = true;
    let fetchAttempt = 0;
    attempted.current = '';
    applyRetryCount.current = 0;
    if (fetchTimer.current !== null) window.clearTimeout(fetchTimer.current);
    if (applyTimer.current !== null) window.clearTimeout(applyTimer.current);

    const fetchPending = async () => {
      try {
        const response = await sendContentRequest({
          type: 'conversationBranch.pending',
          platformId,
        });
        if (!active) return;
        const pending =
          isConversationBranchHandoff(response.value) && response.value.platformId === platformId
            ? response.value
            : null;
        if (pending) {
          setHandoff(pending);
          setError('');
          return;
        }
        const delay = HANDOFF_FETCH_RETRY_DELAYS[fetchAttempt];
        fetchAttempt += 1;
        if (delay !== undefined) {
          fetchTimer.current = window.setTimeout(() => void fetchPending(), delay);
        } else {
          setHandoff(null);
        }
      } catch (reason) {
        if (!active) return;
        if (isExtensionContextUnavailable(reason)) {
          setError(t('extensionContextReloadRequired'));
          setHandoff(null);
          return;
        }
        const delay = HANDOFF_FETCH_RETRY_DELAYS[fetchAttempt];
        fetchAttempt += 1;
        if (delay !== undefined) {
          fetchTimer.current = window.setTimeout(() => void fetchPending(), delay);
        } else {
          setHandoff(null);
        }
      }
    };

    void fetchPending();
    return () => {
      active = false;
      if (fetchTimer.current !== null) window.clearTimeout(fetchTimer.current);
      if (applyTimer.current !== null) window.clearTimeout(applyTimer.current);
    };
  }, [platformId, routeRevision, t]);

  const complete = useCallback(
    async (current: ConversationBranchHandoff, notice = '') => {
      const conversation = await adapter.getCurrentConversation();
      const response = await sendContentRequest({
        type: 'conversationBranch.complete',
        platformId,
        id: current.id,
        conversation,
      });
      if (isConversationBranchGroup(response.value)) announceBranchGroup(response.value);
      setHandoff(null);
      setError('');
      setSuccess(
        [
          t(
            current.delivery === 'markdown'
              ? 'branchMarkdownInstructionsApplied'
              : 'branchContextApplied',
          ),
          notice,
        ]
          .filter(Boolean)
          .join(' '),
      );
    },
    [adapter, platformId, t],
  );

  const apply = useCallback(
    async (automatic: boolean) => {
      if (!handoff || !canInsert) return;
      try {
        let modelNotice = '';
        const currentText = await adapter.readComposer();
        if (automatic && currentText.trim() && !composerContains(currentText, composerContent)) {
          setError(t('branchComposerNotEmpty'));
          return;
        }
        if (handoff.model) {
          if (!canSelectModel) {
            modelNotice = t('branchModelUnavailable', { model: handoff.model });
          } else {
            await adapter.selectModel!(handoff.model);
          }
        }
        if (!composerContains(currentText, composerContent)) {
          await adapter.writeComposer(composerContent, {
            mode: automatic || !currentText.trim() ? 'replace' : 'insert-at-cursor',
            focus: true,
          });
        }
        if (!(await confirmComposerContent(adapter, composerContent))) {
          throw new Error('BRANCH_COMPOSER_WRITE_NOT_CONFIRMED');
        }
        if (applyTimer.current !== null) window.clearTimeout(applyTimer.current);
        applyRetryCount.current = 0;
        await complete(handoff, modelNotice);
      } catch (reason) {
        attempted.current = '';
        if (automatic && !isExtensionContextUnavailable(reason)) {
          const delay = HANDOFF_APPLY_RETRY_DELAYS[applyRetryCount.current];
          applyRetryCount.current += 1;
          if (delay !== undefined) {
            setError('');
            applyTimer.current = window.setTimeout(() => {
              applyTimer.current = null;
              setApplyRevision((value) => value + 1);
            }, delay);
            return;
          }
        }
        setError(
          isExtensionContextUnavailable(reason)
            ? t('extensionContextReloadRequired')
            : reason instanceof Error && reason.message !== 'BRANCH_COMPOSER_WRITE_NOT_CONFIRMED'
              ? reason.message
              : t('branchComposerUnavailable'),
        );
      }
    },
    [adapter, canInsert, canSelectModel, complete, composerContent, handoff, t],
  );

  useEffect(() => {
    if (!handoff || attempted.current === handoff.id) return;
    if (!canInsert) {
      if (applyTimer.current !== null) return;
      const delay = HANDOFF_APPLY_RETRY_DELAYS[applyRetryCount.current];
      applyRetryCount.current += 1;
      if (delay !== undefined) {
        void adapter.ensureAutomaticBinding().catch(() => undefined);
        applyTimer.current = window.setTimeout(() => {
          applyTimer.current = null;
          setApplyRevision((value) => value + 1);
        }, delay);
      } else {
        setError(t('branchComposerUnavailable'));
      }
      return;
    }
    attempted.current = handoff.id;
    applyTimer.current = window.setTimeout(() => {
      applyTimer.current = null;
      void apply(true);
    }, 0);
  }, [adapter, apply, applyRevision, canInsert, handoff, t]);

  const clear = async () => {
    if (!handoff) return;
    await sendContentRequest({
      type: 'conversationBranch.clear',
      platformId,
      id: handoff.id,
    });
    setHandoff(null);
    setError('');
  };

  const copy = async () => {
    if (!handoff) return;
    try {
      await copyText(handoff.context);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('requestFailed'));
    }
  };

  const downloadMarkdown = () => {
    if (!handoff) return;
    downloadConversationBranchMarkdown(handoff, handoff.fileName);
    setError('');
  };

  if (!handoff) {
    return success ? <div className="maw-branch-applied">{success}</div> : null;
  }

  return (
    <aside className="maw-branch-handoff" aria-live="polite">
      <div>
        <strong>{t('branchContextReady')}</strong>
        <p>
          {t(
            handoff.delivery === 'markdown'
              ? 'branchMarkdownReadyDescription'
              : 'branchContextReadyDescription',
            { count: handoff.messageCount },
          )}
        </p>
        <span>{handoff.branchName}</span>
      </div>
      {error ? <span className="maw-error">{error}</span> : null}
      <div className="maw-branch-handoff-actions">
        {handoff.delivery === 'markdown' ? (
          <button type="button" onClick={downloadMarkdown}>
            {t('downloadMarkdownAgain')}
          </button>
        ) : null}
        <button type="button" onClick={() => void copy()}>
          {t('copyBranchContext')}
        </button>
        <button
          className="primary"
          type="button"
          disabled={!canInsert}
          onClick={() => void apply(false)}
        >
          {t('insertBranchContext')}
        </button>
        <button type="button" onClick={() => void clear()}>
          {t('discardBranchContext')}
        </button>
      </div>
      {!canInsert ? <small>{t('branchComposerUnavailable')}</small> : null}
    </aside>
  );
}
