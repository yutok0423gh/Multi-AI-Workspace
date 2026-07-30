import { describe, expect, it } from 'vitest';

import {
  hasConfirmedNativeFeature,
  shouldShowExtensionBranch,
  shouldShowExtensionTimeline,
} from '../../src/platforms/nativeFeatures';

describe('native platform feature policy', () => {
  it('does not infer undocumented native features', () => {
    expect(hasConfirmedNativeFeature('deepseek', 'projects')).toBe(false);
    expect(hasConfirmedNativeFeature('kimi', 'account-data-export')).toBe(false);
    expect(hasConfirmedNativeFeature('custom', 'conversation-history')).toBe(false);
  });

  it('records only officially confirmed native conversation branching', () => {
    expect(hasConfirmedNativeFeature('chatgpt', 'conversation-branch')).toBe(true);
    expect(hasConfirmedNativeFeature('gemini', 'conversation-branch')).toBe(true);
    expect(hasConfirmedNativeFeature('claude', 'conversation-branch')).toBe(false);
    expect(hasConfirmedNativeFeature('deepseek', 'conversation-branch')).toBe(false);
    expect(hasConfirmedNativeFeature('grok', 'conversation-branch')).toBe(false);
    expect(hasConfirmedNativeFeature('kimi', 'conversation-branch')).toBe(false);
  });

  it('omits extension-owned branching where the platform already provides it', () => {
    expect(shouldShowExtensionBranch('chatgpt')).toBe(false);
    expect(shouldShowExtensionBranch('gemini')).toBe(false);
    expect(shouldShowExtensionBranch('claude')).toBe(true);
    expect(shouldShowExtensionBranch('deepseek')).toBe(true);
    expect(shouldShowExtensionBranch('grok')).toBe(true);
    expect(shouldShowExtensionBranch('kimi')).toBe(true);
    expect(shouldShowExtensionBranch('custom')).toBe(true);
  });

  it('enables the extension timeline for Claude, Gemini, Kimi, and local fixtures', () => {
    expect(shouldShowExtensionTimeline('chatgpt')).toBe(false);
    expect(shouldShowExtensionTimeline('deepseek')).toBe(false);
    expect(shouldShowExtensionTimeline('claude')).toBe(true);
    expect(shouldShowExtensionTimeline('gemini')).toBe(true);
    expect(shouldShowExtensionTimeline('grok')).toBe(false);
    expect(shouldShowExtensionTimeline('kimi')).toBe(true);
    expect(shouldShowExtensionTimeline('custom')).toBe(true);
  });
});
