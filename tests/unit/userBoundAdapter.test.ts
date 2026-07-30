import { afterEach, describe, expect, it, vi } from 'vitest';
import browser from 'webextension-polyfill';

import { UserBoundPlatformAdapter } from '../../src/platforms/base/UserBoundPlatformAdapter';
import type { CustomSiteBindingRecord } from '../../src/shared/types/records';

function binding(): CustomSiteBindingRecord {
  return {
    id: 'binding:custom:http://localhost:3000',
    origin: 'http://localhost:3000',
    platformId: 'custom',
    accountScopeId: 'anonymous',
    composerSelector: '#composer',
    sendButtonSelector: '#send',
    messageContainerSelector: '#messages',
    userMessageSelector: '.user-message',
    assistantMessageSelector: '.assistant-message',
    enabled: true,
    lastValidatedAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

afterEach(() => {
  document.body.replaceChildren();
  Reflect.deleteProperty(document, 'execCommand');
  vi.restoreAllMocks();
});

describe('UserBoundPlatformAdapter', () => {
  it('automatically connects a high-confidence composer during initialization', async () => {
    document.body.innerHTML = `
      <main>
        <article class="user-prompt"><p>Question</p></article>
        <article class="assistant-response"><p>Answer</p></article>
      </main>
      <form>
        <textarea id="prompt-box" placeholder="Message the AI"></textarea>
        <button id="send-button" type="submit" aria-label="Send message">Send</button>
      </form>
    `;
    const sendMessage = vi.spyOn(browser.runtime, 'sendMessage');
    const adapter = new UserBoundPlatformAdapter('custom', location.hostname);

    await adapter.initialize();

    expect(adapter.getBinding()).toMatchObject({
      composerSelector: '#prompt-box',
      sendButtonSelector: '#send-button',
      userMessageSelector: '.user-prompt',
      assistantMessageSelector: '.assistant-response',
      bindingSource: 'automatic',
    });
    expect(adapter.getCapabilities()).toContain('composer.write');
    expect(adapter.getCapabilities()).toContain('messages.read');
    expect(adapter.getCapabilities()).toContain('conversation.fork.manual');
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'binding.save' }));
    adapter.dispose();
  });

  it('replaces a stale DeepSeek binding with its verified composer and message structure', async () => {
    document.body.innerHTML = `
      <main>
        <div data-virtual-list-item-key="201">
          <div>DeepSeek question</div>
        </div>
        <div data-virtual-list-item-key="202">
          <div class="ds-assistant-message-main-content">DeepSeek answer</div>
        </div>
      </main>
      <textarea placeholder="Message DeepSeek"></textarea>
      <textarea aria-label="Feedback" style="display:none"></textarea>
    `;
    let storedBinding: CustomSiteBindingRecord | null = {
      ...binding(),
      id: 'binding:deepseek:https://chat.deepseek.com',
      origin: 'https://chat.deepseek.com',
      platformId: 'deepseek',
      composerSelector: '#removed-composer',
      sendButtonSelector: null,
      messageContainerSelector: null,
      userMessageSelector: '.removed-user-message',
      assistantMessageSelector: '.removed-assistant-message',
      bindingSource: 'automatic',
      automaticBindingVersion: 5,
    };
    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(async (message) => {
      const request = message as { type?: string; binding?: CustomSiteBindingRecord };
      if (request.type === 'binding.get') return { ok: true, binding: storedBinding };
      if (request.type === 'binding.save') {
        storedBinding = request.binding ?? null;
        return { ok: true, binding: storedBinding };
      }
      return { ok: true };
    });
    const adapter = new UserBoundPlatformAdapter('deepseek', 'chat.deepseek.com');

    await adapter.initialize();

    expect(adapter.getBinding()).toMatchObject({
      composerSelector: 'textarea[placeholder*="DeepSeek" i]',
      userMessageSelector:
        '[data-virtual-list-item-key]:not([data-virtual-list-item-key="-999"]):has(+ [data-virtual-list-item-key] .ds-assistant-message-main-content)',
      assistantMessageSelector:
        '[data-virtual-list-item-key]:has(.ds-assistant-message-main-content)',
      automaticBindingVersion: 6,
    });
    expect([...adapter.getCapabilities()]).toEqual(
      expect.arrayContaining([
        'composer.write',
        'messages.read',
        'quote-reply',
        'export',
        'conversation.fork.manual',
      ]),
    );
    expect(
      (await adapter.getMessages()).map(({ role, plainText }) => [
        role,
        plainText.replace(/\s+/g, ' ').trim(),
      ]),
    ).toEqual([
      ['user', 'DeepSeek question'],
      ['assistant', 'DeepSeek answer'],
    ]);
    adapter.dispose();
  });

  it('enables manually bound capabilities and updates a native composer', async () => {
    document.body.innerHTML = `
      <div id="messages">
        <div class="user-message">Question</div>
        <div class="assistant-message">Answer</div>
      </div>
      <textarea id="composer">hello</textarea><button id="send">Send</button>
    `;
    const adapter = new UserBoundPlatformAdapter('custom', location.hostname);
    adapter.setBinding(binding());
    const input = vi.fn();
    document.querySelector('#composer')?.addEventListener('input', input);

    expect(adapter.getCapabilities()).toContain('composer.write');
    expect(adapter.getCapabilities()).toContain('messages.read');
    expect(await adapter.readComposer()).toBe('hello');

    const textarea = document.querySelector<HTMLTextAreaElement>('#composer')!;
    textarea.setSelectionRange(5, 5);
    await adapter.writeComposer(' world', { mode: 'insert-at-cursor' });

    expect(textarea.value).toBe('hello world');
    expect(input).toHaveBeenCalledOnce();
    const messages = await adapter.getMessages();
    expect(messages.map(({ role, plainText }) => [role, plainText])).toEqual([
      ['user', 'Question'],
      ['assistant', 'Answer'],
    ]);
  });

  it('uses the browser editing command for a controlled rich-text composer', async () => {
    document.body.innerHTML = `
      <div id="messages"></div>
      <div id="composer" contenteditable="plaintext-only" role="textbox"></div>
      <button id="send">Send</button>
    `;
    const composer = document.querySelector<HTMLElement>('#composer')!;
    const execCommand = vi.fn((_command: string, _showUi: boolean, value: string) => {
      composer.textContent = value;
      return true;
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });
    const adapter = new UserBoundPlatformAdapter('grok', location.hostname);
    adapter.setBinding({ ...binding(), platformId: 'grok' });

    await adapter.writeComposer('Branch context', { mode: 'replace' });

    expect(execCommand).toHaveBeenCalledWith('insertText', false, 'Branch context');
    expect(await adapter.readComposer()).toBe('Branch context');
    adapter.dispose();
  });

  it('selects an exact visible model and never guesses a fallback', async () => {
    document.body.innerHTML = `
      <select id="model-control">
        <option value="model-fast">Fast</option>
        <option value="model-pro">Pro</option>
      </select>
    `;
    const adapter = new UserBoundPlatformAdapter('custom', location.hostname);
    adapter.setBinding({ ...binding(), modelControlSelector: '#model-control' });
    const control = document.querySelector<HTMLSelectElement>('#model-control')!;
    const change = vi.fn();
    control.addEventListener('change', change);

    await expect(adapter.selectModel('Pro')).resolves.toEqual({ model: 'Pro' });
    expect(control.value).toBe('model-pro');
    expect(change).toHaveBeenCalledOnce();

    await expect(adapter.selectModel('Unavailable')).rejects.toMatchObject({
      code: 'MODEL_NOT_FOUND',
    });
    expect(control.value).toBe('model-pro');
  });

  it('emits completion once after an explicit generation state ends', async () => {
    document.body.innerHTML = `
      <div id="messages">
        <div class="user-message">Question</div>
        <div class="assistant-message">Partial</div>
      </div>
      <button id="generating">Stop</button>
      <textarea id="composer"></textarea><button id="send">Send</button>
    `;
    const adapter = new UserBoundPlatformAdapter('custom', location.hostname);
    adapter.setBinding({ ...binding(), generationIndicatorSelector: '#generating' });
    const completed = vi.fn();
    const unsubscribe = adapter.observeAnswerCompletions(completed);
    await new Promise((resolve) => setTimeout(resolve, 0));

    document.querySelector('.assistant-message')!.textContent = 'Complete answer';
    document.querySelector('#generating')!.remove();

    await vi.waitFor(() => expect(completed).toHaveBeenCalledOnce());
    expect(completed.mock.calls[0][0].message.plainText).toBe('Complete answer');
    document.querySelector('.assistant-message')!.append('!');
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(completed).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it('does not report user-cancelled or failed generation as completed', async () => {
    document.body.innerHTML = `
      <div id="messages">
        <div class="user-message">Question</div>
        <div class="assistant-message">Partial</div>
      </div>
      <button id="generating">Stop</button>
      <textarea id="composer"></textarea><button id="send">Send</button>
    `;
    const adapter = new UserBoundPlatformAdapter('custom', location.hostname);
    adapter.setBinding({ ...binding(), generationIndicatorSelector: '#generating' });
    const completed = vi.fn();
    const unsubscribe = adapter.observeAnswerCompletions(completed);
    await new Promise((resolve) => setTimeout(resolve, 0));

    document
      .querySelector('#generating')!
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    document.querySelector('#generating')!.remove();
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(completed).not.toHaveBeenCalled();
    unsubscribe();

    document.body.innerHTML = `
      <div id="messages">
        <div class="user-message">Question</div>
        <div class="assistant-message" aria-busy="true">Partial</div>
      </div>
      <textarea id="composer"></textarea><button id="send">Send</button>
    `;
    const failedAdapter = new UserBoundPlatformAdapter('custom', location.hostname);
    failedAdapter.setBinding(binding());
    const failed = vi.fn();
    const stop = failedAdapter.observeAnswerCompletions(failed);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const answer = document.querySelector<HTMLElement>('.assistant-message')!;
    answer.setAttribute('aria-busy', 'false');
    document
      .querySelector('#messages')!
      .insertAdjacentHTML('beforeend', '<span role="alert">Network failed</span>');
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(failed).not.toHaveBeenCalled();
    stop();
  });

  it('resolves a replaced live message before timeline navigation', async () => {
    document.body.innerHTML = `
      <div id="messages">
        <div class="user-message">Question</div>
        <div class="assistant-message">Answer</div>
      </div>
      <textarea id="composer"></textarea><button id="send">Send</button>`;
    const adapter = new UserBoundPlatformAdapter('kimi', location.hostname);
    adapter.setBinding({ ...binding(), platformId: 'kimi' });
    expect(adapter.getCapabilities()).toContain('timeline');
    const [staleMessage] = await adapter.getMessages();

    document.querySelector('#messages')!.innerHTML = `
      <div class="user-message">Question</div>
      <div class="assistant-message">Answer</div>`;
    const liveElement = document.querySelector<HTMLElement>('.user-message')!;
    const scrollIntoView = vi.fn();
    Object.defineProperty(liveElement, 'scrollIntoView', { value: scrollIntoView });

    await adapter.scrollToMessage(staleMessage, 'instant');

    expect(staleMessage.element.isConnected).toBe(false);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'center' });
  });

  it('deduplicates nested role nodes while preserving repeated prompts from separate turns', async () => {
    document.body.innerHTML = `
      <div id="messages">
        <div class="user-message">
          <div class="user-message">
            <div class="user-message">Repeated question</div>
          </div>
        </div>
        <div class="assistant-message">
          <div class="assistant-message">First answer</div>
        </div>
        <div class="user-message">Repeated question</div>
      </div>
      <textarea id="composer"></textarea><button id="send">Send</button>
    `;
    const adapter = new UserBoundPlatformAdapter('custom', location.hostname);
    adapter.setBinding(binding());

    const messages = await adapter.getMessages();

    expect(messages.map(({ role, plainText }) => [role, plainText])).toEqual([
      ['user', 'Repeated question'],
      ['assistant', 'First answer'],
      ['user', 'Repeated question'],
    ]);
    adapter.dispose();
  });

  it('notifies consumers when a prompt appears after an empty conversation was initialized', async () => {
    document.body.innerHTML = `
      <main id="messages"></main>
      <textarea id="composer" placeholder="Message the AI"></textarea>
      <button id="send" aria-label="Send message">Send</button>
    `;
    const storedBinding = { ...binding(), bindingSource: 'automatic' as const };
    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(async (message) => {
      const request = message as { type?: string; binding?: unknown };
      if (request.type === 'binding.get') return { ok: true, binding: storedBinding };
      if (request.type === 'binding.save') return { ok: true, binding: request.binding };
      return { ok: true };
    });
    const adapter = new UserBoundPlatformAdapter('custom', location.hostname);
    await adapter.initialize();
    const bindingChanged = vi.fn();
    adapter.subscribeBindingChanges(bindingChanged);

    const prompt = document.createElement('article');
    prompt.className = 'user-message';
    prompt.textContent = 'A prompt added after startup';
    document.querySelector('#messages')?.append(prompt);

    await vi.waitFor(() => expect(bindingChanged).toHaveBeenCalledWith(adapter.getBinding()));
    expect(adapter.getCapabilities()).toContain('messages.read');
    adapter.dispose();
  });

  it('upgrades a legacy mixed binding to the semantic Prompt selector without user input', async () => {
    document.body.innerHTML = `
      <main id="messages">
        <div class="wrong-message">Legacy broad match</div>
        <user-query>Actual user prompt</user-query>
        <model-response>Actual assistant response</model-response>
      </main>
      <textarea id="composer" placeholder="Message the AI"></textarea>
      <button id="send" aria-label="Send message">Send</button>
    `;
    const legacyBinding = {
      ...binding(),
      userMessageSelector: '.wrong-message',
      assistantMessageSelector: null,
      bindingSource: 'mixed' as const,
      automaticBindingVersion: 1,
    };
    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(async (message) => {
      const request = message as { type?: string; binding?: unknown };
      if (request.type === 'binding.get') return { ok: true, binding: legacyBinding };
      if (request.type === 'binding.save') return { ok: true, binding: request.binding };
      return { ok: true };
    });
    const adapter = new UserBoundPlatformAdapter('custom', location.hostname);

    await adapter.initialize();

    expect(adapter.getBinding()).toMatchObject({
      userMessageSelector: 'user-query',
      assistantMessageSelector: 'model-response',
      automaticBindingVersion: 6,
    });
    adapter.dispose();
  });

  it('repairs stale manual Gemini message selectors after a conversation switch', async () => {
    document.body.innerHTML = `
      <section id="retained-old-conversation">
        <div id="old-user-turn">Retained old prompt</div>
        <div id="old-model-turn">Retained old response</div>
      </section>
      <main id="messages">
        <user-query>New Gemini prompt</user-query>
        <model-response>New Gemini response</model-response>
      </main>
      <rich-textarea>
        <div id="composer" contenteditable="plaintext-only" aria-label="Enter a prompt"></div>
      </rich-textarea>
      <button id="send" aria-label="Send message">Send</button>
    `;
    const staleBinding: CustomSiteBindingRecord = {
      ...binding(),
      platformId: 'gemini',
      userMessageSelector: '#old-user-turn',
      assistantMessageSelector: '#old-model-turn',
      bindingSource: 'manual',
      automaticBindingVersion: null,
    };
    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(async (message) => {
      const request = message as { type?: string; binding?: CustomSiteBindingRecord };
      if (request.type === 'binding.get') return { ok: true, binding: staleBinding };
      if (request.type === 'binding.save') return { ok: true, binding: request.binding };
      return { ok: true };
    });
    const adapter = new UserBoundPlatformAdapter('gemini', 'gemini.google.com');

    await adapter.initialize();

    expect(adapter.getBinding()).toMatchObject({
      userMessageSelector: 'user-query',
      assistantMessageSelector: 'model-response',
      bindingSource: 'mixed',
      automaticBindingVersion: 6,
    });
    expect(adapter.getCapabilities()).toContain('messages.read');
    expect(adapter.getCapabilities()).toContain('timeline');
    adapter.dispose();
  });

  it('recovers Gemini message features even while its replacement composer is still loading', async () => {
    document.body.innerHTML = `
      <main id="messages">
        <user-query>Prompt available before composer</user-query>
        <model-response>Response available before composer</model-response>
      </main>
    `;
    const staleBinding: CustomSiteBindingRecord = {
      ...binding(),
      platformId: 'gemini',
      composerSelector: '#removed-composer',
      userMessageSelector: '#removed-user-turn',
      assistantMessageSelector: '#removed-model-turn',
      bindingSource: 'manual',
      automaticBindingVersion: null,
    };
    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(async (message) => {
      const request = message as { type?: string; binding?: CustomSiteBindingRecord };
      if (request.type === 'binding.get') return { ok: true, binding: staleBinding };
      if (request.type === 'binding.save') return { ok: true, binding: request.binding };
      return { ok: true };
    });
    const adapter = new UserBoundPlatformAdapter('gemini', 'gemini.google.com');

    await adapter.initialize();

    expect(adapter.getBinding()).toMatchObject({
      composerSelector: '#removed-composer',
      userMessageSelector: 'user-query',
      assistantMessageSelector: 'model-response',
    });
    expect(adapter.getCapabilities()).not.toContain('composer.write');
    expect(adapter.getCapabilities()).toContain('messages.read');
    adapter.dispose();
  });

  it('replaces a valid but under-counting legacy Gemini selector with full turn coverage', async () => {
    document.body.innerHTML = `
      <section>
        <div class="legacy-user-message">Retained prompt</div>
        <div class="legacy-assistant-message">Retained response</div>
      </section>
      <main id="messages">
        <user-query>New prompt one</user-query>
        <model-response>New response one</model-response>
        <user-query>New prompt two</user-query>
        <model-response>New response two</model-response>
      </main>
      <textarea id="composer" placeholder="Message Gemini"></textarea>
      <button id="send" aria-label="Send message">Send</button>
    `;
    const underCountingBinding: CustomSiteBindingRecord = {
      ...binding(),
      platformId: 'gemini',
      userMessageSelector: '.legacy-user-message',
      assistantMessageSelector: '.legacy-assistant-message',
      bindingSource: 'manual',
      automaticBindingVersion: null,
    };
    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(async (message) => {
      const request = message as { type?: string; binding?: CustomSiteBindingRecord };
      if (request.type === 'binding.get') return { ok: true, binding: underCountingBinding };
      if (request.type === 'binding.save') return { ok: true, binding: request.binding };
      return { ok: true };
    });
    const adapter = new UserBoundPlatformAdapter('gemini', 'gemini.google.com');

    await adapter.initialize();

    expect(adapter.getBinding()).toMatchObject({
      userMessageSelector: 'user-query',
      assistantMessageSelector: 'model-response',
    });
    expect(await adapter.getMessages()).toHaveLength(4);
    adapter.dispose();
  });

  it('completes an automatic binding when the assistant response arrives after the prompt', async () => {
    document.body.innerHTML = `
      <main id="messages">
        <article class="user-prompt">Question first</article>
      </main>
      <textarea id="composer" placeholder="Message the AI"></textarea>
      <button id="send" aria-label="Send message">Send</button>
    `;
    let storedBinding: CustomSiteBindingRecord | null = null;
    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(async (message) => {
      const request = message as { type?: string; binding?: CustomSiteBindingRecord };
      if (request.type === 'binding.get') return { ok: true, binding: storedBinding };
      if (request.type === 'binding.save') {
        storedBinding = request.binding ?? null;
        return { ok: true, binding: storedBinding };
      }
      return { ok: true };
    });
    const adapter = new UserBoundPlatformAdapter('custom', location.hostname);
    await adapter.initialize();

    expect(adapter.getBinding()?.userMessageSelector).toBe('.user-prompt');
    expect(adapter.getBinding()?.assistantMessageSelector).toBeNull();

    const response = document.createElement('article');
    response.className = 'assistant-response';
    response.textContent = 'Answer later';
    document.querySelector('#messages')?.append(response);

    await vi.waitFor(
      () => expect(adapter.getBinding()?.assistantMessageSelector).toBe('.assistant-response'),
      { timeout: 1_500 },
    );
    expect(adapter.getCapabilities()).toContain('messages.read');
    adapter.dispose();
  });

  it('keeps observing messages when an SPA replaces the conversation container', async () => {
    document.body.innerHTML = `
      <main id="messages">
        <article class="user-message">Old question</article>
        <article class="assistant-message">Old answer</article>
      </main>
      <textarea id="composer"></textarea><button id="send">Send</button>
    `;
    const adapter = new UserBoundPlatformAdapter('custom', location.hostname);
    adapter.setBinding(binding());
    const observed = vi.fn();
    const unsubscribe = adapter.observeMessages(observed);

    const replacement = document.createElement('main');
    replacement.id = 'messages';
    replacement.innerHTML = `
      <article class="user-message">New question</article>
      <article class="assistant-message">New answer</article>
    `;
    document.querySelector('#messages')?.replaceWith(replacement);

    await vi.waitFor(() =>
      expect(observed).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'user', plainText: 'New question' }),
          expect.objectContaining({ role: 'assistant', plainText: 'New answer' }),
        ]),
      ),
    );
    unsubscribe();
    adapter.dispose();
  });

  it('re-identifies a same-route DOM replacement and notifies feature consumers', async () => {
    document.body.innerHTML = `
      <main id="messages">
        <article class="user-message">Old question</article>
        <article class="assistant-message">Old answer</article>
      </main>
      <textarea id="composer" placeholder="Message the AI"></textarea>
      <button id="send" aria-label="Send message">Send</button>
    `;
    let storedBinding: CustomSiteBindingRecord | null = {
      ...binding(),
      bindingSource: 'automatic',
      automaticBindingVersion: 4,
    };
    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(async (message) => {
      const request = message as { type?: string; binding?: CustomSiteBindingRecord };
      if (request.type === 'binding.get') return { ok: true, binding: storedBinding };
      if (request.type === 'binding.save') {
        storedBinding = request.binding ?? null;
        return { ok: true, binding: storedBinding };
      }
      return { ok: true };
    });
    const adapter = new UserBoundPlatformAdapter('custom', location.hostname);
    await adapter.initialize();
    const bindingChanged = vi.fn();
    adapter.subscribeBindingChanges(bindingChanged);

    document.body.innerHTML = `
      <main>
        <user-query>New question</user-query>
        <model-response>New answer</model-response>
      </main>
      <form>
        <textarea id="replacement-composer" placeholder="Message the AI"></textarea>
        <button id="replacement-send" type="submit" aria-label="Send message">Send</button>
      </form>
    `;

    await vi.waitFor(
      () =>
        expect(adapter.getBinding()).toMatchObject({
          composerSelector: '#replacement-composer',
          userMessageSelector: 'user-query',
          assistantMessageSelector: 'model-response',
        }),
      { timeout: 2_500 },
    );
    expect(bindingChanged).toHaveBeenCalled();
    expect(adapter.getCapabilities()).toContain('composer.write');
    expect(adapter.getCapabilities()).toContain('messages.read');
    expect(adapter.getCompatibilityMonitorSnapshot()).toMatchObject({
      phase: 'healthy',
      evidence: { composer: true, readableMessages: true },
    });
    adapter.dispose();
  });

  it('fails closed while required DOM is missing and recovers without a new binding action', async () => {
    document.body.innerHTML = `
      <main id="messages">
        <article class="user-message">Question</article>
        <article class="assistant-message">Answer</article>
      </main>
      <textarea id="composer"></textarea><button id="send">Send</button>
    `;
    const adapter = new UserBoundPlatformAdapter('custom', location.hostname);
    adapter.setBinding(binding());
    await adapter.recoverCompatibility();

    document.body.replaceChildren();

    await vi.waitFor(() =>
      expect(adapter.getCompatibilityMonitorSnapshot().phase).toMatch(/degraded|recovering/),
    );
    expect(adapter.getCapabilities()).not.toContain('composer.write');
    expect(adapter.getCapabilities()).not.toContain('messages.read');

    document.body.innerHTML = `
      <main id="messages">
        <article class="user-message">Restored question</article>
        <article class="assistant-message">Restored answer</article>
      </main>
      <textarea id="composer"></textarea><button id="send">Send</button>
    `;
    await vi.waitFor(() => expect(adapter.getCapabilities()).toContain('messages.read'));
    expect(adapter.inspectCompatibility()).toMatchObject({
      composer: true,
      readableMessages: true,
    });
    adapter.dispose();
  });
});
