import type { PlatformId } from '../shared/types/platform';

export type NativePlatformFeature =
  | 'conversation-history'
  | 'conversation-search'
  | 'projects'
  | 'account-data-export'
  | 'response-export'
  | 'conversation-branch';

/**
 * Only capabilities confirmed in first-party product documentation belong here.
 * An absent capability means "not confirmed", not "the platform can never support it".
 */
export const NATIVE_PLATFORM_FEATURES: Readonly<
  Record<Exclude<PlatformId, 'custom'>, ReadonlySet<NativePlatformFeature>>
> = {
  chatgpt: new Set([
    'conversation-history',
    'conversation-search',
    'projects',
    'account-data-export',
    'conversation-branch',
  ]),
  claude: new Set([
    'conversation-history',
    'conversation-search',
    'projects',
    'account-data-export',
  ]),
  gemini: new Set([
    'conversation-history',
    'conversation-search',
    'account-data-export',
    'response-export',
    'conversation-branch',
  ]),
  deepseek: new Set(['conversation-history']),
  grok: new Set(['conversation-history']),
  kimi: new Set(['conversation-history']),
};

export function hasConfirmedNativeFeature(
  platformId: PlatformId,
  feature: NativePlatformFeature,
): boolean {
  if (platformId === 'custom') return false;
  return NATIVE_PLATFORM_FEATURES[platformId].has(feature);
}

export function shouldShowExtensionBranch(platformId: PlatformId): boolean {
  return !hasConfirmedNativeFeature(platformId, 'conversation-branch');
}

const EXTENSION_TIMELINE_PLATFORMS: ReadonlySet<PlatformId> = new Set([
  'claude',
  'gemini',
  'kimi',
  'custom',
]);

export function shouldShowExtensionTimeline(platformId: PlatformId): boolean {
  return EXTENSION_TIMELINE_PLATFORMS.has(platformId);
}
