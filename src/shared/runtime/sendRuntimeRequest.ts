import browser from 'webextension-polyfill';

import { AppError } from '../errors/AppError';
import type { RuntimeRequest, RuntimeResponse } from '../types/messages';

export const EXTENSION_CONTEXT_UNAVAILABLE = 'EXTENSION_CONTEXT_UNAVAILABLE';

interface ChromeRuntimeFallback {
  lastError?: { message?: string };
  sendMessage(
    request: RuntimeRequest,
    callback: (response: RuntimeResponse | undefined) => void,
  ): void;
}

function contextUnavailable(cause?: unknown): AppError {
  return new AppError(
    EXTENSION_CONTEXT_UNAVAILABLE,
    'The extension was updated or reloaded. Reload this page once and try again.',
    cause,
  );
}

function isExtensionContextFailure(reason: unknown): boolean {
  const message = reason instanceof Error ? reason.message : String(reason ?? '');
  return /extension context invalidated|cannot read properties of undefined.*sendmessage|runtime\.sendmessage|message port closed/i.test(
    message,
  );
}

async function sendWithChromeFallback(request: RuntimeRequest): Promise<RuntimeResponse> {
  const chromeRuntime = (
    globalThis as typeof globalThis & {
      chrome?: { runtime?: ChromeRuntimeFallback };
    }
  ).chrome?.runtime;
  if (!chromeRuntime?.sendMessage) throw contextUnavailable();

  return new Promise<RuntimeResponse>((resolve, reject) => {
    try {
      chromeRuntime.sendMessage(request, (response) => {
        const runtimeError = chromeRuntime.lastError?.message;
        if (runtimeError) {
          reject(contextUnavailable(new Error(runtimeError)));
          return;
        }
        if (!response) {
          reject(new AppError('BACKGROUND_RESPONSE_INVALID', 'The background response was empty.'));
          return;
        }
        resolve(response);
      });
    } catch (reason) {
      reject(
        isExtensionContextFailure(reason)
          ? contextUnavailable(reason)
          : new AppError(
              'BACKGROUND_REQUEST_FAILED',
              'The request could not be completed.',
              reason,
            ),
      );
    }
  });
}

export function isExtensionContextUnavailable(reason: unknown): boolean {
  return reason instanceof AppError && reason.code === EXTENSION_CONTEXT_UNAVAILABLE;
}

export async function sendRuntimeRequest(
  request: RuntimeRequest,
): Promise<Extract<RuntimeResponse, { ok: true }>> {
  let response: RuntimeResponse;
  try {
    response =
      typeof browser?.runtime?.sendMessage === 'function'
        ? ((await browser.runtime.sendMessage(request)) as RuntimeResponse)
        : await sendWithChromeFallback(request);
  } catch (reason) {
    if (isExtensionContextUnavailable(reason)) throw reason;
    if (isExtensionContextFailure(reason)) throw contextUnavailable(reason);
    throw reason;
  }
  if (!response || typeof response !== 'object' || typeof response.ok !== 'boolean') {
    throw new AppError('BACKGROUND_RESPONSE_INVALID', 'The background response was invalid.');
  }
  if (!response.ok) throw new AppError(response.error.code, response.error.message);
  return response;
}
