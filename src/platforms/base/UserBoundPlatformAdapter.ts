import browser from 'webextension-polyfill';

import { CapabilityUnavailableError } from '../../shared/errors/AppError';
import type { RuntimeResponse } from '../../shared/types/messages';
import type {
  AdapterCompatibilityEvidence,
  CompatibilityMonitorSnapshot,
} from '../../shared/types/diagnostics';
import type {
  ComposerHandle,
  PlatformAnswerCompletion,
  PlatformAdapter,
  PlatformCapability,
  PlatformConversation,
  PlatformId,
  PlatformMessage,
} from '../../shared/types/platform';
import type { CustomSiteBindingRecord } from '../../shared/types/records';
import { createBindingId } from '../../shared/utils/bindingKey';
import { conversationIdFromUrl, sanitizeConversationUrl } from '../../shared/utils/conversationUrl';
import { scrollElementToCenter } from '../../shared/utils/messageScroll';
import {
  AUTOMATIC_BINDING_VERSION,
  discoverAutomaticBinding,
  discoverAutomaticMessages,
} from './AutomaticBinding';
import { createAnswerCompletionObserver } from './answerCompletion';
import { selectBoundModel } from './modelSelection';
import { shouldShowExtensionBranch, shouldShowExtensionTimeline } from '../nativeFeatures';

function query(selector: string | null, root: ParentNode = document): HTMLElement | null {
  if (!selector) return null;
  try {
    const element = root.querySelector(selector);
    return element instanceof HTMLElement ? element : null;
  } catch {
    return null;
  }
}

function queryAll(selector: string | null, root: ParentNode = document): HTMLElement[] {
  if (!selector) return [];
  try {
    return [...root.querySelectorAll(selector)].filter(
      (element): element is HTMLElement => element instanceof HTMLElement,
    );
  } catch {
    return [];
  }
}

function isFragileMessageCollectionSelector(selector: string | null): boolean {
  if (!selector) return false;
  return (
    selector.trimStart().startsWith('#') ||
    selector.includes('[data-id=') ||
    selector.includes(':nth-of-type(')
  );
}

interface BoundMessageElement {
  element: HTMLElement;
  role: 'user' | 'assistant';
}

function isHiddenMessageElement(element: HTMLElement): boolean {
  if (element.closest('[hidden], [aria-hidden="true"]')) return true;
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  return style?.display === 'none' || style?.visibility === 'hidden';
}

function normalizedMessageText(element: HTMLElement): string {
  return (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
}

function sharesRenderedPosition(left: HTMLElement, right: HTMLElement): boolean {
  const leftRect = left.getBoundingClientRect();
  const rightRect = right.getBoundingClientRect();
  if (
    (leftRect.width <= 0 && leftRect.height <= 0) ||
    (rightRect.width <= 0 && rightRect.height <= 0)
  ) {
    return false;
  }
  return (
    Math.abs(leftRect.left - rightRect.left) <= 2 &&
    Math.abs(leftRect.top - rightRect.top) <= 2 &&
    Math.abs(leftRect.width - rightRect.width) <= 4 &&
    Math.abs(leftRect.height - rightRect.height) <= 4
  );
}

function deduplicateMessageElements(candidates: BoundMessageElement[]): BoundMessageElement[] {
  const visible = candidates.filter(({ element }) => !isHiddenMessageElement(element));
  const leafCandidates = visible.filter(
    (candidate) =>
      !visible.some(
        (other) =>
          other !== candidate &&
          other.role === candidate.role &&
          candidate.element.contains(other.element),
      ),
  );
  const unique: BoundMessageElement[] = [];
  for (const candidate of leafCandidates) {
    const duplicate = unique.some(
      (existing) =>
        existing.role === candidate.role &&
        existing.element !== candidate.element &&
        normalizedMessageText(existing.element) === normalizedMessageText(candidate.element) &&
        sharesRenderedPosition(existing.element, candidate.element),
    );
    if (!duplicate) unique.push(candidate);
  }
  return unique;
}

function readEditable(element: HTMLElement): string {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    return element.value;
  }
  return element.innerText || element.textContent || '';
}

function setNativeValue(element: HTMLTextAreaElement | HTMLInputElement, value: string): void {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(element, value);
}

function writeEditable(
  element: HTMLElement,
  value: string,
  mode: 'replace' | 'insert-at-cursor' | 'append',
): void {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    const current = element.value;
    const start = element.selectionStart ?? current.length;
    const end = element.selectionEnd ?? start;
    const next =
      mode === 'replace'
        ? value
        : mode === 'append'
          ? `${current}${value}`
          : `${current.slice(0, start)}${value}${current.slice(end)}`;
    setNativeValue(element, next);
    const cursor =
      mode === 'replace' ? next.length : mode === 'append' ? next.length : start + value.length;
    element.setSelectionRange(cursor, cursor);
  } else {
    const current = readEditable(element);
    element.textContent = mode === 'replace' ? value : `${current}${value}`;
  }
  element.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      composed: true,
      data: value,
      inputType: 'insertText',
    }),
  );
  element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
}

export class UserBoundPlatformAdapter implements PlatformAdapter {
  readonly id: PlatformId;
  private binding: CustomSiteBindingRecord | null = null;
  private readonly hostname: string;
  private observers = new Set<MutationObserver>();
  private bindingListeners = new Set<(binding: CustomSiteBindingRecord | null) => void>();
  private automaticBindingObserver: MutationObserver | null = null;
  private automaticBindingTimer: number | null = null;
  private automaticCompatibilityInterval: number | null = null;
  private automaticBindingPromise: Promise<CustomSiteBindingRecord | null> | null = null;
  private automaticPromptReady = false;
  private automaticMessagesReady = false;
  private automaticComposerElement: HTMLElement | null = null;
  private automaticUserMessageElement: HTMLElement | null = null;
  private automaticAssistantMessageElement: HTMLElement | null = null;
  private compatibilityRecoveryAttempts = 0;
  private lastCompatibilityRecoveryAt: number | null = null;
  private lastCompatibilityChangeAt: number | null = null;

  constructor(id: PlatformId, hostname: string) {
    this.id = id;
    this.hostname = hostname;
  }

  matches(location: Location): boolean {
    const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    return (
      location.hostname === this.hostname &&
      (location.protocol === 'https:' ||
        (this.id === 'custom' && local && location.protocol === 'http:'))
    );
  }

  async initialize(): Promise<void> {
    await this.reloadBinding();
    await this.ensureAutomaticBinding();
    this.observeAutomaticBinding();
  }

  async reloadBinding(): Promise<CustomSiteBindingRecord | null> {
    const response = (await browser.runtime.sendMessage({
      type: 'binding.get',
      origin: location.origin,
      platformId: this.id,
    })) as RuntimeResponse;
    this.binding = response.ok ? (response.binding ?? null) : null;
    return this.binding;
  }

  getBinding(): CustomSiteBindingRecord | null {
    return this.binding;
  }

  setBinding(binding: CustomSiteBindingRecord | null): void {
    this.binding = binding;
    this.notifyBindingListeners();
  }

  private notifyBindingListeners(): void {
    for (const listener of this.bindingListeners) listener(this.binding);
  }

  subscribeBindingChanges(listener: (binding: CustomSiteBindingRecord | null) => void): () => void {
    this.bindingListeners.add(listener);
    return () => this.bindingListeners.delete(listener);
  }

  async ensureAutomaticBinding(): Promise<CustomSiteBindingRecord | null> {
    this.automaticBindingPromise ??= this.runAutomaticBinding().finally(() => {
      this.automaticBindingPromise = null;
    });
    return this.automaticBindingPromise;
  }

  inspectCompatibility(): AdapterCompatibilityEvidence {
    const composer = query(this.binding?.composerSelector ?? null) !== null;
    const userMessages = queryAll(this.binding?.userMessageSelector ?? null).some(
      (element) => !isHiddenMessageElement(element),
    );
    const assistantMessages = queryAll(this.binding?.assistantMessageSelector ?? null).some(
      (element) => !isHiddenMessageElement(element),
    );
    return {
      composer,
      userMessages,
      assistantMessages,
      readableMessages: userMessages || assistantMessages,
      bindingConfigured: Boolean(this.binding?.enabled),
      checkedAt: Date.now(),
    };
  }

  getCompatibilityMonitorSnapshot(): CompatibilityMonitorSnapshot {
    const evidence = this.inspectCompatibility();
    const recovering = this.automaticBindingTimer !== null || this.automaticBindingPromise !== null;
    return {
      phase: recovering
        ? 'recovering'
        : evidence.composer && evidence.readableMessages
          ? 'healthy'
          : evidence.composer || evidence.readableMessages
            ? 'partial'
            : 'degraded',
      recoveryAttempts: this.compatibilityRecoveryAttempts,
      lastRecoveryAt: this.lastCompatibilityRecoveryAt,
      lastChangeAt: this.lastCompatibilityChangeAt,
      evidence,
    };
  }

  async recoverCompatibility(): Promise<CompatibilityMonitorSnapshot> {
    this.compatibilityRecoveryAttempts += 1;
    this.lastCompatibilityRecoveryAt = Date.now();
    try {
      await this.ensureAutomaticBinding();
    } finally {
      this.observeAutomaticBinding();
      this.notifyBindingListeners();
    }
    return this.getCompatibilityMonitorSnapshot();
  }

  private async runAutomaticBinding(): Promise<CustomSiteBindingRecord | null> {
    const discovery = discoverAutomaticBinding(document, this.id);
    const current = this.binding;
    const currentComposer = query(current?.composerSelector ?? null);
    const messageDiscovery =
      discovery ?? discoverAutomaticMessages(document, currentComposer, this.id);
    if (!discovery && !currentComposer && (!current || !messageDiscovery)) return current;
    const composerSelector =
      currentComposer && current
        ? current.composerSelector
        : (discovery?.composerSelector ?? current?.composerSelector);
    if (!composerSelector) return current;
    const sendButtonSelector =
      current?.sendButtonSelector && query(current.sendButtonSelector)
        ? current.sendButtonSelector
        : (discovery?.sendButtonSelector ?? null);
    const preserveCurrentMessages =
      !current?.bindingSource ||
      current.bindingSource === 'manual' ||
      (current.bindingSource === 'mixed' &&
        current.automaticBindingVersion === AUTOMATIC_BINDING_VERSION);
    const currentAutomaticMessagesAreCurrent =
      current?.automaticBindingVersion === AUTOMATIC_BINDING_VERSION;
    const visibleMessageCount = (selector: string | null | undefined) =>
      queryAll(selector ?? null).filter((element) => !isHiddenMessageElement(element)).length;
    const currentUserMessageCount = visibleMessageCount(current?.userMessageSelector);
    const currentAssistantMessageCount = visibleMessageCount(current?.assistantMessageSelector);
    const discoveredUserMessageCount = visibleMessageCount(messageDiscovery?.userMessageSelector);
    const discoveredAssistantMessageCount = visibleMessageCount(
      messageDiscovery?.assistantMessageSelector,
    );
    const currentUserMessagesAreAdequate =
      currentUserMessageCount > 0 && currentUserMessageCount >= discoveredUserMessageCount;
    const currentAssistantMessagesAreAdequate =
      currentAssistantMessageCount > 0 &&
      currentAssistantMessageCount >= discoveredAssistantMessageCount;
    const currentUserSelectorIsStable = !isFragileMessageCollectionSelector(
      current?.userMessageSelector ?? null,
    );
    const currentAssistantSelectorIsStable = !isFragileMessageCollectionSelector(
      current?.assistantMessageSelector ?? null,
    );
    const userMessageSelector =
      current?.userMessageSelector &&
      ((preserveCurrentMessages && currentUserMessagesAreAdequate && currentUserSelectorIsStable) ||
        (currentAutomaticMessagesAreCurrent &&
          currentUserMessagesAreAdequate &&
          currentUserSelectorIsStable) ||
        !messageDiscovery?.userMessageSelector)
        ? current.userMessageSelector
        : (messageDiscovery?.userMessageSelector ?? null);
    const assistantMessageSelector =
      current?.assistantMessageSelector &&
      ((preserveCurrentMessages &&
        currentAssistantMessagesAreAdequate &&
        currentAssistantSelectorIsStable) ||
        (currentAutomaticMessagesAreCurrent &&
          currentAssistantMessagesAreAdequate &&
          currentAssistantSelectorIsStable) ||
        !messageDiscovery?.assistantMessageSelector)
        ? current.assistantMessageSelector
        : (messageDiscovery?.assistantMessageSelector ?? null);

    if (
      current &&
      current.composerSelector === composerSelector &&
      current.sendButtonSelector === sendButtonSelector &&
      current.userMessageSelector === userMessageSelector &&
      current.assistantMessageSelector === assistantMessageSelector &&
      current.automaticBindingVersion === AUTOMATIC_BINDING_VERSION
    ) {
      return current;
    }

    const now = Date.now();
    const bindingSource = current
      ? current.bindingSource === 'automatic'
        ? 'automatic'
        : 'mixed'
      : 'automatic';
    const next: CustomSiteBindingRecord = {
      id: current?.id ?? createBindingId(this.id, location.origin),
      origin: location.origin,
      platformId: this.id,
      accountScopeId: current?.accountScopeId ?? 'anonymous',
      composerSelector,
      sendButtonSelector,
      messageContainerSelector: current?.messageContainerSelector ?? null,
      userMessageSelector,
      assistantMessageSelector,
      modelControlSelector: current?.modelControlSelector ?? null,
      generationIndicatorSelector: current?.generationIndicatorSelector ?? null,
      enabled: true,
      bindingSource,
      automaticBindingVersion: AUTOMATIC_BINDING_VERSION,
      lastValidatedAt: now,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    };
    const response = (await browser.runtime.sendMessage({
      type: 'binding.save',
      binding: next,
    })) as RuntimeResponse;
    if (response.ok) this.setBinding(response.binding ?? next);
    return this.binding;
  }

  private observeAutomaticBinding(): void {
    this.automaticBindingObserver?.disconnect();
    if (this.automaticCompatibilityInterval !== null) {
      window.clearInterval(this.automaticCompatibilityInterval);
    }
    this.automaticComposerElement = query(this.binding?.composerSelector ?? null);
    this.automaticUserMessageElement = query(this.binding?.userMessageSelector ?? null);
    this.automaticAssistantMessageElement = query(this.binding?.assistantMessageSelector ?? null);
    const composerReady = this.automaticComposerElement !== null;
    const promptsReady = this.automaticUserMessageElement !== null;
    const responsesReady = this.automaticAssistantMessageElement !== null;
    this.automaticPromptReady = composerReady && promptsReady;
    this.automaticMessagesReady = composerReady && promptsReady && responsesReady;
    this.automaticBindingObserver = new MutationObserver(() => this.checkAutomaticBindingState());
    this.automaticBindingObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    this.automaticCompatibilityInterval = window.setInterval(
      () => this.checkAutomaticBindingState(),
      5_000,
    );
  }

  private checkAutomaticBindingState(): void {
    const wasPromptReady = this.automaticPromptReady;
    const wasMessagesReady = this.automaticMessagesReady;
    const nextComposerElement = query(this.binding?.composerSelector ?? null);
    const nextUserMessageElement = query(this.binding?.userMessageSelector ?? null);
    const nextAssistantMessageElement = query(this.binding?.assistantMessageSelector ?? null);
    const boundElementsChanged =
      nextComposerElement !== this.automaticComposerElement ||
      nextUserMessageElement !== this.automaticUserMessageElement ||
      nextAssistantMessageElement !== this.automaticAssistantMessageElement;
    this.automaticComposerElement = nextComposerElement;
    this.automaticUserMessageElement = nextUserMessageElement;
    this.automaticAssistantMessageElement = nextAssistantMessageElement;
    const nextComposerReady = nextComposerElement !== null;
    const nextPromptsReady = nextUserMessageElement !== null;
    const nextResponsesReady = nextAssistantMessageElement !== null;
    this.automaticPromptReady = nextComposerReady && nextPromptsReady;
    this.automaticMessagesReady = nextComposerReady && nextPromptsReady && nextResponsesReady;

    if (boundElementsChanged) {
      this.lastCompatibilityChangeAt = Date.now();
      this.notifyBindingListeners();
    }

    const lostKnownPromptBinding = wasPromptReady && !this.automaticPromptReady;
    const lostKnownMessageBinding = wasMessagesReady && !this.automaticMessagesReady;
    const configuredComposerMissing = Boolean(this.binding?.composerSelector && !nextComposerReady);
    const configuredMessagesMissing = Boolean(
      (this.binding?.userMessageSelector || this.binding?.assistantMessageSelector) &&
      !nextPromptsReady &&
      !nextResponsesReady,
    );
    const discoveryIncomplete = Boolean(
      !this.binding?.composerSelector ||
      !this.binding?.userMessageSelector ||
      !this.binding?.assistantMessageSelector,
    );
    if (
      lostKnownPromptBinding ||
      lostKnownMessageBinding ||
      configuredComposerMissing ||
      configuredMessagesMissing ||
      discoveryIncomplete
    ) {
      this.scheduleAutomaticRecovery();
    }
  }

  private scheduleAutomaticRecovery(): void {
    if (this.automaticBindingTimer !== null) return;
    const elapsed = Date.now() - (this.lastCompatibilityRecoveryAt ?? 0);
    const delay = Math.max(350, 1_500 - elapsed);
    this.automaticBindingTimer = window.setTimeout(() => {
      this.automaticBindingTimer = null;
      this.compatibilityRecoveryAttempts += 1;
      this.lastCompatibilityRecoveryAt = Date.now();
      void this.ensureAutomaticBinding().catch(() => {
        // Automatic recovery fails closed and retries only after later DOM activity or a watchdog tick.
      });
    }, delay);
  }

  dispose(): void {
    for (const observer of this.observers) observer.disconnect();
    this.observers.clear();
    this.automaticBindingObserver?.disconnect();
    this.automaticBindingObserver = null;
    if (this.automaticCompatibilityInterval !== null) {
      window.clearInterval(this.automaticCompatibilityInterval);
    }
    this.automaticCompatibilityInterval = null;
    if (this.automaticBindingTimer !== null) window.clearTimeout(this.automaticBindingTimer);
    this.automaticBindingTimer = null;
    this.automaticPromptReady = false;
    this.automaticMessagesReady = false;
    this.automaticComposerElement = null;
    this.automaticUserMessageElement = null;
    this.automaticAssistantMessageElement = null;
    this.bindingListeners.clear();
  }

  getCapabilities(): ReadonlySet<PlatformCapability> {
    const capabilities = new Set<PlatformCapability>();
    if (query(this.binding?.composerSelector ?? null)) {
      capabilities.add('composer.read');
      capabilities.add('composer.write');
      capabilities.add('composer.observe');
      capabilities.add('draft');
      capabilities.add('quote-reply');
      capabilities.add('layout');
    }
    if (
      queryAll(this.binding?.userMessageSelector ?? null).length > 0 ||
      queryAll(this.binding?.assistantMessageSelector ?? null).length > 0
    ) {
      capabilities.add('messages.read');
      capabilities.add('messages.observe');
      capabilities.add('messages.scroll');
      capabilities.add('conversation.metadata');
      if (shouldShowExtensionTimeline(this.id)) capabilities.add('timeline');
      capabilities.add('export');
      if (shouldShowExtensionBranch(this.id)) capabilities.add('conversation.fork.manual');
    }
    if (query(this.binding?.modelControlSelector ?? null)) {
      capabilities.add('model.select');
    }
    return capabilities;
  }

  async getCurrentAccountScope(): Promise<string> {
    return 'anonymous';
  }

  async getCurrentConversation(): Promise<PlatformConversation> {
    const url = sanitizeConversationUrl(location.href);
    return {
      platform: this.id,
      accountScopeId: 'anonymous',
      conversationId: conversationIdFromUrl(url),
      url,
      title: document.title || null,
      createdAt: null,
      updatedAt: null,
    };
  }

  async findComposer(): Promise<ComposerHandle | null> {
    const editable = query(this.binding?.composerSelector ?? null);
    if (!editable) return null;
    return {
      root: editable.parentElement ?? editable,
      editable,
      sendButton: query(this.binding?.sendButtonSelector ?? null),
    };
  }

  async readComposer(): Promise<string> {
    const composer = await this.findComposer();
    if (!composer) throw new CapabilityUnavailableError('composer.read');
    return readEditable(composer.editable);
  }

  async writeComposer(
    value: string,
    options: { mode: 'replace' | 'insert-at-cursor' | 'append'; focus?: boolean } = {
      mode: 'replace',
    },
  ): Promise<void> {
    const composer = await this.findComposer();
    if (!composer) throw new CapabilityUnavailableError('composer.write');
    writeEditable(composer.editable, value, options.mode);
    if (options.focus !== false) composer.editable.focus();
  }

  observeComposer(callback: (value: string) => void): () => void {
    let current: HTMLElement | null = null;
    const input = () => {
      if (current) callback(readEditable(current));
    };
    const bind = () => {
      const next = query(this.binding?.composerSelector ?? null);
      if (next === current) return;
      current?.removeEventListener('input', input);
      current = next;
      current?.addEventListener('input', input);
    };
    bind();
    const observer = new MutationObserver(bind);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    this.observers.add(observer);
    return () => {
      current?.removeEventListener('input', input);
      observer.disconnect();
      this.observers.delete(observer);
    };
  }

  async getMessages(): Promise<PlatformMessage[]> {
    const root = query(this.binding?.messageContainerSelector ?? null) ?? document;
    const user = queryAll(this.binding?.userMessageSelector ?? null, root).map((element) => ({
      element,
      role: 'user' as const,
    }));
    const assistant = queryAll(this.binding?.assistantMessageSelector ?? null, root).map(
      (element) => ({
        element,
        role: 'assistant' as const,
      }),
    );
    const all = deduplicateMessageElements([...user, ...assistant]).sort((a, b) => {
      if (a.element === b.element) return 0;
      return a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING
        ? -1
        : 1;
    });
    const conversation = await this.getCurrentConversation();
    return all.map(({ element, role }, order) => ({
      platform: this.id,
      conversationId: conversation.conversationId,
      messageId: element.id || null,
      runtimeMessageId: `${role}:${order}`,
      role,
      plainText: element.innerText || element.textContent || '',
      html: element.innerHTML,
      timestamp: null,
      timestampSource: 'unknown',
      element,
      order,
    }));
  }

  observeMessages(callback: (messages: PlatformMessage[]) => void): () => void {
    let queued = false;
    let currentRoot: HTMLElement | null = null;
    const emit = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        void this.getMessages().then(callback);
      });
    };
    const messageObserver = new MutationObserver(emit);
    const bindRoot = () => {
      const nextRoot = query(this.binding?.messageContainerSelector ?? null) ?? document.body;
      if (nextRoot === currentRoot) return;
      messageObserver.disconnect();
      currentRoot = nextRoot;
      messageObserver.observe(nextRoot, { childList: true, subtree: true, characterData: true });
      emit();
    };
    bindRoot();
    const rootObserver = new MutationObserver(bindRoot);
    rootObserver.observe(document.documentElement, { childList: true, subtree: true });
    this.observers.add(messageObserver);
    this.observers.add(rootObserver);
    return () => {
      messageObserver.disconnect();
      rootObserver.disconnect();
      this.observers.delete(messageObserver);
      this.observers.delete(rootObserver);
    };
  }

  async selectModel(modelInput: string): Promise<{ model: string }> {
    const control = query(this.binding?.modelControlSelector ?? null);
    return selectBoundModel(control, modelInput);
  }

  async getSelectedModel(): Promise<string | null> {
    const control = query(this.binding?.modelControlSelector ?? null);
    if (!control) return null;
    if (control instanceof HTMLSelectElement) {
      return control.selectedOptions[0]?.textContent?.trim() || control.value.trim() || null;
    }
    return (
      (
        control.innerText ||
        control.textContent ||
        control.getAttribute('aria-label') ||
        ''
      ).trim() || null
    );
  }

  observeAnswerCompletions(callback: (completion: PlatformAnswerCompletion) => void): () => void {
    const observation = createAnswerCompletionObserver({
      getMessages: () => this.getMessages(),
      getGenerationIndicator: () => query(this.binding?.generationIndicatorSelector ?? null),
      getMessageRoot: () => query(this.binding?.messageContainerSelector ?? null),
      onComplete: callback,
    });
    this.observers.add(observation.observer);
    return () => {
      observation.stop();
      this.observers.delete(observation.observer);
    };
  }

  async scrollToMessage(message: PlatformMessage, behavior: 'smooth' | 'instant'): Promise<void> {
    let target = message.element;
    const currentMessages = await this.getMessages();
    if (currentMessages.length) {
      const sameConversation = currentMessages.filter(
        (candidate) => candidate.conversationId === message.conversationId,
      );
      const resolved =
        (message.messageId
          ? sameConversation.find((candidate) => candidate.messageId === message.messageId)?.element
          : undefined) ??
        sameConversation.find(
          (candidate) =>
            candidate.role === message.role &&
            candidate.order === message.order &&
            candidate.plainText === message.plainText,
        )?.element ??
        sameConversation.find(
          (candidate) =>
            candidate.role === message.role && candidate.plainText === message.plainText,
        )?.element;
      if (resolved) target = resolved;
      else if (!sameConversation.some((candidate) => candidate.element === target)) return;
    }
    if (!target.isConnected || isHiddenMessageElement(target)) return;
    scrollElementToCenter(target, behavior);
  }

  async forkConversation(
    message: PlatformMessage,
  ): Promise<{ method: 'native' | 'manual'; newUrl?: string }> {
    if (!shouldShowExtensionBranch(this.id)) {
      throw new CapabilityUnavailableError('conversation.fork.manual');
    }
    const messages = await this.getMessages();
    const available = messages.some(
      (candidate) =>
        candidate.runtimeMessageId === message.runtimeMessageId &&
        candidate.order === message.order &&
        candidate.role === message.role,
    );
    if (!available) throw new CapabilityUnavailableError('conversation.fork.manual');
    return { method: 'manual' };
  }

  async getSidebarRoot(): Promise<HTMLElement | null> {
    return null;
  }

  async getConversationListRoot(): Promise<HTMLElement | null> {
    return null;
  }

  async getConversationItems(): Promise<PlatformConversation[]> {
    return [];
  }

  async openConversation(): Promise<void> {
    throw new CapabilityUnavailableError('conversation.list');
  }
}
