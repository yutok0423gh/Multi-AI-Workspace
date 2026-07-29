import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  measureMessageRailPosition,
  mergeObservedMessageWindows,
  messageNavigatorScrollBehavior,
  scrollToMessageRailPosition,
  spreadRailPercentages,
} from '../../src/content/messageNavigator';
import { scrollElementToCenter } from '../../src/shared/utils/messageScroll';
import type { PlatformMessage } from '../../src/shared/types/platform';

afterEach(() => {
  document.body.innerHTML = '';
});

function message(plainText: string, order: number): PlatformMessage {
  const element = document.createElement('article');
  element.textContent = plainText;
  return {
    platform: 'claude',
    conversationId: 'conversation',
    messageId: null,
    runtimeMessageId: `user:${order}`,
    role: 'user',
    plainText,
    html: null,
    timestamp: null,
    timestampSource: 'unknown',
    element,
    order,
  };
}

describe('message navigator positioning', () => {
  it('uses an interrupt-safe instant jump on Kimi while retaining smooth jumps elsewhere', () => {
    expect(messageNavigatorScrollBehavior('kimi')).toBe('instant');
    expect(messageNavigatorScrollBehavior('claude')).toBe('smooth');
    expect(messageNavigatorScrollBehavior('gemini')).toBe('smooth');
  });

  it('merges overlapping virtualized message windows without losing middle prompts', () => {
    const firstWindow = ['A', 'B', 'C', 'F'].map(message);
    const currentWindow = ['A', 'B', 'C', 'D', 'E', 'F'].map(message);

    const merged = mergeObservedMessageWindows(firstWindow, currentWindow);

    expect(merged.map((entry) => entry.plainText)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(merged[0]).toBe(currentWindow[0]);
  });

  it('keeps earlier prompts when a virtualized window slides down the conversation', () => {
    const firstWindow = ['A', 'B', 'C'].map(message);
    const currentWindow = ['B', 'C', 'D'].map(message);

    expect(
      mergeObservedMessageWindows(firstWindow, currentWindow).map(
        (entry) => entry.plainText,
      ),
    ).toEqual(['A', 'B', 'C', 'D']);
  });

  it('measures messages inside the page scroll container instead of the window', () => {
    document.body.innerHTML = `
      <main id="scroller" style="overflow-y: auto">
        <article id="message">Prompt</article>
      </main>
    `;
    const scroller = document.querySelector<HTMLElement>('#scroller')!;
    const message = document.querySelector<HTMLElement>('#message')!;
    Object.defineProperties(scroller, {
      clientHeight: { value: 500 },
      scrollHeight: { value: 2_000 },
      scrollTop: { value: 1_000, writable: true },
      getBoundingClientRect: {
        value: () => ({ top: 100, height: 500 }),
      },
    });
    Object.defineProperty(message, 'getBoundingClientRect', {
      value: () => ({ top: 200, height: 80 }),
    });

    const measurement = measureMessageRailPosition(message, 900);
    expect(measurement.topPercent).toBeCloseTo(55);
    expect(measurement.viewportCenter).toBe(350);
  });

  it('spreads overlapping positions so every Prompt keeps a visible dot', () => {
    const positions = spreadRailPercentages([99, 99, 99, 99, 99]);

    expect(positions).toHaveLength(5);
    expect(new Set(positions).size).toBe(5);
    expect(positions).toEqual([75, 81, 87, 93, 99]);
  });

  it('centers a message by directly scrolling its internal container', () => {
    document.body.innerHTML = `
      <main id="scroller" style="overflow-y: auto">
        <article id="message">Prompt</article>
      </main>`;
    const scroller = document.querySelector<HTMLElement>('#scroller')!;
    const message = document.querySelector<HTMLElement>('#message')!;
    const scrollTo = vi.fn();
    Object.defineProperties(scroller, {
      clientHeight: { value: 500 },
      scrollHeight: { value: 2_000 },
      scrollTop: { value: 400, writable: true },
      scrollTo: { value: scrollTo },
      getBoundingClientRect: {
        value: () => ({ top: 100, height: 500 }),
      },
    });
    Object.defineProperty(message, 'getBoundingClientRect', {
      value: () => ({ top: 900, height: 80 }),
    });

    expect(scrollElementToCenter(message, 'smooth')).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({ top: 990, behavior: 'smooth' });
  });

  it('scrolls a virtualized conversation to a cached rail percentage', () => {
    document.body.innerHTML = `
      <main id="scroller" style="overflow-y: auto">
        <article id="message">Mounted prompt</article>
      </main>`;
    const scroller = document.querySelector<HTMLElement>('#scroller')!;
    const mountedMessage = document.querySelector<HTMLElement>('#message')!;
    const scrollTo = vi.fn();
    Object.defineProperties(scroller, {
      clientHeight: { value: 500 },
      scrollHeight: { value: 2_500 },
      scrollTop: { value: 0, writable: true },
      scrollTo: { value: scrollTo },
    });

    expect(scrollToMessageRailPosition(mountedMessage, 75, 'smooth')).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({ top: 1_500, behavior: 'smooth' });
  });
});
