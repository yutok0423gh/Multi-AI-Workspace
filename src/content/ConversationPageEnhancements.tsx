import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { UserBoundPlatformAdapter } from '../platforms/base/UserBoundPlatformAdapter';
import { useI18n } from '../shared/i18n/I18nContext';
import type { PlatformId, PlatformMessage } from '../shared/types/platform';
import type {
  ConversationPinRecord,
  TextHighlightColor,
  TextHighlightRecord,
} from '../shared/types/records';
import { deleteRecord, listRecords, putRecord } from './database';
import {
  rangesMatch,
  rangesOverlap,
  recordIntervals,
  replaceMessageHighlightRecords,
  subtractRange,
} from './conversationHighlightRecords';
import type { ConversationScope, SelectionDescriptor } from './conversationHighlightRecords';
import {
  conversationPinPreview,
  createPointPinTarget,
  createElementIndexPath,
  createConversationPinId,
  findSelectionPinAnchor,
  MAX_CONVERSATION_PINS,
  MAX_PIN_SELECTION_LENGTH,
  measureConversationPinPosition,
  resolveElementIndexPath,
  scrollConversationPinIntoView,
  type ConversationPointPinTarget,
} from './conversationPins';
import {
  measureMessageRailPosition,
  mergeObservedMessageWindows,
  messageNavigatorScrollBehavior,
  messageWindowSignature,
  scrollToMessageRailPosition,
  spreadRailPercentages,
} from './messageNavigator';
import {
  applyHighlightInterval,
  createRangeFromOffsets,
  createTextHighlightId,
  getMessageKey,
  getRangeOffsets,
  getTextOnlyClientRects,
  hashHighlightText,
  normalizeHighlightIntervals,
  removeHighlightInterval,
  splitRangeAcrossMessages,
  TEXT_HIGHLIGHT_BACKGROUNDS,
} from './textHighlights';
import type { SelectedTextSnapshot } from './useSelectedText';
import { SHADOW_HOST_SELECTOR } from './shadowRoot';

export interface ResolvedTextHighlight {
  id: string;
  color: TextHighlightColor;
  range: Range;
}

export interface ResolvedConversationPin {
  id: string;
  range: Range;
  message: PlatformMessage;
  messageKey: string;
  startOffset: number;
  endOffset: number;
  preview: string;
  createdAt: number;
  anchorXRatio?: number;
  anchorYRatio?: number;
}

export type HighlightMutationResult = 'added' | 'removed' | 'unchanged' | 'unavailable';
export type PinMutationResult = 'added' | 'removed' | 'unchanged' | 'unavailable' | 'limit-reached';

export interface PinTargetMutation {
  result: PinMutationResult;
  pinId: string | null;
}

interface ConversationPinDescriptor extends SelectionDescriptor {
  anchorKind?: 'point' | 'text';
  anchorXRatio?: number;
  anchorYRatio?: number;
  documentYRatio?: number;
}

function findMessageForRecord(
  messages: PlatformMessage[],
  record: Pick<TextHighlightRecord | ConversationPinRecord, 'messageId' | 'messageKey'>,
): PlatformMessage | undefined {
  if (record.messageId) {
    const byId = messages.find((message) => message.messageId === record.messageId);
    if (byId) return byId;
  }
  return messages.find((message) => getMessageKey(message) === record.messageKey);
}

function createSelectionAnchorMessage(
  platformId: PlatformId,
  conversationId: string,
  element: HTMLElement,
  anchorPath: string,
): PlatformMessage {
  return {
    platform: platformId,
    conversationId,
    messageId: null,
    runtimeMessageId: `selection-anchor:${anchorPath}`,
    role: 'unknown',
    plainText: '',
    html: null,
    timestamp: null,
    timestampSource: 'unknown',
    element,
    order: Number.MAX_SAFE_INTEGER,
  };
}

function compareResolvedPins(
  left: ResolvedConversationPin,
  right: ResolvedConversationPin,
): number {
  if (left.message.element === right.message.element) {
    if (left.anchorYRatio !== undefined || right.anchorYRatio !== undefined) {
      return (left.anchorYRatio ?? 0) - (right.anchorYRatio ?? 0);
    }
    return left.startOffset - right.startOffset;
  }
  const position = left.message.element.compareDocumentPosition(right.message.element);
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return left.createdAt - right.createdAt;
}

function describeSelectionParts(
  selection: SelectedTextSnapshot,
  messages: PlatformMessage[],
  scope: ConversationScope | null,
  adapter: UserBoundPlatformAdapter,
): SelectionDescriptor[] {
  if (!scope || selection.range.toString().length > 20_000) return [];
  return splitRangeAcrossMessages(selection.range, messages).flatMap(({ message, range }) => {
    const offsets = getRangeOffsets(message.element, range);
    if (!offsets) return [];
    const messageKey = getMessageKey(message);
    return [
      {
        id: createTextHighlightId(
          adapter.id,
          scope.accountScopeId,
          scope.conversationId,
          messageKey,
          offsets.startOffset,
          offsets.endOffset,
        ),
        message,
        messageKey,
        anchorPath: null,
        range,
        ...offsets,
      },
    ];
  });
}

export function useConversationPageEnhancements(
  adapter: UserBoundPlatformAdapter,
  enabled: boolean,
  routeRevision: number,
  bindingRevision = 0,
) {
  const [messages, setMessages] = useState<PlatformMessage[]>([]);
  const [records, setRecords] = useState<TextHighlightRecord[]>([]);
  const [pinRecords, setPinRecords] = useState<ConversationPinRecord[]>([]);
  const [resolvedHighlights, setResolvedHighlights] = useState<ResolvedTextHighlight[]>([]);
  const [resolvedPins, setResolvedPins] = useState<ResolvedConversationPin[]>([]);
  const [transientHighlights, setTransientHighlights] = useState<ResolvedTextHighlight[]>([]);
  const [scope, setScope] = useState<ConversationScope | null>(null);

  useEffect(() => {
    if (!enabled) {
      queueMicrotask(() => {
        setMessages([]);
        setRecords([]);
        setPinRecords([]);
        setResolvedHighlights([]);
        setResolvedPins([]);
        setScope(null);
      });
      return;
    }
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setMessages([]);
      setRecords([]);
      setPinRecords([]);
      setResolvedHighlights([]);
      setResolvedPins([]);
      setScope(null);
    });

    void Promise.all([
      adapter.getMessages(),
      adapter.getCurrentConversation(),
      adapter.getCurrentAccountScope(),
      listRecords('textHighlights'),
      listRecords('conversationPins'),
    ])
      .then(([nextMessages, conversation, accountScopeId, allRecords, allPins]) => {
        if (!active) return;
        const conversationId = conversation.conversationId ?? conversation.url;
        setMessages(nextMessages);
        setScope({ accountScopeId, conversationId });
        setRecords(
          allRecords.filter(
            (record) =>
              record.platformId === adapter.id &&
              record.accountScopeId === accountScopeId &&
              record.conversationId === conversationId,
          ),
        );
        setPinRecords(
          allPins.filter(
            (record) =>
              record.platformId === adapter.id &&
              record.accountScopeId === accountScopeId &&
              record.conversationId === conversationId,
          ),
        );
      })
      .catch(() => {
        // Page enhancements fail closed if the current site cannot expose safe message anchors.
      });

    const unsubscribe = adapter.observeMessages((nextMessages) => {
      if (active) setMessages(nextMessages);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [adapter, bindingRevision, enabled, routeRevision]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setTransientHighlights([]);
    });
    return () => {
      active = false;
    };
  }, [adapter, routeRevision]);

  useEffect(() => {
    let active = true;
    void Promise.all(
      records.map(async (record) => {
        const message = findMessageForRecord(messages, record);
        if (!message) return null;
        const range = createRangeFromOffsets(message.element, record.startOffset, record.endOffset);
        if (!range || (await hashHighlightText(range.toString())) !== record.textHash) return null;
        return { message, record };
      }),
    ).then((items) => {
      if (!active) return;
      const grouped = new Map<
        string,
        { message: PlatformMessage; records: TextHighlightRecord[] }
      >();
      for (const item of items) {
        if (!item) continue;
        const group = grouped.get(item.record.messageKey) ?? {
          message: item.message,
          records: [],
        };
        group.records.push(item.record);
        grouped.set(item.record.messageKey, group);
      }
      setResolvedHighlights(
        [...grouped.values()].flatMap(({ message, records: messageRecords }) =>
          normalizeHighlightIntervals(recordIntervals(messageRecords)).flatMap((interval) => {
            const range = createRangeFromOffsets(
              message.element,
              interval.startOffset,
              interval.endOffset,
            );
            if (!range) return [];
            return [
              {
                id: createTextHighlightId(
                  messageRecords[0].platformId,
                  messageRecords[0].accountScopeId,
                  messageRecords[0].conversationId,
                  messageRecords[0].messageKey,
                  interval.startOffset,
                  interval.endOffset,
                ),
                color: interval.color,
                range,
              },
            ];
          }),
        ),
      );
    });
    return () => {
      active = false;
    };
  }, [messages, records]);

  useEffect(() => {
    let active = true;
    void Promise.all(
      pinRecords.map(async (record): Promise<ResolvedConversationPin | null> => {
        let message = findMessageForRecord(messages, record);
        if (!message && record.anchorPath) {
          const element = resolveElementIndexPath(document, record.anchorPath);
          if (element) {
            message = createSelectionAnchorMessage(
              record.platformId,
              record.conversationId,
              element,
              record.anchorPath,
            );
          }
        }
        if (
          !message &&
          record.anchorKind === 'point' &&
          typeof record.documentYRatio === 'number' &&
          document.body
        ) {
          message = createSelectionAnchorMessage(
            record.platformId,
            record.conversationId,
            document.body,
            'document-fallback',
          );
        }
        if (!message) return null;
        const range =
          record.anchorKind === 'point'
            ? (() => {
                const pointRange = document.createRange();
                pointRange.selectNodeContents(message.element);
                pointRange.collapse(true);
                return pointRange;
              })()
            : createRangeFromOffsets(message.element, record.startOffset, record.endOffset);
        if (!range) return null;
        if (
          record.anchorKind !== 'point' &&
          (await hashHighlightText(range.toString())) !== record.textHash
        ) {
          return null;
        }
        const fallbackAnchorY =
          message.element === document.body ? record.documentYRatio : record.anchorYRatio;
        return {
          id: record.id,
          range,
          message,
          messageKey: record.messageKey,
          startOffset: record.startOffset,
          endOffset: record.endOffset,
          preview:
            record.anchorKind === 'point'
              ? conversationPinPreview(
                  message.plainText ||
                    message.element.innerText ||
                    message.element.textContent ||
                    '',
                )
              : conversationPinPreview(range.toString()),
          createdAt: record.createdAt,
          anchorXRatio: record.anchorXRatio,
          anchorYRatio: fallbackAnchorY,
        };
      }),
    ).then((items) => {
      if (!active) return;
      setResolvedPins(
        items
          .filter((item): item is ResolvedConversationPin => item !== null)
          .sort(compareResolvedPins),
      );
    });
    return () => {
      active = false;
    };
  }, [messages, pinRecords]);

  const isSelectionHighlighted = useCallback(
    (selection: SelectedTextSnapshot | null): boolean => {
      if (!selection) return false;
      if (
        transientHighlights.some((highlight) => rangesOverlap(highlight.range, selection.range))
      ) {
        return true;
      }
      const descriptors = describeSelectionParts(selection, messages, scope, adapter);
      return descriptors.some((descriptor) =>
        records.some(
          (record) =>
            record.messageKey === descriptor.messageKey &&
            record.startOffset < descriptor.endOffset &&
            record.endOffset > descriptor.startOffset,
        ),
      );
    },
    [adapter, messages, records, scope, transientHighlights],
  );

  const applyHighlight = useCallback(
    async (
      selection: SelectedTextSnapshot,
      color: TextHighlightColor,
    ): Promise<HighlightMutationResult> => {
      if (!selection.range.toString().trim() || selection.range.toString().length > 20_000) {
        return 'unavailable';
      }
      const descriptors = describeSelectionParts(selection, messages, scope, adapter);
      if (descriptors.length === 0 || !scope) {
        const unchanged = transientHighlights.some(
          (highlight) => highlight.color === color && rangesMatch(highlight.range, selection.range),
        );
        if (unchanged) return 'unchanged';
        setTransientHighlights((current) => {
          const remaining = current.flatMap((highlight) =>
            subtractRange(highlight.range, selection.range).map((range) => ({
              ...highlight,
              id: `transient:${crypto.randomUUID()}`,
              range,
            })),
          );
          return [
            ...remaining,
            {
              id: `transient:${crypto.randomUUID()}`,
              color,
              range: selection.range.cloneRange(),
            },
          ];
        });
        return 'added';
      }
      const now = Date.now();
      let workingRecords = records;
      let changed = false;
      for (const descriptor of descriptors) {
        const messageRecords = workingRecords.filter(
          (record) => record.messageKey === descriptor.messageKey,
        );
        const intervals = applyHighlightInterval(
          recordIntervals(messageRecords),
          descriptor.startOffset,
          descriptor.endOffset,
          color,
        );
        const replacement = await replaceMessageHighlightRecords(
          workingRecords,
          descriptor,
          intervals,
          adapter.id,
          scope,
          now,
        );
        workingRecords = replacement.records;
        changed ||= replacement.changed;
      }
      if (changed) setRecords(workingRecords);
      return changed ? 'added' : 'unchanged';
    },
    [adapter, messages, records, scope, transientHighlights],
  );

  const removeHighlight = useCallback(
    async (selection: SelectedTextSnapshot): Promise<HighlightMutationResult> => {
      if (!selection.range.toString().trim() || selection.range.toString().length > 20_000) {
        return 'unavailable';
      }
      const descriptors = describeSelectionParts(selection, messages, scope, adapter);
      if (descriptors.length === 0 || !scope) {
        const hasOverlap = transientHighlights.some((highlight) =>
          rangesOverlap(highlight.range, selection.range),
        );
        if (!hasOverlap) return 'unchanged';
        setTransientHighlights((current) =>
          current.flatMap((highlight) =>
            subtractRange(highlight.range, selection.range).map((range) => ({
              ...highlight,
              id: `transient:${crypto.randomUUID()}`,
              range,
            })),
          ),
        );
        return 'removed';
      }
      const now = Date.now();
      let workingRecords = records;
      let changed = false;
      for (const descriptor of descriptors) {
        const messageRecords = workingRecords.filter(
          (record) => record.messageKey === descriptor.messageKey,
        );
        const intervals = removeHighlightInterval(
          recordIntervals(messageRecords),
          descriptor.startOffset,
          descriptor.endOffset,
        );
        const replacement = await replaceMessageHighlightRecords(
          workingRecords,
          descriptor,
          intervals,
          adapter.id,
          scope,
          now,
        );
        workingRecords = replacement.records;
        changed ||= replacement.changed;
      }
      if (changed) setRecords(workingRecords);
      return changed ? 'removed' : 'unchanged';
    },
    [adapter, messages, records, scope, transientHighlights],
  );

  const selectionPinDescriptor = useCallback(
    (selection: SelectedTextSnapshot | null): SelectionDescriptor | null => {
      if (!selection) return null;
      const text = selection.range.toString();
      if (!text.trim() || text.length > MAX_PIN_SELECTION_LENGTH) return null;
      const descriptors = describeSelectionParts(selection, messages, scope, adapter);
      if (descriptors.length === 1) {
        return descriptors[0].range.toString() === text ? descriptors[0] : null;
      }
      if (descriptors.length > 1 || !scope) return null;
      const element = findSelectionPinAnchor(selection.range);
      const anchorPath = element ? createElementIndexPath(element) : null;
      if (!element || !anchorPath) return null;
      const offsets = getRangeOffsets(element, selection.range);
      if (!offsets) return null;
      const messageKey = `selection-anchor:${anchorPath}`;
      return {
        id: createTextHighlightId(
          adapter.id,
          scope.accountScopeId,
          scope.conversationId,
          messageKey,
          offsets.startOffset,
          offsets.endOffset,
        ),
        message: createSelectionAnchorMessage(
          adapter.id,
          scope.conversationId,
          element,
          anchorPath,
        ),
        messageKey,
        anchorPath,
        range: selection.range.cloneRange(),
        ...offsets,
      };
    },
    [adapter, messages, scope],
  );

  const pointPinDescriptor = useCallback(
    (target: ConversationPointPinTarget): ConversationPinDescriptor | null => {
      if (!scope) return null;
      const message = messages.find(
        (candidate) =>
          candidate.element === target.element || candidate.element.contains(target.element),
      );
      let element = message?.element ?? target.element;
      let anchorPath = createElementIndexPath(element);
      if (!message && !anchorPath && document.body) {
        element = document.body;
        anchorPath = createElementIndexPath(element);
      }
      if (!message && !anchorPath) return null;
      const rect = element.getBoundingClientRect();
      const anchorXRatio =
        rect.width > 0 ? Math.min(1, Math.max(0, (target.clientX - rect.left) / rect.width)) : 0.5;
      const anchorYRatio =
        rect.height > 0 ? Math.min(1, Math.max(0, (target.clientY - rect.top) / rect.height)) : 0.5;
      const documentHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body?.scrollHeight ?? 0,
        window.innerHeight,
      );
      const documentYRatio = Math.min(
        1,
        Math.max(0, (window.scrollY + target.clientY) / Math.max(documentHeight, 1)),
      );
      const messageKey = message ? getMessageKey(message) : `point-anchor:${anchorPath}`;
      const range = document.createRange();
      range.selectNodeContents(element);
      range.collapse(true);
      return {
        id: `point:${messageKey}:${Math.round(anchorXRatio * 10_000)}:${Math.round(anchorYRatio * 10_000)}`,
        message:
          message ??
          createSelectionAnchorMessage(adapter.id, scope.conversationId, element, anchorPath!),
        messageKey,
        anchorPath,
        range,
        startOffset: 0,
        endOffset: 0,
        anchorKind: 'point',
        anchorXRatio,
        anchorYRatio,
        documentYRatio,
      };
    },
    [adapter.id, messages, scope],
  );

  const getPinId = useCallback(
    (descriptor: ConversationPinDescriptor): string | null => {
      if (!scope) return null;
      return createConversationPinId(
        adapter.id,
        scope.accountScopeId,
        scope.conversationId,
        descriptor.messageKey,
        descriptor.startOffset,
        descriptor.endOffset,
        descriptor.anchorKind === 'point'
          ? `${Math.round((descriptor.anchorXRatio ?? 0.5) * 10_000)},${Math.round(
              (descriptor.anchorYRatio ?? 0.5) * 10_000,
            )}`
          : undefined,
      );
    },
    [adapter.id, scope],
  );

  const isSelectionPinnable = useCallback(
    (selection: SelectedTextSnapshot | null): boolean => selectionPinDescriptor(selection) !== null,
    [selectionPinDescriptor],
  );

  const isSelectionPinned = useCallback(
    (selection: SelectedTextSnapshot | null): boolean => {
      const descriptor = selectionPinDescriptor(selection);
      const id = descriptor ? getPinId(descriptor) : null;
      return Boolean(id && pinRecords.some((record) => record.id === id));
    },
    [getPinId, pinRecords, selectionPinDescriptor],
  );

  const persistPin = useCallback(
    async (descriptor: ConversationPinDescriptor | null): Promise<PinTargetMutation> => {
      const id = descriptor ? getPinId(descriptor) : null;
      if (!descriptor || !id || !scope) return { result: 'unavailable', pinId: null };
      if (pinRecords.some((record) => record.id === id)) {
        return { result: 'unchanged', pinId: id };
      }
      if (pinRecords.length >= MAX_CONVERSATION_PINS) {
        return { result: 'limit-reached', pinId: null };
      }
      const now = Date.now();
      const record: ConversationPinRecord = {
        id,
        platformId: adapter.id,
        accountScopeId: scope.accountScopeId,
        conversationId: scope.conversationId,
        messageKey: descriptor.messageKey,
        messageId: descriptor.message.messageId,
        anchorPath: descriptor.anchorPath,
        anchorKind: descriptor.anchorKind ?? 'text',
        anchorXRatio: descriptor.anchorXRatio,
        anchorYRatio: descriptor.anchorYRatio,
        documentYRatio: descriptor.documentYRatio,
        startOffset: descriptor.startOffset,
        endOffset: descriptor.endOffset,
        textHash: await hashHighlightText(
          descriptor.anchorKind === 'point' ? '' : descriptor.range.toString(),
        ),
        createdAt: now,
        updatedAt: now,
      };
      await putRecord('conversationPins', record);
      setPinRecords((current) =>
        current.some((candidate) => candidate.id === record.id) ? current : [...current, record],
      );
      return { result: 'added', pinId: id };
    },
    [adapter.id, getPinId, pinRecords, scope],
  );

  const pinSelection = useCallback(
    async (selection: SelectedTextSnapshot): Promise<PinMutationResult> =>
      (await persistPin(selectionPinDescriptor(selection))).result,
    [persistPin, selectionPinDescriptor],
  );

  const pinTarget = useCallback(
    async (target: ConversationPointPinTarget): Promise<PinTargetMutation> =>
      persistPin(pointPinDescriptor(target)),
    [persistPin, pointPinDescriptor],
  );

  const unpinSelection = useCallback(
    async (selection: SelectedTextSnapshot): Promise<PinMutationResult> => {
      const descriptor = selectionPinDescriptor(selection);
      const id = descriptor ? getPinId(descriptor) : null;
      if (!descriptor || !id) return 'unavailable';
      if (!pinRecords.some((record) => record.id === id)) return 'unchanged';
      await deleteRecord('conversationPins', id);
      setPinRecords((current) => current.filter((record) => record.id !== id));
      return 'removed';
    },
    [getPinId, pinRecords, selectionPinDescriptor],
  );

  const removePin = useCallback(
    async (id: string): Promise<void> => {
      if (!pinRecords.some((record) => record.id === id)) return;
      await deleteRecord('conversationPins', id);
      setPinRecords((current) => current.filter((record) => record.id !== id));
    },
    [pinRecords],
  );

  return useMemo(
    () => ({
      messages,
      resolvedHighlights: [...resolvedHighlights, ...transientHighlights],
      resolvedPins,
      pinReady: scope !== null,
      isSelectionHighlighted,
      isSelectionPinnable,
      isSelectionPinned,
      applyHighlight,
      removeHighlight,
      pinSelection,
      pinTarget,
      unpinSelection,
      removePin,
    }),
    [
      applyHighlight,
      isSelectionHighlighted,
      isSelectionPinnable,
      isSelectionPinned,
      messages,
      pinSelection,
      pinTarget,
      removeHighlight,
      removePin,
      resolvedHighlights,
      resolvedPins,
      scope,
      transientHighlights,
      unpinSelection,
    ],
  );
}

interface HighlightRectangle {
  id: string;
  color: TextHighlightColor;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface RailPoint {
  promptIndex: number;
  topPercent: number;
  scrollPercent: number;
  active: boolean;
}

interface PinPoint {
  pinIndex: number;
  topPercent: number;
  active: boolean;
}

interface OverlayLayout {
  rectangles: HighlightRectangle[];
  railPoints: RailPoint[];
  pinPoints: PinPoint[];
}

interface PinTargetRectangle {
  left: number;
  top: number;
  width: number;
  height: number;
}

const EMPTY_LAYOUT: OverlayLayout = { rectangles: [], railPoints: [], pinPoints: [] };
const EMPTY_PINS: ResolvedConversationPin[] = [];

function promptPreview(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:(?:你说|你說|您说|您說)|you said)\s*[:：]?\s*/i, '')
    .trim();
}

function isWorkspaceInteraction(event: Event): boolean {
  return event
    .composedPath()
    .some((target) => target instanceof Element && target.matches(SHADOW_HOST_SELECTOR));
}

function measurePointPinTarget(target: ConversationPointPinTarget): PinTargetRectangle {
  return {
    left: target.clientX - 8,
    top: target.clientY - 8,
    width: 16,
    height: 16,
  };
}

function findSharedPromptContainer(messages: PlatformMessage[]): HTMLElement | null {
  const elements = messages
    .map((message) => message.element)
    .filter((element) => element.isConnected);
  if (!elements.length) return null;

  let container = elements[0].parentElement;
  while (container && !elements.every((element) => container?.contains(element))) {
    container = container.parentElement;
  }
  return container;
}

export function ConversationPageOverlay({
  adapter,
  messages,
  highlights,
  pins = EMPTY_PINS,
  pinEnabled = false,
  pinMode = false,
  onPinModeChange = () => undefined,
  onPinTarget,
  onRemovePin = () => undefined,
  showPromptNavigator = true,
  navigatorRevision = 0,
}: {
  adapter: UserBoundPlatformAdapter;
  messages: PlatformMessage[];
  highlights: ResolvedTextHighlight[];
  pins?: ResolvedConversationPin[];
  pinEnabled?: boolean;
  pinMode?: boolean;
  onPinModeChange?: (active: boolean) => void;
  onPinTarget?: (target: ConversationPointPinTarget) => Promise<PinTargetMutation>;
  onRemovePin?: (id: string) => void | Promise<void>;
  showPromptNavigator?: boolean;
  navigatorRevision?: number;
}) {
  const t = useI18n();
  const [layout, setLayout] = useState<OverlayLayout>(EMPTY_LAYOUT);
  const [pinTargetRectangle, setPinTargetRectangle] = useState<PinTargetRectangle | null>(null);
  const [pinNotice, setPinNotice] = useState<PinTargetMutation | null>(null);
  const livePromptMessages = useMemo(
    () => (showPromptNavigator ? messages.filter((message) => message.role === 'user') : []),
    [messages, showPromptNavigator],
  );
  const livePromptContainer = useMemo(
    () => findSharedPromptContainer(livePromptMessages),
    [livePromptMessages],
  );
  const [promptMessages, setPromptMessages] =
    useState<PlatformMessage[]>(livePromptMessages);
  const promptScopeRef = useRef<string | null>(null);
  const promptContainerRef = useRef<HTMLElement | null>(livePromptContainer);
  const navigatorRevisionRef = useRef(navigatorRevision);
  const railPositionCacheRef = useRef(new Map<string, number>());

  useEffect(() => {
    if (!showPromptNavigator) return;
    const revisionChanged = navigatorRevisionRef.current !== navigatorRevision;
    if (revisionChanged) navigatorRevisionRef.current = navigatorRevision;
    if (!livePromptMessages.length) {
      if (revisionChanged) {
        promptScopeRef.current = null;
        promptContainerRef.current = null;
        railPositionCacheRef.current.clear();
        setPromptMessages([]);
      }
      return;
    }

    const conversationScope = `${adapter.id}:${
      livePromptMessages[0].conversationId ?? location.href
    }`;
    const scopeChanged = promptScopeRef.current !== conversationScope;
    const containerReplaced =
      Boolean(promptContainerRef.current) &&
      promptContainerRef.current !== livePromptContainer &&
      !promptContainerRef.current?.isConnected;
    if (revisionChanged || scopeChanged || containerReplaced) {
      promptScopeRef.current = conversationScope;
      promptContainerRef.current = livePromptContainer;
      railPositionCacheRef.current.clear();
      setPromptMessages(livePromptMessages);
      return;
    }
    if (livePromptContainer) promptContainerRef.current = livePromptContainer;
    setPromptMessages((observed) =>
      mergeObservedMessageWindows(observed, livePromptMessages),
    );
  }, [
    adapter.id,
    livePromptContainer,
    livePromptMessages,
    navigatorRevision,
    showPromptNavigator,
  ]);

  const promptEntryKeys = useMemo(() => {
    const occurrences = new Map<string, number>();
    return promptMessages.map((message) => {
      const signature = messageWindowSignature(message);
      const occurrence = occurrences.get(signature) ?? 0;
      occurrences.set(signature, occurrence + 1);
      return `${signature}:occurrence:${occurrence}`;
    });
  }, [promptMessages]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      const documentHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body?.scrollHeight ?? 0,
        window.innerHeight,
      );
      let activeIndex = -1;
      let activeDistance = Number.POSITIVE_INFINITY;
      const measuredPoints = promptMessages
        .map((message, promptIndex) => {
          const promptKey = promptEntryKeys[promptIndex];
          if (!message.element.isConnected) {
            const cachedPosition = railPositionCacheRef.current.get(promptKey);
            return cachedPosition === undefined
              ? null
              : {
                  promptIndex,
                  topPercent: cachedPosition,
                  scrollPercent: cachedPosition,
                  active: false,
                };
          }
          const rect = message.element.getBoundingClientRect();
          const measurement = measureMessageRailPosition(message.element, documentHeight);
          railPositionCacheRef.current.set(promptKey, measurement.topPercent);
          const distance = Math.abs(rect.top + rect.height / 2 - measurement.viewportCenter);
          if (distance < activeDistance) {
            activeDistance = distance;
            activeIndex = promptIndex;
          }
          return {
            promptIndex,
            topPercent: measurement.topPercent,
            scrollPercent: measurement.topPercent,
            active: false,
          };
        })
        .filter((item) => item !== null);
      const distributedPositions = spreadRailPercentages(
        measuredPoints.map((point) => point.topPercent),
      );
      const railPoints = measuredPoints.map((point, index) => ({
        ...point,
        topPercent: distributedPositions[index],
      }));
      for (const point of railPoints) point.active = point.promptIndex === activeIndex;

      let activePinIndex = -1;
      let activePinDistance = Number.POSITIVE_INFINITY;
      const measuredPinPoints = pins
        .map((pin, pinIndex) => {
          if (!pin.message.element.isConnected) return null;
          const measurement = measureConversationPinPosition(
            pin.range,
            pin.message.element,
            documentHeight,
            pin.anchorYRatio,
          );
          let rect: DOMRect;
          if (pin.anchorYRatio !== undefined) {
            const elementRect = pin.message.element.getBoundingClientRect();
            rect = {
              ...elementRect,
              top: elementRect.top + elementRect.height * pin.anchorYRatio,
              bottom: elementRect.top + elementRect.height * pin.anchorYRatio,
              height: 0,
            } as DOMRect;
          } else
            try {
              rect = pin.range.getBoundingClientRect();
            } catch {
              rect = pin.message.element.getBoundingClientRect();
            }
          const distance = Math.abs(rect.top + rect.height / 2 - measurement.viewportCenter);
          if (distance < activePinDistance) {
            activePinDistance = distance;
            activePinIndex = pinIndex;
          }
          return { pinIndex, topPercent: measurement.topPercent, active: false };
        })
        .filter((item) => item !== null);
      const distributedPinPositions = spreadRailPercentages(
        measuredPinPoints.map((point) => point.topPercent),
      );
      const pinPoints = measuredPinPoints.map((point, index) => ({
        ...point,
        topPercent: distributedPinPositions[index],
      }));
      for (const point of pinPoints) point.active = point.pinIndex === activePinIndex;

      const rectangles = highlights.flatMap(({ id, color, range }) => {
        try {
          return getTextOnlyClientRects(range)
            .filter(
              (rect) =>
                rect.width > 0 &&
                rect.height > 0 &&
                rect.bottom >= 0 &&
                rect.top <= window.innerHeight,
            )
            .map((rect, index) => ({
              id: `${id}:${index}`,
              color,
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
            }));
        } catch {
          return [];
        }
      });
      setLayout({ rectangles, railPoints, pinPoints });
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
  }, [highlights, pins, promptEntryKeys, promptMessages]);

  useEffect(() => {
    if (!pinMode || !onPinTarget) return;

    const previewTarget = (event: PointerEvent) => {
      if (isWorkspaceInteraction(event)) return;
      const target = createPointPinTarget(event.target, event.clientX, event.clientY);
      setPinTargetRectangle(target ? measurePointPinTarget(target) : null);
    };
    const selectTarget = (event: MouseEvent) => {
      if (isWorkspaceInteraction(event)) return;
      event.preventDefault();
      event.stopPropagation();
      const target = createPointPinTarget(event.target, event.clientX, event.clientY);
      if (!target) {
        setPinNotice({ result: 'unavailable', pinId: null });
        setPinTargetRectangle(null);
        return;
      }
      onPinModeChange(false);
      setPinTargetRectangle(null);
      void onPinTarget(target)
        .then(setPinNotice)
        .catch(() => setPinNotice({ result: 'unavailable', pinId: null }));
    };
    const cancelMode = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      onPinModeChange(false);
      setPinTargetRectangle(null);
    };

    document.addEventListener('pointermove', previewTarget, true);
    document.addEventListener('click', selectTarget, true);
    document.addEventListener('keydown', cancelMode, true);
    return () => {
      document.removeEventListener('pointermove', previewTarget, true);
      document.removeEventListener('click', selectTarget, true);
      document.removeEventListener('keydown', cancelMode, true);
    };
  }, [onPinModeChange, onPinTarget, pinMode]);

  const jumpToPin = (pinIndex: number) => {
    const pin = pins[pinIndex];
    if (!pin) return;
    scrollConversationPinIntoView(pin.range, pin.message.element, 'smooth', pin.anchorYRatio);
  };

  const stepPin = (direction: -1 | 1) => {
    if (!pins.length) return;
    const activeIndex = layout.pinPoints.find((point) => point.active)?.pinIndex ?? 0;
    jumpToPin((activeIndex + direction + pins.length) % pins.length);
  };

  const removePin = async (id: string) => {
    await onRemovePin(id);
    if (pinNotice?.pinId === id) setPinNotice(null);
  };

  const jumpToPrompt = async (message: PlatformMessage, promptIndex: number) => {
    const scrollBehavior = messageNavigatorScrollBehavior(adapter.id);
    if (message.element.isConnected) {
      await adapter.scrollToMessage(message, scrollBehavior);
      return;
    }
    const point = layout.railPoints.find((entry) => entry.promptIndex === promptIndex);
    const connectedReference = promptMessages.find((candidate) => candidate.element.isConnected);
    if (!point || !connectedReference) return;
    if (
      !scrollToMessageRailPosition(
        connectedReference.element,
        point.scrollPercent,
        scrollBehavior,
      )
    ) {
      return;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 180));
    const signature = messageWindowSignature(message);
    const occurrence = promptMessages
      .slice(0, promptIndex)
      .filter((candidate) => messageWindowSignature(candidate) === signature).length;
    const refreshedMatches = (await adapter.getMessages()).filter(
      (candidate) =>
        candidate.role === 'user' && messageWindowSignature(candidate) === signature,
    );
    const refreshed = refreshedMatches[occurrence] ?? refreshedMatches[0];
    if (refreshed?.element.isConnected) {
      await adapter.scrollToMessage(refreshed, scrollBehavior);
    }
  };

  const noticeMessage = pinNotice
    ? t(
        pinNotice.result === 'added'
          ? 'pinAdded'
          : pinNotice.result === 'unchanged'
            ? 'pinAlreadyExists'
            : pinNotice.result === 'limit-reached'
              ? 'pinLimitReached'
              : 'pinTargetUnavailable',
      )
    : null;

  return (
    <>
      <div className="maw-highlight-layer" aria-hidden="true">
        {layout.rectangles.map((rectangle) => (
          <span
            className="maw-highlight-rectangle"
            key={rectangle.id}
            style={{
              left: rectangle.left,
              top: rectangle.top,
              width: rectangle.width,
              height: rectangle.height,
              background: TEXT_HIGHLIGHT_BACKGROUNDS[rectangle.color],
            }}
          />
        ))}
      </div>
      {pinEnabled && pinMode && onPinTarget ? (
        <span className="maw-pin-mode-hint">{t('pinModeHint')}</span>
      ) : null}
      {pinTargetRectangle ? (
        <span className="maw-pin-target-preview" aria-hidden="true" style={pinTargetRectangle} />
      ) : null}
      {noticeMessage ? (
        <div
          className={`maw-pin-notice ${pinNotice?.result === 'added' ? 'success' : ''}`}
          role="status"
        >
          <span>{noticeMessage}</span>
          {pinNotice?.pinId ? (
            <button type="button" onClick={() => void removePin(pinNotice.pinId!)}>
              {t('undoPin')}
            </button>
          ) : null}
          <button
            className="maw-pin-notice-dismiss"
            type="button"
            aria-label={t('dismissPinNotice')}
            onClick={() => setPinNotice(null)}
          >
            ×
          </button>
        </div>
      ) : null}
      {showPromptNavigator && promptMessages.length && layout.railPoints.length ? (
        <nav className="maw-prompt-navigator" aria-label={t('messageNavigator')}>
          <div className="maw-prompt-card">
            <div className="maw-prompt-card-heading">
              <strong>{t('messageNavigator')}</strong>
              <span>{promptMessages.length}</span>
            </div>
            <div className="maw-prompt-list">
              {promptMessages.map((message, promptIndex) => {
                const point = layout.railPoints.find((entry) => entry.promptIndex === promptIndex);
                const preview = promptPreview(message.plainText);
                return (
                  <button
                    className={point?.active ? 'active' : ''}
                    type="button"
                    aria-current={point?.active ? 'location' : undefined}
                    key={promptEntryKeys[promptIndex]}
                    title={t('jumpToMessage', { number: promptIndex + 1 })}
                    onClick={() => void jumpToPrompt(message, promptIndex)}
                  >
                    <span>{promptIndex + 1}</span>
                    <p>{preview}</p>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="maw-message-rail">
            <span className="maw-message-rail-track" aria-hidden="true" />
            {layout.railPoints.map((point) => {
              const message = promptMessages[point.promptIndex];
              if (!message) return null;
              return (
                <button
                  className={`maw-message-jump user ${point.active ? 'active' : ''}`}
                  type="button"
                  key={promptEntryKeys[point.promptIndex]}
                  style={{ top: `${point.topPercent}%` }}
                  title={t('jumpToMessage', { number: point.promptIndex + 1 })}
                  onClick={() => void jumpToPrompt(message, point.promptIndex)}
                />
              );
            })}
          </div>
        </nav>
      ) : null}
      {pins.length && layout.pinPoints.length ? (
        <nav className="maw-pin-navigator" aria-label={t('conversationPins')}>
          <div className="maw-pin-stepper">
            <button type="button" aria-label={t('previousPin')} onClick={() => stepPin(-1)}>
              ↑
            </button>
            <span>{pins.length}</span>
            <button type="button" aria-label={t('nextPin')} onClick={() => stepPin(1)}>
              ↓
            </button>
          </div>
          <div className="maw-pin-card">
            <div className="maw-pin-card-heading">
              <strong>{t('conversationPins')}</strong>
              <span>{pins.length}</span>
            </div>
            <div className="maw-pin-list">
              {pins.map((pin, pinIndex) => {
                const point = layout.pinPoints.find((entry) => entry.pinIndex === pinIndex);
                return (
                  <div className={point?.active ? 'active' : ''} key={pin.id}>
                    <button
                      className="maw-pin-list-jump"
                      type="button"
                      aria-current={point?.active ? 'location' : undefined}
                      aria-label={t('jumpToPin', { number: pinIndex + 1 })}
                      title={pin.preview || t('pinnedLocation')}
                      onClick={() => jumpToPin(pinIndex)}
                    >
                      <span>{pinIndex + 1}</span>
                      <p>{pin.preview || t('pinnedLocation')}</p>
                    </button>
                    <button
                      className="maw-pin-remove"
                      type="button"
                      aria-label={t('removePin', { number: pinIndex + 1 })}
                      onClick={() => void removePin(pin.id)}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="maw-pin-rail">
            <span className="maw-pin-rail-track" aria-hidden="true" />
            {layout.pinPoints.map((point) => {
              const pin = pins[point.pinIndex];
              if (!pin) return null;
              return (
                <button
                  className={`maw-pin-jump ${point.active ? 'active' : ''}`}
                  type="button"
                  key={pin.id}
                  style={{ top: `${point.topPercent}%` }}
                  aria-label={t('jumpToPin', { number: point.pinIndex + 1 })}
                  title={pin.preview || t('pinnedLocation')}
                  onClick={() => jumpToPin(point.pinIndex)}
                />
              );
            })}
          </div>
        </nav>
      ) : null}
    </>
  );
}
