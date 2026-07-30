# Architecture

## Layer boundary

The code follows three primary layers:

1. `src/shared`: platform-independent types, validation, storage, migrations, logging, encryption, permissions, i18n, and utilities.
2. `src/platforms`: adapters and diagnostics. Platform-specific DOM access belongs only here.
3. `src/features`: individually registered features that depend on declared adapter capabilities rather than selectors.

UI and runtime surfaces consume those layers:

- `src/background` initializes storage, owns Provider secrets/outbound requests, brokers typed data access, and creates optional notifications.
- `src/content` identifies one of the six built-in supported origins, mounts isolated UI, runs conservative semantic detection with optional user correction, and tears down observers/listeners.
- `src/popup` handles onboarding and then exposes an always-visible, immediately persisted six-way Background Effects quick control above the compact implemented settings.
- `src/options` provides the full categorized settings surface and explicit Provider, local-data, and diagnostic actions.

## Safety invariants

- Adapters query selectors produced either by conservative local semantic detection or an explicit user element-picking action.
- Automatic detection requires one high-confidence editable candidate with a clear score margin. Ambiguous candidates fail closed, and no automatic path clicks a page control.
- Missing or non-resolving page connections disable only the dependent enhancement; selection rewrite and local workspace tools remain available.
- API keys remain in background session/encrypted storage and are never returned to content scripts.
- Provider requests reject embedded URL credentials and insecure remote endpoints, do not follow redirects, omit cookies/referrers, bypass caches, and enforce bounded request sizes.
- Prompt rewrites never overwrite the composer until the user chooses Replace, Insert, or Append.
- The content host is unique, Shadow DOM isolated, and non-interactive outside explicit controls.
- Seasonal effects use one extension-owned Canvas with `pointer-events: none`; they never alter host DOM, stop for hidden tabs or reduced-motion preferences, and cap both pixel ratio and responsive particle density.
- All active feature work receives an abort signal and is disposed before reevaluation.
- Migrations make a local/IndexedDB snapshot before changing the schema version.
- Upgrade cleanup retires previously registered custom-site scripts, records, and unused origin permissions. Reset removes extension-owned records, encrypted and session Provider secrets, the background secret vault, and optional permissions; no error path calls `storage.clear()`.
- Raw export recursively removes Provider secrets, including secrets nested in migration-backup snapshots.
- Settings are schema-validated and nested updates are merged.
- Logs redact known secret and content fields, emails, bearer tokens, and conversation identifiers.
- Selected-text Quote Reply is shown only after `composer.write` is validated, inserts quoted text at the cursor, and never activates the native send control.
- Selected-text highlights are drawn from the extension Shadow DOM as non-interactive viewport rectangles; they never wrap, replace, or annotate host-page message nodes.
- Highlight intervals are normalized per message so each character has at most one color. The latest applied color owns its overlap; removal deletes that interval instead of revealing an older layer.
- Highlighting works in memory without binding. When the range is inside a bound message, its persistent anchor contains platform/account/conversation scope, message identity, character offsets, color, and a SHA-256 verification hash. Selected message text is not stored or indexed.
- Conversation pins are independent from timeline metadata and Prompt navigation. A pin prefers one detected message; when message selectors are unavailable, an explicit user selection may create a numeric DOM structure-path anchor without enabling `messages.read` or guessing a platform selector. Pins store only scoped identity, structure path when required, character offsets, timestamps, and a SHA-256 verification hash, and derive previews from the live DOM. They are local-only, capped at 200 per conversation, and fail closed when the path or text hash no longer matches.
- The page-level Prompt navigator exposes one summary and position marker per validated user Prompt and delegates all movement to the adapter's `scrollToMessage` method. Prompt text is read from the current DOM for display and is not stored by the navigator.
- Timeline metadata is scoped by platform, account, conversation, and message key. It may store only hierarchy, collapse, and user-authored note state; message bodies remain in the live page DOM, while selected-node files are created only after an explicit export action.
- Conversation branching is omitted entirely on ChatGPT and Gemini because their native branching is confirmed. On Claude, DeepSeek, Grok, Kimi, and local fixtures, extension branching is adapter-gated by `messages.read`; the context-branch builder accepts only visible system/user/assistant plain text through the selected message, bounds long contexts, sanitizes the source URL, and excludes tool messages, attachments, HTML, and hidden reasoning. Cross-tab handoffs live only in `storage.session` (with a background-memory fallback), expire after 15 minutes, fill only through the normal composer adapter, and never activate Send.
- Chat summarization is an explicit Provider-backed action gated by `messages.read`. The content script sends only visible, non-empty user/assistant plain text after a per-request confirmation; system/tool/unknown messages, HTML, hidden reasoning, cookies, and platform credentials are excluded. The background validates a 500-message/200,000-character boundary, treats conversation content as untrusted data, and returns a structured in-memory result without storing or inserting it.
- Default-model application has one source in validated `AppSettings`. It runs only on the shared new-chat destinations already used by conversation branching, aborts when any conversation message exists, and delegates exact selection to a user-bound visible model control. Missing, duplicate, or unverifiable options raise the existing adapter error path; no fallback model is inferred and no request payload is intercepted.
- Completion notifications subscribe to adapter completion events rather than message-count growth. A cycle must expose `aria-busy` or a user-bound generation indicator, must transition to idle, and must retain a non-empty assistant message after a quiet final-state check. Pointer cancellation and accessible error states suppress completion, while content/background completion IDs prevent duplicate notifications. Permission or OS notification failure is isolated from the host answer flow.
- Inline Mermaid uses the same explicit code-block discovery and locally bundled strict renderer as the existing markup dialog. Per-element source/theme identity prevents repeated work; source changes during streaming replace the pending render, successful SVG is isolated in a page-local Shadow DOM, and errors restore the untouched code block. Mermaid remains strict, HTML labels are disabled, SVG is sanitized, and render time/source size are bounded.
- Formula source formats are labeled exact only when backed by explicit page metadata. A click resolves the format selected in full settings and writes it directly to the clipboard. Render-only Unicode conversion is local, user-triggered, clearly reported as approximate, bounded to 5,000 characters, and never persisted or presented as verified LaTeX; missing MathML is reported without inventing a fallback.
- Drafts, completion observers, and conversation capture are restarted when a supported site changes SPA routes.
- Compatibility monitoring also watches same-route DOM replacement. When the bound composer or message elements are replaced, the adapter re-runs conservative semantic discovery, publishes one binding revision so dependent hooks remount, and keeps a five-second watchdog for silent page changes. Missing or ambiguous DOM immediately removes dependent capabilities; recovery remains read-only and never clicks, types into, or rewrites host-page elements.
- The page Status panel derives Pin, Timeline, Branch, Quote Reply, and Export availability from current capabilities, native-platform policy, and feature settings. Its one-click check reuses the same recovery path. The downloadable compatibility report contains only platform ID, extension/browser major versions, timestamps, boolean DOM evidence, feature status/reason codes, recovery counters, and recent error codes; it excludes page URLs, selectors, account identifiers, error messages, and conversation content.
- The page **MW** launcher opens one lightweight shortcut menu. Prompt templates require both the Prompt Manager feature and validated `composer.write`; the menu reuses the existing local template search, variable expansion, usage counter, and cursor insertion path. Pin, Branch, and Export entries are derived from current adapter capabilities, readable live messages, and feature settings. Every entry calls the existing feature service. Prompt authoring remains available through the menu's explicit deep link, while only its enable switch appears under general Input settings; detailed status and visual-effect controls remain outside this shortcut menu.

## Build topology

The Vite programmatic build runs three passes per browser target:

1. Popup/options multi-page build.
2. Self-contained classic content bundle.
3. Self-contained classic background bundle.

The target manifest is then copied to `dist/<target>/manifest.json`. The Chromium manifest declares a service worker; the Firefox manifest declares a background script.
Production builds explicitly replace `process.env.NODE_ENV`; classic extension bundles must not depend on Node.js globals at runtime.

## Selector entry criteria

The shipped adapter generates selectors from the current public page only after semantic scoring and uniqueness checks, then validates saved selectors on reuse. Composer detection rejects ambiguous candidates and may use a platform-name accessibility hint only to resolve an otherwise tied candidate. Message detection accepts only role-shaped semantic elements in visible conversation regions and excludes navigation, search, account, editor, form, dialog, and menu regions. The only fixed message selectors are verified semantic role markers already exposed by ChatGPT and Gemini; all other platforms retain generic fail-closed discovery. Optional manual selection remains the fallback. Any additional platform selector requires a sanitized fixture covering composer, send control, message roles, conversation metadata, route transitions, and teardown before it can supplement automatic or manual connection.
