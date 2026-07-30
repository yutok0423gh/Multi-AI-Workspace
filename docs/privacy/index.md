---
title: Multi-AI Workspace Privacy Policy
---

# Multi-AI Workspace Privacy Policy

Last updated: July 30, 2026

## 1. Information Handled by the Extension

Multi-AI Workspace processes and may store the following information on the user’s device:

- Extension settings, language preferences, and interface preferences.
- Prompt templates and text imported into prompt templates.
- Unsent drafts and text-selection positions used for draft restoration.
- Supported conversation URLs and titles.
- Timeline metadata.
- Pin and highlight anchors.
- Conversation branch metadata and temporary branch context.
- User-configured AI provider profiles, including provider type, endpoint, model, and profile name.
- AI provider API keys or other provider credentials entered by the user.

To provide its user-facing features, the extension reads visible website content and personal communications on supported AI chat pages opened by the user. This may include chat composers, prompts, selected text, user messages, assistant responses, conversation titles, and conversation URLs.

The extension also processes limited user-interaction information required for its features, such as text selections, pin positions, highlight positions, and current reading or scroll positions. This information is used only to provide features explicitly available in the extension interface.

Multi-AI Workspace does not maintain a general browsing history and does not monitor websites outside the supported AI chat pages declared by the extension.

## 2. Chrome Web Store Data Categories

Depending on the features used, Multi-AI Workspace may handle the following Chrome Web Store user data categories:

- **Authentication information:** API keys or credentials entered by the user for an optional external AI provider.
- **Personal communications:** Prompts, unsent drafts, user messages, assistant responses, and conversation context.
- **Web history:** URLs and titles of supported AI conversations used to associate local drafts, pins, timelines, highlights, and branches with the correct conversation.
- **User activity:** User-initiated text selections, pin and highlight positions, and reading or scroll positions required for the corresponding features.
- **Website content:** Visible conversation text, composer text, selected text, conversation titles, and other visible content required for the extension’s disclosed functionality.

The extension does not intentionally collect personal identity information, health information, financial or payment information, precise location information, or data from unrelated websites.

Information that a user voluntarily includes in a prompt or conversation is handled as website content and personal communication solely to provide the feature requested by the user.

## 3. How Information Is Used

Information is used only to provide Multi-AI Workspace’s disclosed productivity features, including:

- Prompt management and optional prompt rewriting.
- Importing text files into prompt templates.
- Unsent draft restoration and undo.
- Quote replies and text highlighting.
- Conversation pins and position navigation.
- Supported conversation timelines.
- Conversation branching.
- Chat summarization.
- Conversation export.
- Mermaid diagram rendering.
- Formula copying.
- Optional answer-completion notifications.
- Optional interface and visual effects.
- Compatibility monitoring and safe feature recovery.

The extension does not use user information for advertising, behavioral profiling, credit assessment, lending decisions, or purposes unrelated to its disclosed single purpose.

## 4. Local Storage and Retention

Most information handled by Multi-AI Workspace is stored locally in the browser’s local, session, or IndexedDB storage.

The storage permission is used to save:

- Extension settings and interface preferences.
- Prompt templates and imported prompt text.
- Unsent drafts.
- Supported conversation URLs and titles.
- Timeline metadata.
- Pin and highlight anchors.
- Conversation branch metadata.
- AI provider profile metadata.

Conversation exports are created only when requested by the user and are downloaded to the user’s device. The extension does not maintain an active export-history database.

Locally stored information remains until the user deletes or resets it, clears the extension’s browser data, or uninstalls the extension.

Temporary information stored in browser session storage is removed when the relevant browser session ends or when the user removes it.

## 5. AI Provider Credentials

External AI provider access is optional.

AI provider API keys are stored in browser session storage by default. If the user chooses persistent storage, the API key is encrypted locally using AES-GCM with a password supplied by the user.

The encryption password is not sent to the developer.

The extension does not read or store passwords, authentication cookies, or session tokens belonging to supported AI chat websites.

Provider credentials are used only to authenticate requests that the user explicitly initiates through a configured provider-based feature.

## 6. Third-Party AI Providers

Prompt or conversation text is sent to a third-party AI provider only when the user:

1. Explicitly configures that provider; and
2. Invokes a provider-based feature, such as Prompt Rewrite or Summarize Chat.

Only information necessary to complete the requested operation is sent.

Prompt Rewrite does not automatically include conversation context unless the user enables the relevant setting or explicitly requests a context-dependent operation.

Summarize Chat uses the conversation content selected for summarization because that content is necessary to perform the requested feature.

Information is sent directly from the extension to the provider endpoint selected or configured by the user. It is not routed through a server operated by the developer.

The selected provider processes information according to its own privacy policy and terms. Users should review the provider’s policies before configuring it.

## 7. Data Sharing and Sale

The developer does not sell user data.

User data is not transferred to third parties except when:

- The transfer is necessary to complete a feature explicitly requested by the user through a configured AI provider.
- The transfer is required to comply with applicable law.
- The transfer is necessary to protect the security of the extension or its users.

The developer and the developer’s personnel do not manually read users’ prompts, conversations, drafts, API keys, or exported files.

User data is not transferred to advertising platforms, data brokers, information resellers, or credit-reporting services.

## 8. Extension Permissions

### Storage

The storage permission is used to save extension settings and local workspace information required for the extension’s disclosed features.

### Notifications

The notifications permission is optional and is requested only when the user explicitly enables answer-completion notifications.

A notification is sent only after an AI response has completed. Notifications do not include response text, prompts, conversation content, account information, API keys, or other sensitive information.

No completion notification is sent for cancelled, failed, interrupted, or incomplete responses.

### Host Permissions

Host permissions for supported AI chat websites are used to identify visible chat composers and conversation content and to provide user-facing page enhancements.

Optional host access to HTTPS origins is requested only when the user configures an external AI provider. At runtime, the extension requests access to the origin of the provider endpoint selected by the user.

Optional localhost access is used only when the user explicitly configures a locally installed service, such as an Ollama endpoint.

The extension does not use host permissions to read AI platform passwords or authentication cookies.

## 9. Remote Code

Multi-AI Workspace does not download or execute remote code.

All executable JavaScript and Mermaid runtime files are packaged with the extension.

Responses received from configured AI providers are treated only as data. They are not evaluated or executed as JavaScript, WebAssembly, modules, or other executable code.

The extension does not load remote scripts, remote modules, or remotely hosted WebAssembly.

## 10. Security

Communications with remote AI providers use HTTPS.

The only permitted non-HTTPS provider connection is a localhost endpoint explicitly configured by the user for a service running on the same device.

Persistent AI provider credentials are encrypted locally using AES-GCM.

The extension uses safety-aware page detection. If a required page element cannot be identified reliably, the affected enhancement is disabled or placed into a safe degraded state so that normal website operation remains available.

## 11. User Controls

Users can:

- Disable provider-based features.
- Avoid configuring an external AI provider.
- Disable answer-completion notifications.
- Disable page enhancements and visual effects.
- Delete individual prompt templates or provider profiles.
- Remove stored provider credentials.
- Delete or reset locally stored extension information.
- Clear extension data through the browser.
- Uninstall the extension.

Provider host permissions may be removed when the corresponding provider profile is deleted and the origin is no longer used by another configured profile.

## 12. Data Retention

Locally stored settings and workspace records remain until the user deletes or resets them, clears the extension’s browser data, or uninstalls the extension.

Session-only provider credentials and temporary conversation branch handoffs are retained only for the applicable browser session or until they expire or are removed.

The developer does not operate a server that retains users’ workspace data, prompts, conversations, drafts, API keys, or exported files.

Third-party AI providers may retain information according to their own privacy policies and terms.

## 13. Chrome Web Store User Data Policy

Multi-AI Workspace’s use and transfer of information complies with the Chrome Web Store User Data Policy, including the Limited Use requirements.

Information is used only to provide or improve the extension’s disclosed single purpose and user-facing features.

The extension does not use or transfer user data for personalized advertising, behavioral advertising, user profiling, credit assessment, or lending purposes.

The extension does not allow humans to read user data except where required by applicable law, necessary for security purposes, or explicitly requested and authorized by the user for support concerning specific information.

## 14. Children’s Privacy

Multi-AI Workspace is not designed to knowingly collect personal information from children.

The extension does not operate an account-registration service and does not require users to provide their age.

## 15. Changes to This Privacy Policy

This Privacy Policy may be updated when the extension’s functionality, permissions, or data practices change.

The latest version and its effective date will be published on this page.

Material changes to data practices will also be disclosed through the extension or its Chrome Web Store listing when required.

## 16. Independent Product Notice

Multi-AI Workspace is an independent browser extension.

It is not affiliated with, authorized by, endorsed by, or officially connected to any supported AI platform provider.

## 17. Contact

For questions concerning this Privacy Policy or Multi-AI Workspace’s data practices, contact:

Email: chenyutian423@gmail.com

Project website: https://github.com/yutok0423gh/Multi-AI-Workspace
