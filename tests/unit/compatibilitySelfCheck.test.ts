import { describe, expect, it } from 'vitest';

import {
  browserFamily,
  createCompatibilityDebugReport,
  createCompatibilityFeatureChecks,
} from '../../src/content/compatibilitySelfCheck';
import { DEFAULT_SETTINGS } from '../../src/shared/storage/defaultSettings';
import type { CompatibilityMonitorSnapshot } from '../../src/shared/types/diagnostics';
import type { PlatformCapability } from '../../src/shared/types/platform';

function snapshot(
  phase: CompatibilityMonitorSnapshot['phase'] = 'healthy',
): CompatibilityMonitorSnapshot {
  return {
    phase,
    recoveryAttempts: 2,
    lastRecoveryAt: 1_723_456_789_000,
    lastChangeAt: 1_723_456_788_000,
    evidence: {
      composer: true,
      userMessages: true,
      assistantMessages: true,
      readableMessages: true,
      bindingConfigured: true,
      checkedAt: 1_723_456_790_000,
    },
  };
}

describe('compatibility self-check', () => {
  it('reports each requested enhancement from live capabilities and settings', () => {
    const capabilities = new Set<PlatformCapability>([
      'composer.write',
      'messages.read',
      'conversation.fork.manual',
    ]);

    expect(
      createCompatibilityFeatureChecks('kimi', capabilities, DEFAULT_SETTINGS, snapshot()),
    ).toEqual([
      { feature: 'pin', status: 'available', reason: 'ready' },
      { feature: 'timeline', status: 'available', reason: 'ready' },
      { feature: 'branch', status: 'available', reason: 'ready' },
      { feature: 'quote', status: 'available', reason: 'ready' },
      { feature: 'export', status: 'available', reason: 'ready' },
    ]);
  });

  it('distinguishes omitted, disabled, missing, and recovering states', () => {
    const disabledSettings = structuredClone(DEFAULT_SETTINGS);
    disabledSettings.features.timeline = false;
    disabledSettings.features.export = false;
    const checks = createCompatibilityFeatureChecks(
      'chatgpt',
      new Set(),
      disabledSettings,
      snapshot('degraded'),
    );

    expect(checks).toContainEqual({
      feature: 'timeline',
      status: 'unavailable',
      reason: 'extension-timeline-unavailable',
    });
    expect(checks).toContainEqual({
      feature: 'pin',
      status: 'disabled',
      reason: 'feature-disabled',
    });
    expect(checks).toContainEqual({
      feature: 'quote',
      status: 'unavailable',
      reason: 'composer-not-detected',
    });
    expect(checks).toContainEqual({
      feature: 'export',
      status: 'disabled',
      reason: 'feature-disabled',
    });

    expect(
      createCompatibilityFeatureChecks(
        'gemini',
        new Set(),
        DEFAULT_SETTINGS,
        snapshot('recovering'),
      ),
    ).toContainEqual({
      feature: 'branch',
      status: 'native',
      reason: 'native-platform-feature',
    });
  });

  it('exports capability evidence and error codes without private page data', () => {
    const unsafeMessage =
      'User alice@example.com asked SECRET CHAT at https://gemini.google.com/app/private using #composer';
    const features = createCompatibilityFeatureChecks(
      'gemini',
      new Set<PlatformCapability>(['composer.write']),
      DEFAULT_SETTINGS,
      snapshot('partial'),
    );
    const report = createCompatibilityDebugReport({
      extensionVersion: '1.2.3',
      userAgent: 'Mozilla/5.0 Account/Private AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36',
      platformId: 'gemini',
      snapshot: snapshot('partial'),
      features,
      errors: [
        { code: 'adapter.recovery.failed', message: unsafeMessage, timestamp: 123 },
        { code: 'alice@example.com/private', message: unsafeMessage, timestamp: 124 },
      ],
      now: Date.UTC(2026, 6, 19, 8, 0, 0),
    });
    const serialized = JSON.stringify(report);

    expect(report.browser).toBe('Chrome 140');
    expect(report.recentErrorCodes).toEqual([
      { code: 'adapter.recovery.failed', timestamp: 123 },
      { code: 'unknown-error', timestamp: 124 },
    ]);
    expect(report.evidence).not.toHaveProperty('checkedAt');
    expect(serialized).not.toContain('SECRET CHAT');
    expect(serialized).not.toContain('alice@example.com');
    expect(serialized).not.toContain('gemini.google.com');
    expect(serialized).not.toContain('#composer');
    expect(serialized).not.toContain('Account/Private');
  });

  it('reduces user agent strings to a browser family and major version', () => {
    expect(browserFamily('Mozilla/5.0 Chrome/141.0.0.0 Edg/141.0.0.0')).toBe('Edge 141');
    expect(browserFamily('Mozilla/5.0 Firefox/142.0')).toBe('Firefox 142');
    expect(browserFamily('unrecognized')).toBe('Other');
  });
});
