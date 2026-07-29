# Multi-AI Workspace

Multi-AI Workspace is a bilingual, privacy-conscious Manifest V3 browser extension for supported AI chat websites.

The extension first uses local, high-confidence semantic detection for a page composer and send control. If candidates are ambiguous it refuses to guess, keeps selection rewrite and local tools available, and offers optional click-based connection only for the page enhancement the user needs. It ships no copied third-party selector list.

## Implemented features

- English and Simplified Chinese can be switched directly in the popup, settings, or page panel; Traditional Chinese remains available from settings.
- Background-only AI Provider profiles for OpenAI, Anthropic, Google, DeepSeek, xAI, Moonshot, OpenAI-compatible APIs, and local Ollama-compatible endpoints.
- Exact API-origin permission requests, session-only keys, and password-based AES-GCM encrypted local keys.
- Confirmation-first Prompt Rewrite with 11 modes, editable results, replace/insert/append/copy actions, and Prompt Manager saving.
- Prompt Manager CRUD, search, tags, JSON import/merge/export, usage counts, and user-gesture variables.
- Automatic high-confidence composer, send-control, user-Prompt, and assistant-response detection, including localized semantic attributes and rich `contenteditable` variants; saved validation and click-based correction fail closed when candidates are ambiguous.
- Composer read/write, 500 ms local drafts with safe automatic restoration into an empty composer, one-click restore/undo in page shortcuts, selection quote reply, and IME-safe send shortcuts.
- Native-first conversation branching for every safely detected user or assistant message. ChatGPT and Gemini use a unique visible native branch action when one can be verified. Otherwise, a clearly labeled context branch opens the platform's new-chat page and transfers bounded visible system/user/assistant text through an expiring session-only handoff. Attachments, tools, HTML, and hidden reasoning are excluded; transferred context is never sent automatically or persisted to IndexedDB.
- Selected-text actions that appear beside page selections: Prompt Rewrite, capability-gated Quote Reply, content-free conversation pins, and four-color single-layer highlights. Pins work from an explicitly selected readable block even when a site's message selectors are unavailable, stay local to one conversation, and expose their own right-side dots, hover list, remove action, and previous/next navigation. Reapplying the same highlight color is idempotent, a new color replaces only its overlap, and removal never reveals an overwritten color.
- Automatic inline Mermaid rendering for explicit conversation code blocks: locally bundled strict-mode processing, streaming-safe retries, light/dark theme output, untouched source on failure, safe SVG sanitization, and retained source/SVG/PNG tools. Clicking a detected formula copies its verified KaTeX, MathJax, MathML, TeX annotation, or explicit source in the format selected under full settings. Render-only formulas use a clearly labeled local approximation for LaTeX, Word, or Notion when possible; unavailable MathML is reported instead of being fabricated.
- A hover-revealed page-level Prompt navigator that normally shows only one deduplicated position dot per user Prompt; hovering or focusing reveals summaries, and clicking a dot or summary jumps directly to that turn. The panel timeline tracks the active message and supports search/filtering, notes, hierarchy and collapse state, node selection, direct jumps, and selected-node Markdown/JSON/sanitized HTML export.
- Optional content-free completion notifications driven only by an explicit accessible or user-bound generation lifecycle, with cancellation/failure suppression and per-answer deduplication.
- Per-platform default models for new empty chats, applied only through an explicitly bound visible model control; existing conversations and unavailable models are left unchanged.
- Optional Off/Snow/Sakura/Rain/Tiny mushrooms/Dandelion visual effects rendered in one non-interactive Canvas layer, with reduced-motion support, background-tab suspension, bounded density, and live updates across SPA conversation changes.
- A lightweight page shortcut menu under the **MW** launcher that shows only currently usable Prompt templates, Pin, Branch, and Export actions. Prompt templates can be searched and inserted directly into the current composer; the full workspace remains a secondary entry.
- Popup onboarding followed directly by a six-way Background Effects quick control and compact live settings; the full categorized settings page retains Provider, diagnostics, migration/backup, secret-free data export, and reset tools.
- Runtime feature gates for Prompt Rewrite, Prompt Manager, timeline, and current-conversation export; turning a switch off removes that surface without a page reload.

The first-party native-feature audit and exact skip/keep decisions are recorded in [docs/NATIVE_FEATURE_POLICY.md](docs/NATIVE_FEATURE_POLICY.md).

IDE bridges, remote announcements, automatic account detection, and image-watermark removal remain deliberately disabled pending verified protocols or product authorization.

## Supported default origins

- `https://chatgpt.com/*`
- `https://claude.ai/*`
- `https://gemini.google.com/*`
- `https://chat.deepseek.com/*`
- `https://grok.com/*`
- `https://www.kimi.com/*`

No custom website origins are supported in this release.

## Install and try it

1. Run `npm install` with Node.js 22.12 or newer.
2. Run `npm run verify` and `npm run test:e2e`.
3. In Chrome or Edge, open the extensions page, enable Developer mode, choose **Load unpacked**, and select `dist/chrome`.
4. In Firefox, open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `dist/firefox/manifest.json`.
5. Open the extension popup, choose **中文** or **EN**, finish privacy onboarding, and confirm the popup immediately shows live settings instead of platform-binding cards.
6. Under **AI Provider**, choose a quick template, confirm its model, add your own API key (or select keyless local Ollama), grant only its exact API origin, and choose session-only or encrypted-local key storage.
7. Open a supported AI chat page. Selection rewrite works immediately; composer enhancements and the right-side Prompt navigator connect automatically when semantic detection is confident.
8. Select text inside a conversation response: choose **Pin**, **Highlight**, a highlight color, or **Improve Prompt**; **Quote Reply** also appears when composer write access is available. A pinned range receives a separate right-side pin dot even when the site's message selectors are unavailable; select the same range to unpin it, or use the pin list and previous/next controls.
9. Explicit Mermaid blocks render inline after their source settles; click the diagram to open source/export tools. Click a detected formula to copy it immediately in the preferred format configured under **Settings → Markdown / Mermaid / Formula**.
10. Open the page shortcut menu to restore or undo previous input, search and insert reusable Prompt templates, or access only the Pin, Branch, and Export actions currently available on that page. Use **Open full Prompt Manager** inside the template area to create, edit, import, or export templates; its only general setting is the enable switch under **Input**. Choose **Open full workspace** for status, self-check, connection, and other detailed tools.
11. Choose Off, Snow, Sakura, Rain, Tiny mushrooms, or Dandelion from the extension popup or full settings. The open supported AI page updates immediately without page binding.

Existing page DOM can change. Saved selectors are revalidated and automatic detection retries after page changes. If confidence is insufficient, only that page enhancement remains unavailable until the user selects the required element.

## Development

```text
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
```

The project uses npm and `package-lock.json` is authoritative. Builds are written to `dist/chrome` and `dist/firefox`.

## Architecture and privacy boundaries

- **Extension pages:** React popup/options UI, settings, Provider and local-data management.
- **Background:** provider keys, outbound AI requests, migrations, data broker, and notifications. Provider keys are never returned to content scripts.
- **Content:** an isolated Shadow DOM workspace with conservative semantic auto-detection and optional user-picked corrections. It uses public DOM only—no cookies, tokens, hidden APIs, or private platform endpoints.
- **Storage:** small settings in `browser.storage.local`; structured local data in IndexedDB schema version 14. Highlight and pin anchors store only scoped message identity, character offsets, optional color, and a SHA-256 text check—not selected message text. Session secrets use `browser.storage.session`; persistent secrets use PBKDF2-SHA-256 plus AES-GCM.
- **Permissions:** six explicit AI-chat hosts, optional exact API origins, and optional notifications. No `<all_urls>`, `scripting`, `identity`, cookies, webRequest, or remote executable code.

Conversation context is off by default. If enabled in Privacy, each rewrite still asks for confirmation before sending at most 10 bound visible messages. Raw export excludes Provider secret payloads.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/VOYAGER_CLEAN_ROOM_ADAPTATION.md](docs/VOYAGER_CLEAN_ROOM_ADAPTATION.md), [docs/GPT_VOYAGER_GAP_MATRIX.md](docs/GPT_VOYAGER_GAP_MATRIX.md), [docs/DOM_FIXTURE_GUIDE.md](docs/DOM_FIXTURE_GUIDE.md), and [docs/MANUAL_TEST_MATRIX.md](docs/MANUAL_TEST_MATRIX.md).

## License

Original project code is MIT licensed. Runtime dependency notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). This is a clean-room implementation and contains no third-party extension source, CSS, assets, or translations.
