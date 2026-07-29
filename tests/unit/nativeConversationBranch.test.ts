import { afterEach, describe, expect, it, vi } from 'vitest';

import { UserBoundPlatformAdapter } from '../../src/platforms/base/UserBoundPlatformAdapter';
import { SUPPORTED_PLATFORMS } from '../../src/shared/constants/platforms';
import type { PlatformId } from '../../src/shared/types/platform';

function bind(adapter: UserBoundPlatformAdapter, platformId: PlatformId = 'chatgpt') {
  adapter.setBinding({
    id: `binding:${platformId}:http://localhost`,
    origin: location.origin,
    platformId,
    accountScopeId: 'anonymous',
    composerSelector: '#composer',
    sendButtonSelector: null,
    messageContainerSelector: '#messages',
    userMessageSelector: '.user-message',
    assistantMessageSelector: '.assistant-message',
    enabled: true,
    lastValidatedAt: 1,
    createdAt: 1,
    updatedAt: 1,
  });
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('native conversation branching', () => {
  it('uses the verified ChatGPT message menu action when it is uniquely available', async () => {
    document.body.innerHTML = `
      <main>
        <section id="messages">
          <article class="assistant-message">
            <p>Answer</p>
            <button id="more" aria-label="More actions"></button>
          </article>
        </section>
        <textarea id="composer"></textarea>
      </main>
    `;
    const nativeClick = vi.fn();
    document.querySelector('#more')?.addEventListener('click', () => {
      const action = document.createElement('button');
      action.setAttribute('role', 'menuitem');
      action.textContent = 'Branch in new chat';
      action.addEventListener('click', nativeClick);
      document.body.append(action);
    });
    const adapter = new UserBoundPlatformAdapter('chatgpt', location.hostname);
    bind(adapter);

    expect(adapter.getCapabilities()).toContain('conversation.fork.native');
    const [message] = await adapter.getMessages();
    await expect(adapter.forkConversation(message)).resolves.toEqual({ method: 'native' });
    expect(nativeClick).toHaveBeenCalledOnce();
    adapter.dispose();
  });

  it('fails closed to a context branch when no unique native action is visible', async () => {
    document.body.innerHTML = `
      <section id="messages"><article class="assistant-message">Answer</article></section>
      <textarea id="composer"></textarea>
    `;
    const adapter = new UserBoundPlatformAdapter('chatgpt', location.hostname);
    bind(adapter);
    const [message] = await adapter.getMessages();
    await expect(adapter.forkConversation(message)).resolves.toEqual({ method: 'manual' });
    adapter.dispose();
  });

  it('keeps a safe context handoff available across all six built-in platforms', async () => {
    for (const platform of SUPPORTED_PLATFORMS) {
      document.body.innerHTML = `
        <section id="messages"><article class="assistant-message">Answer</article></section>
        <textarea id="composer"></textarea>
      `;
      const adapter = new UserBoundPlatformAdapter(platform.id, location.hostname);
      bind(adapter, platform.id);
      expect(adapter.getCapabilities()).toContain('conversation.fork.manual');
      const [message] = await adapter.getMessages();
      await expect(adapter.forkConversation(message)).resolves.toEqual({ method: 'manual' });
      adapter.dispose();
    }
  });
});
