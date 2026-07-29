import type { PlatformId } from '../../shared/types/platform';
import { createElementSelector } from './elementSelector';
import { getPlatformDomProfile, type PlatformDomProfile } from './platformDomProfiles';

export const AUTOMATIC_BINDING_VERSION = 6;

export interface AutomaticMessageDiscovery {
  userMessageSelector: string | null;
  assistantMessageSelector: string | null;
  confidence: number;
}

export interface AutomaticBindingDiscovery extends AutomaticMessageDiscovery {
  composerSelector: string;
  sendButtonSelector: string | null;
  confidence: number;
}

const COMPOSER_HINT =
  /\b(prompt|message|reply|ask|chat|composer|question)\b|输入|輸入|提问|提問|询问|詢問|消息|訊息|回复|回覆/i;
const SEARCH_HINT = /\b(search|find|filter)\b|搜索|搜尋|查找|筛选|篩選/i;
const SEND_HINT = /\b(send|submit|run|ask)\b|发送|發送|送出|提交|提问|提問/i;
const USER_MESSAGE_HINT =
  /\b(user|human|prompt|query|question|request)\b|用户|用戶|使用者|提问|提問|问题|問題|我的消息|我的訊息/i;
const STRONG_USER_MESSAGE_HINT = /\b(user|human)\b|用户|用戶|使用者|我的消息|我的訊息/i;
const ASSISTANT_MESSAGE_HINT =
  /\b(assistant|model|response|answer|reply|bot|ai-message)\b|助手|模型|回答|回复|回覆|回应|回應/i;
const STRONG_ASSISTANT_MESSAGE_HINT =
  /\b(assistant|model|bot|ai-message)\b|助手|模型|AI 回答|AI 回覆/i;
const MESSAGE_SHAPE_HINT =
  /\b(message|prompt|query|question|request|response|answer|reply|turn|bubble|content|text)\b|消息|訊息|提问|提問|问题|問題|回答|回复|回覆|内容|內容/i;
const MESSAGE_EXCLUSION_HINT =
  /\b(sidebar|navigation|nav|history|search|filter|composer|input|toolbar|menu|button|avatar|profile|account|suggestion)\b|侧栏|側欄|导航|導覽|历史|歷史|搜索|搜尋|输入|輸入|菜单|選單|头像|頭像/i;
const MESSAGE_ATTRIBUTES = [
  'data-message-author-role',
  'data-message-role',
  'data-author',
  'data-role',
  'data-speaker',
  'data-testid',
] as const;

type MessageRole = 'user' | 'assistant';

function descriptor(element: HTMLElement): string {
  return [
    element.id,
    element.getAttribute('aria-label'),
    element.getAttribute('aria-placeholder'),
    element.getAttribute('placeholder'),
    element.getAttribute('data-placeholder'),
    element.getAttribute('data-testid'),
    element.getAttribute('data-role'),
    element.getAttribute('name'),
    element.getAttribute('title'),
    element.textContent?.trim().slice(0, 80),
  ]
    .filter(Boolean)
    .join(' ');
}

function semanticDescriptor(element: HTMLElement): string {
  return [
    element.localName,
    element.id,
    [...element.classList].join(' '),
    ...MESSAGE_ATTRIBUTES.map((attribute) => element.getAttribute(attribute)),
    element.getAttribute('aria-label'),
    element.getAttribute('aria-roledescription'),
    element.getAttribute('role'),
  ]
    .filter(Boolean)
    .join(' ');
}

function isHidden(element: HTMLElement): boolean {
  if (element.closest('[hidden], [aria-hidden="true"]')) return true;
  const view = element.ownerDocument.defaultView;
  if (!view) return false;
  const style = view.getComputedStyle(element);
  return style.display === 'none' || style.visibility === 'hidden';
}

function isEditable(element: HTMLElement): boolean {
  if (element instanceof HTMLTextAreaElement) return !element.disabled && !element.readOnly;
  if (element instanceof HTMLInputElement) {
    return (
      !element.disabled && !element.readOnly && ['text', 'url', 'email', ''].includes(element.type)
    );
  }
  const contentEditable = element.getAttribute('contenteditable');
  return (
    (contentEditable !== null && contentEditable.toLowerCase() !== 'false') ||
    element.getAttribute('role') === 'textbox'
  );
}

function scoreComposer(
  element: HTMLElement,
  viewportHeight: number,
  brandHint: RegExp | null,
): number {
  if (!isEditable(element) || isHidden(element)) return Number.NEGATIVE_INFINITY;
  const description = descriptor(element);
  if (SEARCH_HINT.test(description)) return Number.NEGATIVE_INFINITY;

  let score = 0;
  if (element instanceof HTMLTextAreaElement) score += 25;
  if (
    element.hasAttribute('contenteditable') &&
    element.getAttribute('contenteditable')?.toLowerCase() !== 'false'
  ) {
    score += 30;
  }
  if (element.getAttribute('role') === 'textbox') score += 20;
  if (COMPOSER_HINT.test(description)) score += 55;
  if (brandHint?.test(description)) score += 18;
  if (/prompt|composer|chat-input|message-input/i.test(element.id)) score += 35;
  if (element.closest('form')) score += 8;

  const rect = element.getBoundingClientRect();
  if (rect.width >= 180 && rect.height >= 24) score += 12;
  if (viewportHeight > 0 && rect.top > viewportHeight * 0.45) score += 8;
  return score;
}

function findComposer(
  documentRef: Document,
  profile: PlatformDomProfile,
): { element: HTMLElement; score: number; selector?: string } | null {
  const viewportHeight = documentRef.defaultView?.innerHeight ?? 0;
  for (const selector of profile.verifiedComposerSelectors) {
    let matches: HTMLElement[];
    try {
      matches = [...documentRef.querySelectorAll<HTMLElement>(selector)].filter((element) =>
        Number.isFinite(scoreComposer(element, viewportHeight, profile.composerBrandHint)),
      );
    } catch {
      continue;
    }
    if (matches.length === 1) {
      return {
        element: matches[0],
        score: Math.max(240, scoreComposer(matches[0], viewportHeight, profile.composerBrandHint)),
        selector,
      };
    }
  }
  const candidates = [
    ...documentRef.querySelectorAll<HTMLElement>(
      'textarea, input[type="text"], input:not([type]), [contenteditable]:not([contenteditable="false"]), [role="textbox"]',
    ),
  ]
    .map((element) => ({
      element,
      score: scoreComposer(element, viewportHeight, profile.composerBrandHint),
    }))
    .filter((candidate) => Number.isFinite(candidate.score))
    .sort((a, b) => b.score - a.score);

  const first = candidates[0];
  if (!first || first.score < 55) return null;
  const second = candidates[1];
  if (second && first.score - second.score < 8) return null;
  return first;
}

function ancestorSearchRoot(composer: HTMLElement): HTMLElement {
  let current = composer.parentElement;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (current.matches('form')) return current;
    if (current.querySelector('button, input[type="submit"], [role="button"]')) return current;
    current = current.parentElement;
  }
  return composer.parentElement ?? composer.ownerDocument.body;
}

function findSendButton(composer: HTMLElement): HTMLElement | null {
  const root = ancestorSearchRoot(composer);
  const composerRect = composer.getBoundingClientRect();
  const ranked = [
    ...root.querySelectorAll<HTMLElement>('button, input[type="submit"], [role="button"]'),
  ]
    .filter((element) => !isHidden(element))
    .map((element) => {
      const description = descriptor(element);
      let score = SEND_HINT.test(description) ? 70 : 0;
      if (element instanceof HTMLButtonElement && element.type === 'submit') score += 25;
      if (element instanceof HTMLInputElement && element.type === 'submit') score += 25;
      if (element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true') {
        score -= 10;
      }
      const rect = element.getBoundingClientRect();
      const distance = Math.hypot(
        rect.left + rect.width / 2 - (composerRect.left + composerRect.width / 2),
        rect.top + rect.height / 2 - (composerRect.top + composerRect.height / 2),
      );
      if (distance < 320) score += 12;
      return { element, score };
    })
    .filter((candidate) => candidate.score >= 55)
    .sort((a, b) => b.score - a.score);

  if (ranked[1] && ranked[0].score - ranked[1].score < 8) return null;
  return ranked[0]?.element ?? null;
}

function roleHints(role: MessageRole): {
  hint: RegExp;
  strongHint: RegExp;
  oppositeHint: RegExp;
} {
  return role === 'user'
    ? {
        hint: USER_MESSAGE_HINT,
        strongHint: STRONG_USER_MESSAGE_HINT,
        oppositeHint: ASSISTANT_MESSAGE_HINT,
      }
    : {
        hint: ASSISTANT_MESSAGE_HINT,
        strongHint: STRONG_ASSISTANT_MESSAGE_HINT,
        oppositeHint: USER_MESSAGE_HINT,
      };
}

function isMessageRegion(element: HTMLElement, composer: HTMLElement | null): boolean {
  if (element === element.ownerDocument.body || element === element.ownerDocument.documentElement) {
    return false;
  }
  if (isHidden(element)) return false;
  if (
    element.closest(
      'nav, aside, header, footer, form, dialog, [role="navigation"], [role="dialog"], [role="menu"]',
    )
  ) {
    return false;
  }
  if (element.matches('a, button, input, textarea, select, option')) return false;
  if (element.closest('[contenteditable]:not([contenteditable="false"]), [role="textbox"]')) {
    return false;
  }
  if (composer && (element.contains(composer) || composer.contains(element))) return false;
  const text = (element.innerText || element.textContent || '').trim();
  return text.length > 0 && text.length <= 40_000;
}

function scoreMessageElement(
  element: HTMLElement,
  role: MessageRole,
  composer: HTMLElement | null,
): number {
  if (!isMessageRegion(element, composer)) return Number.NEGATIVE_INFINITY;
  const description = semanticDescriptor(element);
  const { hint, strongHint, oppositeHint } = roleHints(role);
  if (!hint.test(description) || MESSAGE_EXCLUSION_HINT.test(description)) {
    return Number.NEGATIVE_INFINITY;
  }
  if (oppositeHint.test(description) && !strongHint.test(description)) {
    return Number.NEGATIVE_INFINITY;
  }
  const authoritativeRole = [
    'data-message-author-role',
    'data-message-role',
    'data-author',
    'data-role',
    'data-speaker',
  ].some((attribute) => {
    const value = element.getAttribute(attribute);
    return value ? strongHint.test(value) : false;
  });
  if (strongHint.test(description) && !MESSAGE_SHAPE_HINT.test(description) && !authoritativeRole) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 75;
  if (strongHint.test(description)) score += 30;
  if (hint.test(element.localName)) score += 18;
  if (element.localName.includes('-')) score += 8;
  if ([...element.classList].some((name) => strongHint.test(name))) score += 18;
  for (const attribute of MESSAGE_ATTRIBUTES) {
    const value = element.getAttribute(attribute);
    if (!value || !hint.test(value)) continue;
    score += attribute === 'data-message-author-role' ? 55 : 24;
  }
  if (element.closest('main, [role="main"]')) score += 8;
  if (element.children.length <= 4) score += 4;
  return score;
}

function escapeCss(value: string): string {
  return CSS.escape(value);
}

function collectionSelectors(element: HTMLElement, role: MessageRole): string[] {
  const { hint } = roleHints(role);
  const selectors: string[] = [];
  for (const attribute of MESSAGE_ATTRIBUTES) {
    const value = element.getAttribute(attribute);
    if (!value || value.length > 100 || !hint.test(value)) continue;
    selectors.push(`${element.localName}[${attribute}="${escapeCss(value)}"]`);
    selectors.push(`[${attribute}="${escapeCss(value)}"]`);
  }
  if (hint.test(element.localName) && element.localName.includes('-')) {
    selectors.push(element.localName);
  }
  for (const className of element.classList) {
    if (className.length < 2 || className.length > 80 || !hint.test(className)) continue;
    selectors.push(`${element.localName}.${escapeCss(className)}`);
    selectors.push(`.${escapeCss(className)}`);
  }
  return [...new Set(selectors)];
}

function findMessageSelector(
  documentRef: Document,
  role: MessageRole,
  composer: HTMLElement | null,
): { selector: string; score: number } | null {
  const selectorScores = new Map<string, number>();
  for (const element of documentRef.querySelectorAll<HTMLElement>('*')) {
    const elementScore = scoreMessageElement(element, role, composer);
    if (!Number.isFinite(elementScore) || elementScore < 95) continue;
    for (const selector of collectionSelectors(element, role)) {
      let matches: HTMLElement[];
      try {
        matches = [...documentRef.querySelectorAll<HTMLElement>(selector)];
      } catch {
        continue;
      }
      if (!matches.length || matches.length > 500 || !matches.includes(element)) continue;
      const validMatches = matches.filter(
        (match) => scoreMessageElement(match, role, composer) >= 95,
      );
      if (validMatches.length !== matches.length) continue;
      const score = elementScore + Math.min(validMatches.length, 10) * 5 - selector.length * 0.02;
      selectorScores.set(selector, Math.max(selectorScores.get(selector) ?? 0, score));
    }
  }

  const best = [...selectorScores.entries()].sort((left, right) => right[1] - left[1])[0];
  return best ? { selector: best[0], score: best[1] } : null;
}

function findVerifiedMessageSelector(
  documentRef: Document,
  selectors: readonly string[],
  composer: HTMLElement | null,
): { selector: string; score: number } | null {
  for (const selector of selectors) {
    let matches: HTMLElement[];
    try {
      matches = [...documentRef.querySelectorAll<HTMLElement>(selector)];
    } catch {
      continue;
    }
    if (
      matches.length > 0 &&
      matches.length <= 500 &&
      matches.every((element) => isMessageRegion(element, composer))
    ) {
      return { selector, score: 240 + Math.min(matches.length, 10) * 5 };
    }
  }
  return null;
}

export function discoverAutomaticMessages(
  documentRef: Document = document,
  composer: HTMLElement | null = null,
  platformId: PlatformId = 'custom',
): AutomaticMessageDiscovery | null {
  const profile = getPlatformDomProfile(platformId);
  const user =
    findVerifiedMessageSelector(documentRef, profile.verifiedMessageSelectors.user, composer) ??
    findMessageSelector(documentRef, 'user', composer);
  const assistant =
    findVerifiedMessageSelector(
      documentRef,
      profile.verifiedMessageSelectors.assistant,
      composer,
    ) ?? findMessageSelector(documentRef, 'assistant', composer);
  if (!user && !assistant) return null;
  return {
    userMessageSelector: user?.selector ?? null,
    assistantMessageSelector: assistant?.selector ?? null,
    confidence: Math.max(user?.score ?? 0, assistant?.score ?? 0),
  };
}

export function discoverAutomaticBinding(
  documentRef: Document = document,
  platformId: PlatformId = 'custom',
): AutomaticBindingDiscovery | null {
  const profile = getPlatformDomProfile(platformId);
  const composer = findComposer(documentRef, profile);
  if (!composer) return null;

  try {
    const sendButton = findSendButton(composer.element);
    const messages = discoverAutomaticMessages(documentRef, composer.element, platformId);
    return {
      composerSelector: composer.selector ?? createElementSelector(composer.element),
      sendButtonSelector: sendButton ? createElementSelector(sendButton) : null,
      userMessageSelector: messages?.userMessageSelector ?? null,
      assistantMessageSelector: messages?.assistantMessageSelector ?? null,
      confidence: Math.max(composer.score, messages?.confidence ?? 0),
    };
  } catch {
    return null;
  }
}
