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
  it.each(['chatgpt', 'gemini'] as const)(
    'does not expose an extension-owned branch action on %s',
    async (platformId) => {
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
      const adapter = new UserBoundPlatformAdapter(platformId, location.hostname);
      bind(adapter, platformId);

      expect(adapter.getCapabilities()).not.toContain('conversation.fork.native');
      expect(adapter.getCapabilities()).not.toContain('conversation.fork.manual');
      const [message] = await adapter.getMessages();
      await expect(adapter.forkConversation(message)).rejects.toThrow(
        /conversation\.fork\.manual capability is unavailable/,
      );
      expect(nativeClick).not.toHaveBeenCalled();
      adapter.dispose();
    },
  );

  it('keeps a safe context handoff on platforms without confirmed native branching', async () => {
    for (const platform of SUPPORTED_PLATFORMS.filter(
      ({ id }) => id !== 'chatgpt' && id !== 'gemini',
    )) {
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
