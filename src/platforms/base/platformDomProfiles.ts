import type { PlatformId } from '../../shared/types/platform';

export interface PlatformDomProfile {
  composerBrandHint: RegExp | null;
  verifiedComposerSelectors: readonly string[];
  verifiedMessageSelectors: {
    user: readonly string[];
    assistant: readonly string[];
  };
}

const EMPTY_COMPOSER_SELECTORS: readonly string[] = [];

const EMPTY_MESSAGE_SELECTORS = {
  user: [],
  assistant: [],
} as const;

const PLATFORM_DOM_PROFILES: Readonly<Record<PlatformId, PlatformDomProfile>> = {
  chatgpt: {
    composerBrandHint: /\bchatgpt\b/i,
    verifiedComposerSelectors: EMPTY_COMPOSER_SELECTORS,
    verifiedMessageSelectors: {
      user: ['[data-message-author-role="user"]'],
      assistant: ['[data-message-author-role="assistant"]'],
    },
  },
  claude: {
    composerBrandHint: /\bclaude\b/i,
    verifiedComposerSelectors: EMPTY_COMPOSER_SELECTORS,
    verifiedMessageSelectors: EMPTY_MESSAGE_SELECTORS,
  },
  gemini: {
    composerBrandHint: /\bgemini\b/i,
    verifiedComposerSelectors: EMPTY_COMPOSER_SELECTORS,
    verifiedMessageSelectors: {
      user: ['user-query'],
      assistant: ['model-response'],
    },
  },
  deepseek: {
    composerBrandHint: /\bdeepseek\b/i,
    verifiedComposerSelectors: [
      'textarea[name="user query"]',
      'textarea[placeholder*="DeepSeek" i]',
      'textarea[aria-label*="DeepSeek" i]',
      'textarea',
    ],
    verifiedMessageSelectors: {
      user: [
        '[data-virtual-list-item-key]:not([data-virtual-list-item-key="-999"]):has(+ [data-virtual-list-item-key] .ds-assistant-message-main-content)',
        '[data-virtual-list-item-key]:not([data-virtual-list-item-key="-999"]):not(:has(.ds-assistant-message-main-content)):has(~ [data-virtual-list-item-key] .ds-assistant-message-main-content)',
      ],
      assistant: [
        '[data-virtual-list-item-key]:has(.ds-assistant-message-main-content)',
        '.ds-assistant-message-main-content',
      ],
    },
  },
  grok: {
    composerBrandHint: /\bgrok\b/i,
    verifiedComposerSelectors: EMPTY_COMPOSER_SELECTORS,
    verifiedMessageSelectors: EMPTY_MESSAGE_SELECTORS,
  },
  kimi: {
    composerBrandHint: /\bkimi\b/i,
    verifiedComposerSelectors: EMPTY_COMPOSER_SELECTORS,
    verifiedMessageSelectors: EMPTY_MESSAGE_SELECTORS,
  },
  custom: {
    composerBrandHint: null,
    verifiedComposerSelectors: EMPTY_COMPOSER_SELECTORS,
    verifiedMessageSelectors: EMPTY_MESSAGE_SELECTORS,
  },
};

export function getPlatformDomProfile(platformId: PlatformId): PlatformDomProfile {
  return PLATFORM_DOM_PROFILES[platformId];
}
