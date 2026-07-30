import { useEffect, useRef, useState } from 'react';

import { I18nProvider, useI18n } from '../shared/i18n/I18nContext';
import type { UserBoundPlatformAdapter } from '../platforms/base/UserBoundPlatformAdapter';
import {
  shouldShowExtensionBranch,
  shouldShowExtensionTimeline,
} from '../platforms/nativeFeatures';
import type { PlatformId } from '../shared/types/platform';
import type { AppSettings } from '../shared/types/settings';
import { FeatureErrorBoundary } from '../ui/components/FeatureErrorBoundary';
import { LanguageToggle } from '../ui/components/LanguageToggle';
import { BindingControls } from './BindingControls';
import { ChatGptExportButton } from './ChatGptExportButton';
import { CompatibilityPanel } from './CompatibilityPanel';
import { ConversationPanel } from './ConversationPanel';
import {
  ConversationPageOverlay,
  useConversationPageEnhancements,
} from './ConversationPageEnhancements';
import { RewritePanel } from './RewritePanel';
import { formatSelectedQuote, SelectionRewritePopover } from './SelectionRewritePopover';
import { MarkupEnhancements } from './MarkupEnhancements';
import { PageQuickMenu } from './PageQuickMenu';
import { availableContentTabs, type ContentTab } from './contentFeatureGates';
import { useCompletionNotification } from './useCompletionNotification';
import { useDefaultModel } from './useDefaultModel';
import { useDraft } from './useDraft';
import { useInputBehavior } from './useInputBehavior';
import { usePreventAutoScroll } from './usePreventAutoScroll';
import { useRouteRevision } from './useRouteRevision';
import { useSelectedText } from './useSelectedText';
import type { TextHighlightColor } from '../shared/types/records';
import { VisualEffects } from './VisualEffects';
import {
  ConversationBranchControls,
  ConversationBranchHandoffBanner,
  ConversationBranchNavigator,
} from './ConversationBranchControls';

interface ContentAppProps {
  platformId: PlatformId;
  platformLabel: string;
  settings: AppSettings;
  adapter: UserBoundPlatformAdapter;
  onLocaleChange: (locale: 'en' | 'zh-CN') => void | Promise<void>;
}

function ContentPanel({
  platformId,
  platformLabel,
  settings,
  adapter,
  onLocaleChange,
}: ContentAppProps) {
  const t = useI18n();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<ContentTab>('status');
  const [bindingRevision, setBindingRevision] = useState(0);
  const [pinMode, setPinMode] = useState(false);
  const [rewriteSelection, setRewriteSelection] = useState({ text: '', revision: 0 });
  const [highlightColor, setHighlightColor] = useState<TextHighlightColor>('yellow');
  const [selectionError, setSelectionError] = useState<{ range: Range; text: string } | null>(null);
  const routeRevision = useRouteRevision();
  const configuredDefaultModel =
    platformId === 'custom' ? undefined : settings.models.defaults[platformId];
  const defaultModelStatus = useDefaultModel(
    adapter,
    platformId,
    configuredDefaultModel,
    bindingRevision,
    routeRevision,
  );
  const closeButton = useRef<HTMLButtonElement>(null);
  const position = settings.ui.launcherPosition === 'bottom-left' ? 'left' : 'right';
  const capabilities = [...adapter.getCapabilities()];
  const availableTabs = availableContentTabs(settings);
  const activeTab = availableTabs.includes(tab) ? tab : 'status';
  const canQuote = capabilities.includes('composer.write');
  const canHighlight = settings.features.timeline;
  const canReadMessages = capabilities.includes('messages.read');
  const canBranch =
    capabilities.includes('conversation.fork.manual') ||
    capabilities.includes('conversation.fork.native');
  const extensionBranchEnabled = shouldShowExtensionBranch(adapter.id);
  const canPin = settings.features.timeline;
  const extensionTimelineEnabled =
    settings.features.timeline && shouldShowExtensionTimeline(adapter.id);
  const canEnhanceMarkup =
    canReadMessages && (settings.markup.mermaidEnabled || settings.markup.formulaCopyEnabled);
  const selectedText = useSelectedText(
    settings.features.foundationPanel &&
      (settings.features.promptRewrite || canQuote || canHighlight),
  );
  const pageEnhancements = useConversationPageEnhancements(
    adapter,
    settings.features.foundationPanel && (canHighlight || canEnhanceMarkup || canBranch),
    routeRevision,
    bindingRevision,
  );
  const draft = useDraft(adapter, settings.features.draft, bindingRevision, routeRevision);
  useInputBehavior(adapter, settings.input.sendShortcut, bindingRevision);
  usePreventAutoScroll(adapter, settings.input.preventAutoScroll, bindingRevision, routeRevision);
  useCompletionNotification(
    adapter,
    settings.notifications.completionEnabled,
    bindingRevision,
    routeRevision,
    t('productName'),
    t('completionReady'),
  );

  useEffect(() => {
    if (open) {
      closeButton.current?.focus();
    }
  }, [open]);

  useEffect(
    () =>
      adapter.subscribeBindingChanges(() => {
        setBindingRevision((value) => value + 1);
        setPinMode(false);
      }),
    [adapter],
  );

  const openSelectionRewrite = () => {
    if (!selectedText.selection) return;
    setSelectionError(null);
    setRewriteSelection((current) => ({
      text: selectedText.selection?.text ?? '',
      revision: current.revision + 1,
    }));
    setTab('rewrite');
    setOpen(true);
    selectedText.dismiss();
  };

  const quoteSelection = async () => {
    if (!selectedText.selection) return;
    setSelectionError(null);
    await adapter.writeComposer(formatSelectedQuote(selectedText.selection.text), {
      mode: 'insert-at-cursor',
      focus: true,
    });
    selectedText.dismiss();
  };

  const applySelectionHighlight = async () => {
    if (!selectedText.selection) return;
    setSelectionError(null);
    try {
      const result = await pageEnhancements.applyHighlight(selectedText.selection, highlightColor);
      if (result === 'unavailable') {
        setSelectionError({
          range: selectedText.selection.range,
          text: t('highlightUnavailable'),
        });
        return;
      }
      window.getSelection()?.removeAllRanges();
      selectedText.dismiss();
    } catch {
      setSelectionError({
        range: selectedText.selection.range,
        text: t('highlightUnavailable'),
      });
    }
  };

  const removeSelectionHighlight = async () => {
    if (!selectedText.selection) return;
    setSelectionError(null);
    try {
      const result = await pageEnhancements.removeHighlight(selectedText.selection);
      if (result === 'unavailable') {
        setSelectionError({
          range: selectedText.selection.range,
          text: t('highlightUnavailable'),
        });
        return;
      }
      window.getSelection()?.removeAllRanges();
      selectedText.dismiss();
    } catch {
      setSelectionError({
        range: selectedText.selection.range,
        text: t('highlightUnavailable'),
      });
    }
  };

  if (!settings.features.foundationPanel) {
    return null;
  }

  return (
    <div className="maw-shell">
      {extensionBranchEnabled ? (
        <>
          <ConversationBranchHandoffBanner
            adapter={adapter}
            platformId={platformId}
            routeRevision={routeRevision}
          />
          <ConversationBranchNavigator
            adapter={adapter}
            platformId={platformId}
            routeRevision={routeRevision}
          />
        </>
      ) : null}
      <ChatGptExportButton
        adapter={adapter}
        enabled={platformId === 'chatgpt' && settings.features.export && canReadMessages}
        format={settings.conversationExport.format}
        label={t('downloadConversation')}
        successLabel={t('conversationExported')}
        errorLabel={t('requestFailed')}
      />
      {canBranch ? (
        <ConversationBranchControls
          adapter={adapter}
          messages={pageEnhancements.messages}
          configuredModel={configuredDefaultModel ?? null}
        />
      ) : null}
      {canEnhanceMarkup ? (
        <MarkupEnhancements messages={pageEnhancements.messages} settings={settings.markup} />
      ) : null}
      {canHighlight ? (
        <ConversationPageOverlay
          adapter={adapter}
          messages={pageEnhancements.messages}
          highlights={pageEnhancements.resolvedHighlights}
          pins={pageEnhancements.resolvedPins}
          pinEnabled={canPin}
          pinMode={pinMode}
          onPinModeChange={setPinMode}
          onPinTarget={pageEnhancements.pinTarget}
          onRemovePin={pageEnhancements.removePin}
          showPromptNavigator={extensionTimelineEnabled}
          navigatorRevision={routeRevision}
        />
      ) : null}
      {selectedText.selection ? (
        <SelectionRewritePopover
          selection={selectedText.selection}
          canQuote={canQuote}
          canRewrite={settings.features.promptRewrite}
          canHighlight={canHighlight}
          highlighted={pageEnhancements.isSelectionHighlighted(selectedText.selection)}
          highlightColor={highlightColor}
          onQuote={quoteSelection}
          onRewrite={openSelectionRewrite}
          onHighlight={applySelectionHighlight}
          onRemoveHighlight={removeSelectionHighlight}
          onHighlightColorChange={setHighlightColor}
          onDismiss={selectedText.dismiss}
          error={
            selectionError?.range === selectedText.selection.range ? selectionError.text : undefined
          }
        />
      ) : null}
      <PageQuickMenu
        adapter={adapter}
        messages={pageEnhancements.messages}
        position={position}
        promptAvailable={settings.features.promptManager && canQuote}
        draftRestoreAvailable={Boolean(draft.restorable)}
        draftUndoAvailable={draft.undoAvailable}
        onRestoreDraft={draft.restore}
        onUndoDraftRestore={draft.undoRestore}
        pinAvailable={canPin && pageEnhancements.pinReady}
        pinMode={pinMode}
        onPinModeChange={setPinMode}
        branchAvailable={canBranch}
        configuredModel={configuredDefaultModel ?? null}
        exportAvailable={settings.features.export && canReadMessages}
        exportFormat={settings.conversationExport.format}
        onOpenWorkspace={() => setOpen(true)}
      />
      {open ? (
        <section
          className={`maw-panel ${position} ${settings.ui.panelWidth}`}
          style={{ zoom: settings.ui.fontScale }}
          aria-live="polite"
        >
          <button
            ref={closeButton}
            className="maw-close"
            type="button"
            aria-label={t('close')}
            onClick={() => setOpen(false)}
          >
            ×
          </button>
          <p className="maw-eyebrow">{t('productName')}</p>
          <LanguageToggle locale={settings.locale} onChange={onLocaleChange} />
          <h2 className="maw-title">{platformLabel}</h2>
          <p className="maw-description">{t('workspaceAutomaticDescription')}</p>
          <div className="maw-status">
            <span className="maw-dot" aria-hidden="true" />
            {capabilities.length
              ? t('capabilityCount', { count: capabilities.length })
              : t('basicFeaturesReady', { platform: platformLabel })}
          </div>
          <nav className="maw-tabs">
            <button
              type="button"
              aria-current={activeTab === 'status' ? 'page' : undefined}
              onClick={() => setTab('status')}
            >
              {t('tabConnect')}
            </button>
            {settings.features.promptRewrite ? (
              <button
                type="button"
                aria-current={activeTab === 'rewrite' ? 'page' : undefined}
                onClick={() => setTab('rewrite')}
              >
                {t('tabRewrite')}
              </button>
            ) : null}
            {availableTabs.includes('conversation') ? (
              <button
                type="button"
                aria-current={activeTab === 'conversation' ? 'page' : undefined}
                onClick={() => setTab('conversation')}
              >
                {t('tabConversation')}
              </button>
            ) : null}
          </nav>
          <div className="maw-tab-content">
            {activeTab === 'status' ? (
              <>
                <CompatibilityPanel
                  adapter={adapter}
                  settings={settings}
                  bindingRevision={bindingRevision}
                  routeRevision={routeRevision}
                />
                <BindingControls
                  adapter={adapter}
                  onChange={() => setBindingRevision((value) => value + 1)}
                  externalStatus={
                    defaultModelStatus
                      ? {
                          kind: defaultModelStatus.state === 'applied' ? 'notice' : 'error',
                          message:
                            defaultModelStatus.state === 'applied'
                              ? t('defaultModelApplied', { model: defaultModelStatus.model })
                              : defaultModelStatus.state === 'binding-required'
                                ? t('defaultModelBindingRequired', {
                                    model: defaultModelStatus.model,
                                  })
                                : defaultModelStatus.code === 'MODEL_NOT_FOUND'
                                  ? t('defaultModelNotFound', { model: defaultModelStatus.model })
                                  : t('defaultModelApplyFailed', {
                                      model: defaultModelStatus.model,
                                    }),
                        }
                      : null
                  }
                />
                {capabilities.length ? (
                  <div className="maw-capabilities">
                    {capabilities.map((capability) => (
                      <span key={capability}>{capability}</span>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}
            {activeTab === 'rewrite' && settings.features.promptRewrite ? (
              <RewritePanel
                key={`rewrite-${rewriteSelection.revision}`}
                adapter={adapter}
                allowContext={settings.privacy.includeConversationContext}
                initialText={rewriteSelection.text}
              />
            ) : null}
            {activeTab === 'conversation' ? (
              <ConversationPanel
                key={routeRevision}
                adapter={adapter}
                enableTimeline={extensionTimelineEnabled}
                enableExport={settings.features.export}
                exportFormat={settings.conversationExport.format}
              />
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function ContentApp(props: ContentAppProps) {
  return (
    <FeatureErrorBoundary fallback={null}>
      <I18nProvider locale={props.settings.locale}>
        <>
          <VisualEffects effect={props.settings.ui.visualEffect} />
          <ContentPanel
            platformId={props.platformId}
            platformLabel={props.platformLabel}
            settings={props.settings}
            adapter={props.adapter}
            onLocaleChange={props.onLocaleChange}
          />
        </>
      </I18nProvider>
    </FeatureErrorBoundary>
  );
}
