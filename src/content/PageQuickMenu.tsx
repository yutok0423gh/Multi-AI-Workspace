import { useEffect, useMemo, useRef, useState } from 'react';

import type { UserBoundPlatformAdapter } from '../platforms/base/UserBoundPlatformAdapter';
import { useI18n } from '../shared/i18n/I18nContext';
import type { PlatformMessage } from '../shared/types/platform';
import type { ConversationBranchDelivery } from '../shared/types/conversationBranch';
import type { ConversationExportFormat } from '../shared/types/settings';
import { BrandIcon } from '../ui/components/BrandIcon';
import {
  ConversationBranchPreviewDialog,
  openConversationBranch,
  prepareConversationBranch,
} from './ConversationBranchControls';
import type { ConversationBranchDraft } from './conversationBranches';
import { exportConversation } from './conversationExport';
import { availablePageQuickActions } from './pageQuickActions';
import { PromptLibraryPanel } from './PromptLibraryPanel';
import { QuickMenuIcon } from './QuickMenuIcon';
import { isExtensionContextUnavailable } from '../shared/runtime/sendRuntimeRequest';

export function PageQuickMenu({
  adapter,
  messages,
  position,
  promptAvailable,
  draftRestoreAvailable,
  draftUndoAvailable,
  onRestoreDraft,
  onUndoDraftRestore,
  pinAvailable,
  pinMode,
  onPinModeChange,
  branchAvailable,
  configuredModel,
  exportAvailable,
  exportFormat,
  onOpenWorkspace,
}: {
  adapter: UserBoundPlatformAdapter;
  messages: PlatformMessage[];
  position: 'left' | 'right';
  promptAvailable: boolean;
  draftRestoreAvailable: boolean;
  draftUndoAvailable: boolean;
  onRestoreDraft: () => Promise<boolean>;
  onUndoDraftRestore: () => Promise<boolean>;
  pinAvailable: boolean;
  pinMode: boolean;
  onPinModeChange: (active: boolean) => void;
  branchAvailable: boolean;
  configuredModel: string | null;
  exportAvailable: boolean;
  exportFormat: ConversationExportFormat;
  onOpenWorkspace: () => void;
}) {
  const t = useI18n();
  const [open, setOpen] = useState(false);
  const [promptLibraryOpen, setPromptLibraryOpen] = useState(false);
  const [branchPickerOpen, setBranchPickerOpen] = useState(false);
  const [branchDraft, setBranchDraft] = useState<ConversationBranchDraft | null>(null);
  const [busy, setBusy] = useState<'branch' | 'export' | 'restore' | 'undo-restore' | ''>('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const menuRef = useRef<HTMLElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const branchableMessages = useMemo(
    () => messages.filter(({ role }) => role === 'user' || role === 'assistant'),
    [messages],
  );
  const actions = availablePageQuickActions({
    prompt: promptAvailable,
    restore: draftRestoreAvailable,
    undoRestore: draftUndoAvailable,
    pin: pinAvailable || pinMode,
    branch: branchAvailable && branchableMessages.length > 0,
    export: exportAvailable && messages.length > 0,
  });

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const closeOnOutsideClick = (event: PointerEvent) => {
      const path = event.composedPath();
      if (
        !path.includes(menuRef.current as EventTarget) &&
        !path.includes(launcherRef.current as EventTarget)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', closeOnEscape, true);
    document.addEventListener('pointerdown', closeOnOutsideClick, true);
    return () => {
      document.removeEventListener('keydown', closeOnEscape, true);
      document.removeEventListener('pointerdown', closeOnOutsideClick, true);
    };
  }, [open]);

  const chooseBranch = async (message: PlatformMessage) => {
    try {
      setBusy('branch');
      setError('');
      setNotice(t('branchCreating'));
      const preparation = await prepareConversationBranch(
        adapter,
        messages,
        message,
        configuredModel,
      );
      if (preparation.method === 'native') {
        setNotice(t('branchNativeOpened'));
      } else {
        setBranchDraft(preparation.draft);
        setNotice('');
        setOpen(false);
      }
      setBranchPickerOpen(false);
    } catch (reason) {
      setNotice('');
      setError(
        isExtensionContextUnavailable(reason)
          ? t('extensionContextReloadRequired')
          : t('branchContextUnavailable'),
      );
    } finally {
      setBusy('');
    }
  };

  const openBranch = async (delivery: ConversationBranchDelivery) => {
    if (!branchDraft) return;
    try {
      setBusy('branch');
      setError('');
      await openConversationBranch(branchDraft, delivery);
      setBranchDraft(null);
      setNotice(t(delivery === 'markdown' ? 'branchMarkdownChatOpened' : 'branchChatOpened'));
    } catch (reason) {
      setError(
        isExtensionContextUnavailable(reason)
          ? t('extensionContextReloadRequired')
          : t('branchContextUnavailable'),
      );
    } finally {
      setBusy('');
    }
  };

  const exportNow = async () => {
    try {
      setBusy('export');
      setError('');
      await exportConversation(adapter, exportFormat);
      setNotice(t('conversationExported'));
    } catch {
      setNotice('');
      setError(t('requestFailed'));
    } finally {
      setBusy('');
    }
  };

  const updateDraft = async (action: 'restore' | 'undo-restore') => {
    try {
      setBusy(action);
      setError('');
      setNotice('');
      const changed = await (action === 'restore' ? onRestoreDraft() : onUndoDraftRestore());
      if (!changed) {
        setError(t(action === 'restore' ? 'draftRestoreUnavailable' : 'draftUndoUnavailable'));
        return;
      }
      setNotice(t(action === 'restore' ? 'draftRestored' : 'draftRestoreUndone'));
    } catch {
      setError(t(action === 'restore' ? 'draftRestoreUnavailable' : 'draftUndoUnavailable'));
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <button
        ref={launcherRef}
        className={`maw-launcher ${position} ${pinMode ? 'pinning' : ''}`}
        type="button"
        aria-label={t('openQuickMenu')}
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
          setNotice('');
          setError('');
        }}
      >
        <BrandIcon className="maw-launcher-mark" tone={pinMode ? 'pinning' : 'brand'} />
      </button>
      {open ? (
        <aside
          ref={menuRef}
          className={`maw-quick-menu ${position}`}
          aria-label={t('quickMenuTitle')}
        >
          <header>
            <div>
              <strong>{t('quickMenuTitle')}</strong>
              <p>{t('quickMenuDescription')}</p>
            </div>
            <button type="button" aria-label={t('close')} onClick={() => setOpen(false)}>
              <QuickMenuIcon name="close" />
            </button>
          </header>
          {notice ? <div className="maw-notice">{notice}</div> : null}
          {error ? <div className="maw-error">{error}</div> : null}
          <div className="maw-quick-actions">
            {actions.includes('prompt') ? (
              <button
                type="button"
                aria-expanded={promptLibraryOpen}
                onClick={() => {
                  setPromptLibraryOpen((value) => !value);
                  setBranchPickerOpen(false);
                }}
              >
                <QuickMenuIcon name="prompt" />
                {t('tabPrompts')}
              </button>
            ) : null}
            {actions.includes('restore') ? (
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => {
                  setPromptLibraryOpen(false);
                  setBranchPickerOpen(false);
                  void updateDraft('restore');
                }}
              >
                <QuickMenuIcon name="restore" />
                {t('restoreDraft')}
              </button>
            ) : null}
            {actions.includes('undo-restore') ? (
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => {
                  setPromptLibraryOpen(false);
                  setBranchPickerOpen(false);
                  void updateDraft('undo-restore');
                }}
              >
                <QuickMenuIcon name="undo-restore" />
                {t('undoDraftRestore')}
              </button>
            ) : null}
            {actions.includes('pin') ? (
              <button
                type="button"
                aria-pressed={pinMode}
                onClick={() => {
                  onPinModeChange(!pinMode);
                  setOpen(false);
                }}
              >
                <QuickMenuIcon name="pin" />
                {t(pinMode ? 'cancelPinMode' : 'startPinMode')}
              </button>
            ) : null}
            {actions.includes('branch') ? (
              <button
                type="button"
                aria-expanded={branchPickerOpen}
                disabled={Boolean(busy)}
                onClick={() => {
                  setBranchPickerOpen((value) => !value);
                  setPromptLibraryOpen(false);
                }}
              >
                <QuickMenuIcon name="branch" />
                {t('branchConversation')}
              </button>
            ) : null}
            {actions.includes('export') ? (
              <button type="button" disabled={Boolean(busy)} onClick={() => void exportNow()}>
                <QuickMenuIcon name="export" />
                {t('exportNow')}
              </button>
            ) : null}
          </div>
          {promptLibraryOpen && actions.includes('prompt') ? (
            <section className="maw-quick-prompts" aria-label={t('tabPrompts')}>
              <PromptLibraryPanel adapter={adapter} onInserted={() => setOpen(false)} />
            </section>
          ) : null}
          {branchPickerOpen && actions.includes('branch') ? (
            <section className="maw-quick-branch-picker">
              <strong>{t('quickChooseBranchPoint')}</strong>
              <div>
                {branchableMessages.map((message) => (
                  <button
                    type="button"
                    key={`${message.runtimeMessageId}:${message.order}`}
                    disabled={Boolean(busy)}
                    onClick={() => void chooseBranch(message)}
                  >
                    {t('branchFromMessage', { number: message.order + 1 })}
                  </button>
                ))}
              </div>
            </section>
          ) : null}
          <button
            className="maw-quick-workspace"
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenWorkspace();
            }}
          >
            {t('quickOpenWorkspace')}
            <QuickMenuIcon name="workspace" />
          </button>
        </aside>
      ) : null}
      {branchDraft ? (
        <ConversationBranchPreviewDialog
          draft={branchDraft}
          busy={busy === 'branch'}
          error={error}
          onClose={() => {
            if (!busy) {
              setBranchDraft(null);
              setError('');
            }
          }}
          onOpen={(delivery) => void openBranch(delivery)}
        />
      ) : null}
    </>
  );
}
