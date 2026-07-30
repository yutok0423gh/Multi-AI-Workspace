# Changelog

## 2.1.1 - 2026-07-30

- Added a review-first context-branch preview for Claude, DeepSeek, Grok, and Kimi. Short transfers can open a new chat and fill its composer, while long transfers are downloaded locally as Markdown and place only a short attachment instruction in the new composer.
- Fixed Grok and Kimi branch handoffs on empty new-chat pages by keeping the session-only receiver active before any conversation messages exist. Composer writes now support controlled rich-text editors, confirm the inserted content, retry delayed page bindings, and never send automatically.
- Hardened content-to-background messaging against an invalidated extension context so affected page features show a reload-required state instead of leaking low-level `sendMessage` errors or breaking the host website.
- Made one-click formula copy fall back to verified LaTeX or displayed text when the configured format is unavailable, with accurate feedback about the format actually copied.
- Made long Prompt-navigation lists wheel-scrollable with a fixed heading and count so every detected Prompt remains reachable without expanding beyond the viewport.
- Added focused unit and browser regression coverage for branch preview, direct and Markdown handoffs, delayed composers, empty Grok/Kimi chats, rich-text insertion, runtime recovery, formula fallback, and scrollable navigation.

## 2.1.0 - 2026-07-30

- Removed extension-owned conversation branch controls from ChatGPT and Gemini. Their adapters no longer advertise manual or extension-driven native branch capabilities, compatibility self-check reports the verified platform-native feature, and page shortcuts remain free of duplicate branch actions.
- Kept the bounded, session-only context branch workflow available on Claude, DeepSeek, Grok, and Kimi, where no confirmed platform-native branch feature is recorded.
- Added local Markdown and plain-text insertion to the full Prompt Manager. Users can insert `.md`, `.markdown`, or `.txt` content at the current caret, replace an active selection, review or edit the result, and save only when ready.
- Limited inserted Prompt files to 10 MB, rejects unsupported, empty, or unreadable files without changing the editor, removes a leading byte-order mark, and keeps the entire operation local without adding permissions or uploading file contents.
- Added English, Traditional Chinese, and Simplified Chinese file-insertion labels, guidance, success feedback, and validation errors in the existing Prompt Manager interface.
- Added Chrome Web Store icon and top-promotion artwork alongside focused unit and browser coverage for file validation, caret insertion, native branch gating, compatibility status, and the no-auto-save workflow.

## 2.0.0 - 2026-07-29

- Redesigned the popup and full settings workspace in a restrained Nordic visual system with grouped navigation, compact category icons, responsive layouts, clearer live-state feedback, and a new symmetrical MW brand mark across extension assets and injected page controls.
- Replaced About-page letter monograms with packaged official platform artwork for ChatGPT, Claude, Gemini, DeepSeek, Grok, and Kimi. The About page still derives platform support and timeline availability from the same runtime registries used by the extension.
- Strengthened automatic page connection with versioned per-platform DOM profiles, verified first-party message patterns, brand-aware composer scoring, and safe fallback discovery. DeepSeek now recognizes its visible textarea and virtualized assistant-message structure without requiring the user to bind every element manually.
- Made Prompt navigation resilient to virtualized or temporarily unmounted messages by merging observed message windows, caching rail positions, refreshing the target after approximate scrolling, and preserving one stable numbered point per user Prompt. Kimi uses instant host-compatible jumps to avoid overlapping smooth-scroll animations.
- Changed conversation branching to use a verified native branch action before preparing any manual handoff. Platforms without a safe native action receive a clearly labeled context branch that transfers bounded visible context through the existing expiring session-only flow.
- Improved formula tools so clicking a detected formula immediately copies the configured default format, while a separate compact `fx` control opens a Nordic format chooser for LaTeX, MathML, Word, Notion, or rendered text. The popup now exposes the same canonical default-format setting for quick changes.
- Refined formula discovery and copy feedback for live KaTeX, MathJax, MathML, explicit TeX annotations, and render-only formulas. Hover affordances, accessible action labels, local approximation boundaries, and clipboard feedback are consistent across supported pages.
- Removed Prompt-library favorites and their retired stored field while preserving Prompt CRUD, search, tags, import, merge, export, and usage counts. Database migrations normalize older Prompt records without deleting their content.
- Simplified documentation and runtime copy around the six built-in supported websites, current permission model, native-first branching, page shortcuts, formula behavior, and the removal of custom website support.
- Added and expanded unit and browser coverage for platform DOM profiles, DeepSeek auto-connection, virtualized Prompt navigation, Kimi jumps, branching, formula discovery and copy-format UI, migration cleanup, and the redesigned popup and settings workspace.

## 1.0.15 - 2026-07-29

- Removed the unused `scripting` permission and the retired custom-site dynamic-script cleanup. Current page integration continues to use only the statically declared content scripts and exact built-in host permissions.
- Changed local drafts to safely restore previous input by default only after the bound composer remains empty and the conversation scope is revalidated. The page shortcut menu now exposes mutually exclusive Restore and Undo Restore actions; undo never overwrites edited input and preserves the saved draft for another restore.
- Added one canonical per-platform default-model setting for new empty chats. The content adapter applies it only on the existing verified new-chat routes, only through a user-bound visible model control, verifies the visible selection, never changes conversations that already contain messages, and keeps the platform default without guessing when the configured model is missing or ambiguous.
- Reworked answer-completion notifications around explicit generation lifecycle signals instead of assistant-node creation. Standard `aria-busy` or an optional user-bound generation indicator starts a cycle; notification waits for the signal to end and the final readable message to settle, suppresses user-cancelled/alerted cycles, deduplicates by completion ID in both content and background layers, and treats missing OS permission as non-fatal.
- Integrated automatic inline Mermaid rendering into the existing message-markup pipeline. Explicit `mermaid` fenced blocks are locally rendered after a streaming settle window, isolated in Shadow DOM, theme-aware, width-bounded, and rendered at most once per unchanged source/theme. Invalid or incomplete diagrams retain their original source with a local error, while existing source, SVG, and PNG tools remain available.
- Simplified generic settings in both the full options page and popup to show only the setting name and its switch, selector, or segmented control. Removed repeated descriptions, default/current values, applicability, permission, stability metadata, and per-setting reset links from these rows.
- Removed the empty Platform-specific settings category and its bilingual navigation copy. Legacy `#platform-specific` links now return to Layout; platform adapters and their verified capability handling are unchanged.
- Completed clean-room conversation branching across ChatGPT, Claude, Gemini, DeepSeek, Grok, Kimi, and authorized custom sites. Every safely detected user/assistant message receives a nearby branch button; the manual flow previews bounded text-only context, copies it or opens the platform's new-chat destination, and uses a 15-minute session-only handoff that requires an explicit Insert click and never sends automatically. Tool/system messages, attachments, HTML, and hidden reasoning are excluded. ChatGPT and Gemini native branching are recorded from official first-party documentation without guessing or automating their private DOM controls.
- Removed message favorites end to end: the settings category and manager, timeline star action and filter, message snapshot record type, bilingual copy, styles, tests, and active documentation. Database schema v9 deletes the retired `favorites` object store and removes legacy `starred` fields from timeline metadata; legacy `#favorites` links return to Layout. Prompt Manager favorites remain an independent Prompt-library feature.
- Added clean-room conversation pins inspired by Voyager's publicly documented behavior: select text inside one response to pin/unpin an exact range, then use a separate right-side dot rail, hover list, remove control, and wrapping previous/next navigation. DeepSeek and other pages without detected message selectors use an explicit-selection fallback that stores only a numeric DOM structure path, offsets, and SHA-256 verification hash; it never guesses a private platform selector or stores selected text. Pins are scoped to one platform/account/conversation and survive compatible reload and SPA conversation changes.
- Removed Cloud Sync and local sync packages end to end: settings UI and routes, Google Drive OAuth and transport, background messages, build-time OAuth injection, the `identity` permission, bilingual copy, tests, record types, and active documentation. Database schema v8 removes the retired `syncQueue` store and cleans legacy Cloud Sync settings and metadata during upgrade; normal local raw-data export and reset remain available.
- Removed Conversation Index end to end: page visit collection, settings and popup controls, local management UI, record types, raw export and sync payloads, styles, tests, and active documentation. Database schema v6 physically deletes the retired `conversationIndex` object store and normalizes upgraded settings; legacy `#conversation-index` links return to Layout. Prompt navigation, the current-conversation timeline, and conversation export remain available.
- Combined Prompt Rewrite and AI Provider into one settings destination. Provider setup now sits directly below the rewrite workbench, configuration actions scroll within the same page, saved/removed profiles refresh the workbench selector immediately, and legacy `#ai-provider` links remain compatible.
- Added two lightweight canvas background effects: tiny red mushrooms that fall with a gentle sway, and dandelion puffs and seeds that drift upward. Both are available from popup quick controls and full settings, remain non-interactive, pause while hidden, and respect reduced-motion preferences.
- Expanded About into a bilingual installation overview generated from the supported-platform registry, including the six built-in AI websites, custom-site boundary, browser builds, interface languages, connection model, local-first data policy, optional provider policy, and privacy shortcuts.
- Removed the local conversation-folder feature from settings, the popup, the MW conversation panel, conversation-index bulk actions, platform capabilities, injected sidebars, sync packages, tests, record types, and storage APIs. Database schema v5 deletes the retired `chatFolders` and `folderAssignments` object stores during upgrade.
- Formula copy now rechecks the live element when opened and recognizes additional verified MathJax, MathML, TeX annotation, and explicit source variants. Render-only formulas show a preview with one safe copy action and one clearly secondary, review-required local LaTeX estimate.

All notable changes to this project are documented here.

## 1.0.13 - 2026-07-17

### Fixed

- Local sidebar folders now finish their first data render inside a detached Shadow DOM and enter the host sidebar atomically, preventing the empty-first-frame layout jump.
- Ordinary left-clicks on same-origin folder conversations now reuse the AI site's matching native conversation link and SPA router when available, with a History API route fallback instead of a full document reload.
- Route changes keep the already-mounted folder content visible while its records refresh; modified clicks, new-tab actions, and cross-origin links retain normal browser behavior.

### Verification

- Added unit coverage for native-link reuse, same-origin history fallback, unsafe/cross-origin handling, and extension-link exclusion.
- Added a Gemini browser regression that verifies the first inserted sidebar host is populated, switches to a second conversation and back, preserves the same document boot identifier, and survives a host sidebar replacement.

## 1.0.12 - 2026-07-17

### Added

- Extended the isolated local Folder sidebar from Gemini to DeepSeek, Grok, and Kimi using platform-scoped URL patterns plus semantic sidebar, history, and navigation markers.
- Added a reusable logged-out public-page sidebar audit for the six built-in platforms; it records only status, final URL, title, semantic candidate counts, and short visible control labels in a fresh browser context.
- Added six-platform browser workflows: resilient sidebar creation/relinking for Gemini, DeepSeek, Grok, and Kimi, plus MW local-folder operation without duplicate sidebar injection on ChatGPT and Claude.

### Changed

- ChatGPT and Claude continue to use their confirmed native Projects in the sidebar; the extension's local URL folders remain available from MW → Conversation and full settings.
- DeepSeek's officially documented cross-platform chat history is now recorded in the native-feature policy without inferring undocumented folders or Projects.

### Safety

- Generic sidebar discovery accepts only semantic navigation containers, known conversation URL shapes, localized history headings, or exact New Chat controls. If confidence is insufficient, it fails closed and leaves the MW folder workflow available.

## 1.0.11 - 2026-07-17

### Added

- Gemini now receives a native-looking local Folder section directly above its Recent conversation list, with bilingual labels, folder/conversation search, expandable folders, direct conversation links, inline folder creation, and an add-current-conversation action.

### Fixed

- The injected Folder section automatically reattaches when Gemini replaces its sidebar during SPA navigation, without modifying or removing Gemini's own sidebar content.
- Folder edits made from the MW Conversation panel now refresh the Gemini sidebar immediately.

### Security and performance

- The sidebar UI is isolated in its own Shadow DOM, opens only validated HTTP(S) conversation URLs, scopes records by platform/account, and sanitizes optional folder colors.
- DOM observation is limited to structural changes and top-level theme attributes; it does not watch all page attribute churn.

## 1.0.10 - 2026-07-17

### Fixed

- Local conversation folders no longer depend on bound message elements; folder creation and URL assignment work from the MW Conversation tab using only current-page metadata.
- Folder assignments now use the same stable conversation-ID-or-URL fallback for saving and restoring, fixing lost selections on sites without a stable conversation ID.

### Changed

- Creating a folder now adds the current conversation immediately instead of leaving the new folder unassigned.
- The page panel and full Folder settings now show safe, directly clickable HTTP(S) conversation links; non-web URL schemes are never opened.
- Folder controls explain where to find the feature and which separate timeline/export actions still require readable messages.

## 1.0.9 - 2026-07-17

### Added

- Added an always-visible bilingual Background Effects quick control to the extension popup, allowing Off, Snow, Sakura, and Rain to be selected without opening full settings or binding the page.

### Changed

- Reworked snow into depth-aware particles with varied flakes, six-arm crystals, soft glow, gentle wind, independent sway, rotation, and subtle opacity variation.
- Kept the animation inside the existing pointer-transparent Canvas layer with bounded density, hidden-tab suspension, and reduced-motion support.

## 1.0.8 - 2026-07-17

### Changed

- Replaced the render-only formula dialog's disabled format buttons with a recommended compatible-text copy action and clearly labeled local approximate LaTeX, Word, and Notion actions.
- Exact-source dialogs now hide unavailable formats instead of presenting disabled controls.
- Added conservative local conversion for common Unicode superscripts, subscripts, roots, operators, relations, arrows, Greek letters, and fractions; approximate output is never labeled as verified source.

### Fixed

- Recognize explicit TeX annotations whose encoding includes a display-mode suffix, plus `application/tex` and `TeX` annotation variants.

## 1.0.7 - 2026-07-17

### Fixed

- Normalized intersecting text highlights into one visible color layer per character range.
- Reapplying the same color is idempotent; a different color replaces only the selected overlap instead of stacking above an older color.
- Separated Apply Highlight from Remove Highlight so removal clears the selected highlight completely and never reveals an overwritten color underneath.
- Existing overlapping highlight records are flattened by recency when rendered and rewritten as non-overlapping records on the next edit.

## 1.0.6 - 2026-07-16

### Added

- Added a bilingual Visual Effects setting with Off, Snow, Sakura, and Rain modes, applied immediately without page binding.
- Added one isolated, non-interactive Canvas effect layer that remains available across supported SPA conversation changes.

### Performance and accessibility

- Animation stops while the tab is hidden or reduced motion is requested, caps device-pixel ratio and particle density, and lowers density on narrow viewports.
- The effect layer never mutates host-page content and cannot intercept clicks, selection, typing, or scrolling.

## 1.0.5 - 2026-07-16

### Added

- Added real manual Google Drive synchronization through the hidden `appDataFolder` and the non-sensitive `drive.appdata` scope.
- Added explicit connect, status, sync-now, last-successful-sync, disconnect, OAuth setup, and bilingual error states to Cloud Sync settings.
- Added conditional ETag uploads and one conflict retry so a concurrently changed remote package is downloaded and merged before another upload attempt.

### Security

- Google API origins are requested only from a user click and released on disconnect; access tokens remain in Chrome's identity cache and are never written to extension storage or sync packages.
- Invalid remote packages fail closed and are never applied or overwritten. API keys, drafts, message bodies, highlights, Provider profiles/secrets, and custom-site bindings remain excluded.

## 1.0.4 - 2026-07-16

### Added

- Completed the Markdown / Mermaid / Formula settings category with live switches for Mermaid tools, default diagram/source view, formula copy tools, and preferred LaTeX/MathML/Word/Notion format.
- Added message-scoped Mermaid discovery with locally bundled on-demand rendering, strict security configuration, source limits, timeouts, sanitized SVG preview, untouched source view/copy, and SVG/PNG export.
- Added verified formula extraction for KaTeX annotations, MathJax source nodes, MathML, and explicit LaTeX attributes, including a clearly labeled rendered-text fallback that is never inferred as LaTeX.

### Changed

- Split Mermaid into a packaged lazy module so ordinary conversation pages retain a small content script and load the renderer only after an explicit user click.

## 1.0.3 - 2026-07-16

### Fixed

- Split one selected range into content-free anchors for every intersected message, so Quote Highlight can persist, restore, recolor, and remove a selection spanning multiple paragraphs, nested nodes, or conversation turns.

## 1.0.2 - 2026-07-16

### Added

- Metadata-only local conversation index with automatic visit capture, bilingual search/filter UI, tags, notes, favorites, reversible archive, pagination, and bulk organization.
- Conversation-index records in local-first sync packages with backward-compatible empty defaults for older packages.
- Selected-text Quote Reply next to Prompt Rewrite when composer write capability is validated.
- Four-color selected-text highlights with no-binding page-session fallback, content-free persistent offset/hash anchors for bound messages, repeat-selection removal, and non-mutating page overlays.
- A hover-revealed right-side Prompt navigator with a text summary and smooth-scroll dot for every deduplicated user Prompt.
- A complete panel timeline with active-message tracking, search and role/state filters, persisted node stars/notes/hierarchy/collapse state, direct jumps, and selected-node Markdown/JSON/HTML export.

### Changed

- Replaced the popup platform-readiness and automatic-binding cards with a directly editable compact settings panel backed by the same validated settings repository as the full options page.
- IndexedDB schema advanced to version 4; raw exports include `conversationIndex` and content-free `textHighlights` anchors.
- Automatic or manual connection remains optional for local tools; Quote Reply is capability-gated and never submits a message.
- Automatic connection now discovers semantic user-Prompt and assistant-response collections in the visible conversation region, while excluding navigation, search, account, editor, and menu regions.
- Added a first-party native-feature policy: exact duplicate project-instruction mode is skipped on platforms with confirmed native Projects, while distinct cross-platform folders and current-conversation export remain available.
- Feature switches now gate their injected runtime surfaces, including Prompt Rewrite, Prompt Manager, folders, timeline, and conversation export; the compact popup also exposes font scale.

### Fixed

- Hardened Provider requests by rejecting credential-bearing or insecure remote endpoints, blocking redirects, omitting browser credentials and referrers, disabling response caching, and enforcing prompt/context size limits.
- Made full reset remove dynamic local/session Provider secrets and the background in-memory vault; raw exports now recursively strip Provider secrets, including migration backups.
- Revalidated folder assignments against platform/account scope during local editing and sync import.
- Reinitialized drafts, completion detection, and conversation indexing across single-page-app route changes.
- Corrected configured Enter shortcuts so non-matching Enter combinations insert a newline instead of being swallowed.
- Sanitized indexed conversation URLs to remove credential-like query parameters and fragments.
- Added an explicit conversation-index feature toggle and gated capture behind completed privacy onboarding.
- Released optional Provider origins only when they are no longer used by another Provider or custom site.
- Forced production constants into classic content/background bundles so extension pages never depend on a nonexistent browser `process` global.
- Replaced empty Provider dropdowns with a bilingual explanation, disabled rewrite action, direct configuration navigation, and quick-start Provider templates.
- Restricted highlight geometry to selected text-node glyph boxes so block-level line boxes and empty trailing space are never painted.
- Retried Prompt discovery after late DOM insertion, notified the UI when a saved Prompt selector becomes active in a new conversation, and kept the navigator below workspace panels so it cannot intercept their controls.
- Deduplicated nested and overlapping role nodes before exposing messages, while preserving identical Prompt text sent in separate turns; the right-side navigator now stays dot-only until hovered or keyboard-focused, measures positions against internal page scrollers, and separates overlapping dots.
- Extended automatic binding to localized semantic role attributes, `plaintext-only`/empty contenteditable composers, and initially disabled send controls; late assistant responses now complete partial bindings instead of leaving a site half-connected.
- Rebound message observers and capability state when single-page apps replace composer or conversation DOM nodes after a route change, so Prompt navigation, timelines, drafts, and completion detection continue across conversations.
- Moved the isolated workspace host outside SPA-managed body content and added a mount guardian that reattaches the same React app if a route transition removes it.
- Repaired stale Gemini manual/mixed message bindings after route changes: fragile single-turn IDs are replaced by high-confidence `user-query` / `model-response` collections, and message features can recover before the replacement composer finishes loading.
- Recreate and initialize the complete page adapter on every SPA conversation URL change, then remount all content hooks with a new adapter identity before disposing the previous conversation lifecycle.

## 1.0.0 - 2026-07-13

### Added

- Direct English/Simplified Chinese switching across popup, settings, and page workspace.
- Background-only multi-provider Prompt Rewrite with session or AES-GCM encrypted keys.
- Prompt Manager CRUD/search/tags/favorites/import/export and user-gesture variables.
- User-driven DOM binding for six default platforms and exact-origin custom sites.
- Composer actions, drafts, quote reply, IME-safe shortcuts, timeline, message favorites, local folders, and conversation export.
- Optional completion notifications, capability status, custom-site dynamic scripts, schema migration 2, and reset cleanup.
- Provider/adapter unit tests and production bilingual Playwright coverage.

### Safety boundaries

- No guessed fixed selectors, private APIs, cookies, login tokens, remote executable code, or automatic credential capture.
- Cloud/Drive, IDE bridge, remote announcements, account auto-detection, and watermark removal remain disabled pending separate credentials and verified protocols.

## 0.1.0 - 2026-07-13

### Added

- Greenfield npm, TypeScript, React, Vite, Manifest V3, Vitest, Playwright, ESLint, and Prettier foundation.
- Separate Chromium and Firefox packaging.
- Core settings, schemas, scoped records, IndexedDB stores, migrations, backups, raw export, reset, logging/redaction, exact-origin parsing, hashing, encryption, and i18n.
- Fail-safe platform and feature registries.
- Shadow DOM content launcher, popup privacy onboarding, and settings/data/diagnostic UI.
- Phase 0 audit, architecture, DOM fixture guide, manual test matrix, license, and third-party notices.
- Foundation unit and integration tests.

### Known limitations

- All live platform DOM capabilities are unverified and disabled.
- Phase 2 through Phase 8 product features are not implemented.
- Real-site browser testing and store packaging have not been completed.
