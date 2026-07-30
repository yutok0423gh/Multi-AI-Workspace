import {
  shouldShowExtensionBranch,
  shouldShowExtensionTimeline,
} from '../platforms/nativeFeatures';
import type {
  CompatibilityDebugReport,
  CompatibilityFeatureCheck,
  CompatibilityFeatureStatus,
  CompatibilityMonitorSnapshot,
  CompatibilityReasonCode,
  DiagnosticError,
} from '../shared/types/diagnostics';
import type { PlatformCapability, PlatformId } from '../shared/types/platform';
import type { AppSettings } from '../shared/types/settings';

function missingStatus(
  snapshot: CompatibilityMonitorSnapshot,
  reason: CompatibilityReasonCode,
): Pick<CompatibilityFeatureCheck, 'status' | 'reason'> {
  return snapshot.phase === 'recovering'
    ? { status: 'recovering', reason: 'automatic-recovery-running' }
    : { status: 'unavailable', reason };
}

function check(
  feature: CompatibilityFeatureCheck['feature'],
  status: CompatibilityFeatureStatus,
  reason: CompatibilityReasonCode,
): CompatibilityFeatureCheck {
  return { feature, status, reason };
}

function unavailableCheck(
  feature: CompatibilityFeatureCheck['feature'],
  snapshot: CompatibilityMonitorSnapshot,
  reason: CompatibilityReasonCode,
): CompatibilityFeatureCheck {
  const missing = missingStatus(snapshot, reason);
  return check(feature, missing.status, missing.reason);
}

export function createCompatibilityFeatureChecks(
  platformId: PlatformId,
  capabilities: ReadonlySet<PlatformCapability>,
  settings: AppSettings,
  snapshot: CompatibilityMonitorSnapshot,
): CompatibilityFeatureCheck[] {
  const pin = settings.features.timeline
    ? check('pin', 'available', 'ready')
    : check('pin', 'disabled', 'feature-disabled');

  const timeline = !shouldShowExtensionTimeline(platformId)
    ? check('timeline', 'unavailable', 'extension-timeline-unavailable')
    : !settings.features.timeline
      ? check('timeline', 'disabled', 'feature-disabled')
      : capabilities.has('messages.read')
        ? check('timeline', 'available', 'ready')
        : unavailableCheck('timeline', snapshot, 'messages-not-detected');

  const branch = !shouldShowExtensionBranch(platformId)
    ? check('branch', 'native', 'native-platform-feature')
    : capabilities.has('conversation.fork.manual')
      ? check('branch', 'available', 'ready')
      : unavailableCheck('branch', snapshot, 'messages-not-detected');

  const quote = capabilities.has('composer.write')
    ? check('quote', 'available', 'ready')
    : unavailableCheck('quote', snapshot, 'composer-not-detected');

  const exportCheck = !settings.features.export
    ? check('export', 'disabled', 'feature-disabled')
    : capabilities.has('messages.read')
      ? check('export', 'available', 'ready')
      : unavailableCheck('export', snapshot, 'messages-not-detected');

  return [pin, timeline, branch, quote, exportCheck];
}

export function browserFamily(userAgent: string): string {
  const browsers: Array<[RegExp, string]> = [
    [/Edg\/(\d+)/, 'Edge'],
    [/Firefox\/(\d+)/, 'Firefox'],
    [/Chrome\/(\d+)/, 'Chrome'],
  ];
  for (const [pattern, name] of browsers) {
    const match = pattern.exec(userAgent);
    if (match) return `${name} ${match[1]}`;
  }
  return 'Other';
}

function safeErrorCode(code: string): string {
  return /^[a-z0-9_.-]{1,80}$/i.test(code) ? code : 'unknown-error';
}

export function createCompatibilityDebugReport({
  extensionVersion,
  userAgent,
  platformId,
  snapshot,
  features,
  errors,
  now = Date.now(),
}: {
  extensionVersion: string;
  userAgent: string;
  platformId: PlatformId;
  snapshot: CompatibilityMonitorSnapshot;
  features: CompatibilityFeatureCheck[];
  errors: DiagnosticError[];
  now?: number;
}): CompatibilityDebugReport {
  const { evidence, ...monitor } = snapshot;
  const { checkedAt: _checkedAt, ...safeEvidence } = evidence;
  void _checkedAt;
  return {
    schemaVersion: 1,
    extensionVersion,
    generatedAt: new Date(now).toISOString(),
    browser: browserFamily(userAgent),
    platform: platformId,
    monitor,
    evidence: safeEvidence,
    features: features.map((feature) => ({ ...feature })),
    recentErrorCodes: errors.slice(-20).map(({ code, timestamp }) => ({
      code: safeErrorCode(code),
      timestamp,
    })),
  };
}
