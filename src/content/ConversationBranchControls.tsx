import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { UserBoundPlatformAdapter } from '../platforms/base/UserBoundPlatformAdapter';
import { useI18n } from '../shared/i18n/I18nContext';
import type {
  ConversationBranchGroup,
  ConversationBranchHandoff,
} from '../shared/types/conversationBranch';
import type { PlatformId, PlatformMessage } from '../shared/types/platform';
import {
  isConversationBranchGroup,
  isConversationBranchHandoff,
  isConversationBranchPreparation,
} from '../shared/utils/conversationBranch';
import { buildConversationBranchDraft } from './conversationBranches';
import { sendContentRequest } from './runtime';

const BRANCH_GROUP_EVENT = 'multi-ai-workspace:conversation-branch-group';

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

export async function createConversationBranch(
  adapter: UserBoundPlatformAdapter,
  messages: PlatformMessage[],
  message: PlatformMessage,
  configuredModel: string | null,
): Promise<'native' | 'manual'> {
  let preparedBranchId = '';
  try {
    const result = await adapter.forkConversation(message);
    if (result.method === 'native') return 'native';

    const conversation = await adapter.getCurrentConversation();
    const selectedModel = (await adapter.getSelectedModel?.()) || configuredModel;
    const draft = buildConversationBranchDraft(messages, message, conversation, selectedModel);
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

    await sendContentRequest({
      type: 'conversationBranch.open',
      branchId: preparedBranchId,
      transfer: draft,
    });
    if (preparation.branch.parentBranchId) {
      announceBranchGroup({
        ...preparation.group,
        currentBranchId: preparation.branch.parentBranchId,
      });
    }
    return 'manual';
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
      const method = await createConversationBranch(adapter, messages, message, configuredModel);
      setStatus(t(method === 'manual' ? 'branchChatOpened' : 'branchNativeOpened'));
    } catch (reason) {
      setError(
        reason instanceof Error && reason.message !== 'BRANCH_PREPARATION_INVALID'
          ? reason.message
          : t('branchContextUnavailable'),
      );
      setStatus('');
    } finally {
      setBusyKey('');
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
  const attempted = useRef('');
  const canInsert = adapter.getCapabilities().has('composer.write');
  const canSelectModel =
    adapter.getCapabilities().has('model.select') && Boolean(adapter.selectModel);

  useEffect(() => {
    if (!success) return undefined;
    const timer = window.setTimeout(() => setSuccess(''), 5_000);
    return () => window.clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    let active = true;
    attempted.current = '';
    void sendContentRequest({ type: 'conversationBranch.pending', platformId })
      .then((response) => {
        if (!active) return;
        setHandoff(
          isConversationBranchHandoff(response.value) && response.value.platformId === platformId
            ? response.value
            : null,
        );
      })
      .catch(() => {
        if (active) setHandoff(null);
      });
    return () => {
      active = false;
    };
  }, [platformId, routeRevision]);

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
      setSuccess([t('branchContextApplied'), notice].filter(Boolean).join(' '));
    },
    [adapter, platformId, t],
  );

  const apply = useCallback(
    async (automatic: boolean) => {
      if (!handoff || !canInsert) return;
      try {
        let modelNotice = '';
        const currentText = await adapter.readComposer();
        if (automatic && currentText.trim() && !currentText.includes(handoff.context)) {
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
        if (!currentText.includes(handoff.context)) {
          await adapter.writeComposer(handoff.context, {
            mode: automatic || !currentText.trim() ? 'replace' : 'insert-at-cursor',
            focus: true,
          });
        }
        await complete(handoff, modelNotice);
      } catch (reason) {
        attempted.current = '';
        setError(reason instanceof Error ? reason.message : t('requestFailed'));
      }
    },
    [adapter, canInsert, canSelectModel, complete, handoff, t],
  );

  useEffect(() => {
    if (!handoff || !canInsert || attempted.current === handoff.id) return;
    attempted.current = handoff.id;
    void apply(true);
  }, [apply, canInsert, handoff]);

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

  if (!handoff) {
    return success ? <div className="maw-branch-applied">{success}</div> : null;
  }

  return (
    <aside className="maw-branch-handoff" aria-live="polite">
      <div>
        <strong>{t('branchContextReady')}</strong>
        <p>{t('branchContextReadyDescription', { count: handoff.messageCount })}</p>
        <span>{handoff.branchName}</span>
      </div>
      {error ? <span className="maw-error">{error}</span> : null}
      <div className="maw-branch-handoff-actions">
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
