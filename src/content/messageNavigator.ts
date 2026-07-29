import type { PlatformId, PlatformMessage } from '../shared/types/platform';
import {
  allowProgrammaticMessageScroll,
  findScrollableAncestor,
} from '../shared/utils/messageScroll';

const MIN_RAIL_PERCENT = 1;
const MAX_RAIL_PERCENT = 99;
const MAX_RAIL_GAP_PERCENT = 6;

export function messageNavigatorScrollBehavior(
  platformId: PlatformId,
): 'smooth' | 'instant' {
  // Avoid overlapping the extension's smooth animation with Kimi's host-page scroll handling.
  return platformId === 'kimi' ? 'instant' : 'smooth';
}

export interface MessageRailMeasurement {
  topPercent: number;
  viewportCenter: number;
}

export function messageWindowSignature(message: PlatformMessage): string {
  if (message.messageId) return `${message.role}:id:${message.messageId}`;
  return `${message.role}:text:${message.plainText.replace(/\s+/g, ' ').trim()}`;
}

export function mergeObservedMessageWindows(
  previous: PlatformMessage[],
  current: PlatformMessage[],
): PlatformMessage[] {
  if (!previous.length) return current;
  if (!current.length) return previous;

  const previousSignatures = previous.map(messageWindowSignature);
  const currentSignatures = current.map(messageWindowSignature);
  const rows = previous.length + 1;
  const columns = current.length + 1;
  const lengths = Array.from({ length: rows }, () => new Uint16Array(columns));

  for (let previousIndex = previous.length - 1; previousIndex >= 0; previousIndex -= 1) {
    for (let currentIndex = current.length - 1; currentIndex >= 0; currentIndex -= 1) {
      lengths[previousIndex][currentIndex] =
        previousSignatures[previousIndex] === currentSignatures[currentIndex]
          ? lengths[previousIndex + 1][currentIndex + 1] + 1
          : Math.max(
              lengths[previousIndex + 1][currentIndex],
              lengths[previousIndex][currentIndex + 1],
            );
    }
  }

  const merged: PlatformMessage[] = [];
  let previousIndex = 0;
  let currentIndex = 0;
  while (previousIndex < previous.length && currentIndex < current.length) {
    if (previousSignatures[previousIndex] === currentSignatures[currentIndex]) {
      // Prefer the current instance because its element is more likely to still be mounted.
      merged.push(current[currentIndex]);
      previousIndex += 1;
      currentIndex += 1;
    } else if (
      lengths[previousIndex + 1][currentIndex] >=
      lengths[previousIndex][currentIndex + 1]
    ) {
      merged.push(previous[previousIndex]);
      previousIndex += 1;
    } else {
      merged.push(current[currentIndex]);
      currentIndex += 1;
    }
  }
  merged.push(...previous.slice(previousIndex), ...current.slice(currentIndex));
  return merged;
}

function clampRailPercent(value: number): number {
  return Math.min(MAX_RAIL_PERCENT, Math.max(MIN_RAIL_PERCENT, value));
}

export function measureMessageRailPosition(
  element: HTMLElement,
  documentHeight: number,
): MessageRailMeasurement {
  const rect = element.getBoundingClientRect();
  const scrollContainer = findScrollableAncestor(element);
  if (scrollContainer) {
    const containerRect = scrollContainer.getBoundingClientRect();
    const contentTop = rect.top - containerRect.top + scrollContainer.scrollTop;
    const contentHeight = Math.max(scrollContainer.scrollHeight, 1);
    return {
      topPercent: clampRailPercent((contentTop / contentHeight) * 100),
      viewportCenter:
        containerRect.top + Math.max(containerRect.height, scrollContainer.clientHeight) / 2,
    };
  }
  return {
    topPercent: clampRailPercent(
      ((rect.top + (element.ownerDocument.defaultView?.scrollY ?? 0)) /
        Math.max(documentHeight, 1)) *
        100,
    ),
    viewportCenter: (element.ownerDocument.defaultView?.innerHeight ?? 0) / 2,
  };
}

export function spreadRailPercentages(values: number[]): number[] {
  if (values.length <= 1) return values.map(clampRailPercent);
  const gap = Math.min(
    MAX_RAIL_GAP_PERCENT,
    (MAX_RAIL_PERCENT - MIN_RAIL_PERCENT) / (values.length - 1),
  );
  const result: number[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const minimum = MIN_RAIL_PERCENT + index * gap;
    const maximum = MAX_RAIL_PERCENT - (values.length - index - 1) * gap;
    const natural = Math.min(maximum, Math.max(minimum, clampRailPercent(values[index])));
    result.push(index ? Math.max(natural, result[index - 1] + gap) : natural);
  }
  return result;
}

export function scrollToMessageRailPosition(
  referenceElement: HTMLElement,
  topPercent: number,
  behavior: 'smooth' | 'instant',
): boolean {
  if (!referenceElement.isConnected) return false;
  const normalized = clampRailPercent(topPercent) / 100;
  const scrollContainer = findScrollableAncestor(referenceElement);
  allowProgrammaticMessageScroll(
    referenceElement.ownerDocument,
    behavior === 'smooth' ? 1_000 : 100,
  );
  if (scrollContainer) {
    const maximum = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
    const top = maximum * normalized;
    if (behavior === 'smooth' && typeof scrollContainer.scrollTo === 'function') {
      try {
        scrollContainer.scrollTo({ top, behavior: 'smooth' });
        return true;
      } catch {
        // Older embedded browser engines may reject object-form scroll options.
      }
    }
    scrollContainer.scrollTop = top;
    return true;
  }

  const documentRef = referenceElement.ownerDocument;
  const view = documentRef.defaultView;
  if (!view) return false;
  const maximum = Math.max(
    0,
    documentRef.documentElement.scrollHeight - view.innerHeight,
    (documentRef.body?.scrollHeight ?? 0) - view.innerHeight,
  );
  view.scrollTo({
    top: maximum * normalized,
    behavior: behavior === 'instant' ? 'auto' : 'smooth',
  });
  return true;
}
