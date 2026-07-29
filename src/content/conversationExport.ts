import type { UserBoundPlatformAdapter } from '../platforms/base/UserBoundPlatformAdapter';
import type { PlatformMessage } from '../shared/types/platform';
import type { ConversationExportFormat } from '../shared/types/settings';

export type { ConversationExportFormat } from '../shared/types/settings';

export interface SerializedConversationExport {
  content: string;
  type: string;
  extension: 'md' | 'json' | 'html';
}

const SIMPLE_REMOVAL_SELECTOR =
  'script, style, noscript, button, [role="button"], [role="toolbar"], [hidden], [aria-hidden="true"]';
const TOOL_CONTENT_HINT =
  /(?:^|[-_\s])(tool(?:-call|-output)?|code-interpreter|python-execution|execution-output|analysis|reasoning)(?:$|[-_\s])/i;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizedExportTitle(title: string): string {
  return title.replace(/[\r\n]+/g, ' ').trim() || 'Conversation';
}

function timestampIso(timestamp: number | null): string | null {
  if (timestamp === null || !Number.isFinite(timestamp)) return null;
  try {
    return new Date(timestamp).toISOString();
  } catch {
    return null;
  }
}

function elementSemanticDescriptor(element: Element): string {
  return [
    element.id,
    element.getAttribute('class'),
    element.getAttribute('data-testid'),
    element.getAttribute('data-content-type'),
    element.getAttribute('data-message-author-role'),
    element.getAttribute('data-message-role'),
    element.getAttribute('data-role'),
    element.getAttribute('aria-label'),
    element.getAttribute('aria-roledescription'),
    element.getAttribute('title'),
  ]
    .filter(Boolean)
    .join(' ')
    .replaceAll('_', '-');
}

function exportElement(message: PlatformMessage, simplified: boolean): HTMLElement {
  const clone = message.element.cloneNode(true) as HTMLElement;
  if (!simplified) return clone;
  for (const removable of clone.querySelectorAll(SIMPLE_REMOVAL_SELECTOR)) removable.remove();
  for (const element of [...clone.querySelectorAll('*')]) {
    if (TOOL_CONTENT_HINT.test(elementSemanticDescriptor(element))) element.remove();
  }
  return clone;
}

function markdownTable(element: HTMLElement): string {
  const rows = [...element.querySelectorAll('tr')]
    .map((row) =>
      [...row.querySelectorAll('th, td')].map((cell) =>
        (cell.textContent ?? '').replace(/\s+/g, ' ').trim().replaceAll('|', '\\|'),
      ),
    )
    .filter((row) => row.length);
  if (!rows.length) return '';
  const width = Math.max(...rows.map((row) => row.length));
  const normalizedRows = rows.map((row) => [
    ...row,
    ...Array.from({ length: width - row.length }, () => ''),
  ]);
  return [
    `| ${normalizedRows[0].join(' | ')} |`,
    `| ${Array.from({ length: width }, () => '---').join(' | ')} |`,
    ...normalizedRows.slice(1).map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

function markdownNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').replace(/\s+/g, ' ');
  if (!(node instanceof HTMLElement)) return '';
  const tag = node.tagName.toLowerCase();
  const children = () => [...node.childNodes].map(markdownNode).join('');

  if (tag === 'br') return '\n';
  if (tag === 'hr') return '\n\n---\n\n';
  if (/^h[1-6]$/.test(tag)) {
    return `\n\n${'#'.repeat(Number(tag.slice(1)))} ${children().trim()}\n\n`;
  }
  if (tag === 'pre') {
    const code = node.querySelector(':scope > code') ?? node;
    const language = [...code.classList]
      .map((className) => /^language-(.+)$/.exec(className)?.[1])
      .find(Boolean);
    const source = (code.textContent ?? '').replace(/\n$/, '');
    const fence = source.includes('```') ? '````' : '```';
    return `\n\n${fence}${language ?? ''}\n${source}\n${fence}\n\n`;
  }
  if (tag === 'code') return `\`${children().trim().replaceAll('`', '\\`')}\``;
  if (tag === 'strong' || tag === 'b') return `**${children().trim()}**`;
  if (tag === 'em' || tag === 'i') return `*${children().trim()}*`;
  if (tag === 's' || tag === 'del') return `~~${children().trim()}~~`;
  if (tag === 'blockquote') {
    return `\n\n${children()
      .trim()
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n')}\n\n`;
  }
  if (tag === 'a') {
    const label = children().trim();
    const href = node.getAttribute('href');
    return href && label ? `[${label}](${href})` : label;
  }
  if (tag === 'img') {
    const source = node.getAttribute('src');
    return source ? `![${node.getAttribute('alt') ?? ''}](${source})` : '';
  }
  if (tag === 'table') return `\n\n${markdownTable(node)}\n\n`;
  if (tag === 'ul' || tag === 'ol') {
    const ordered = tag === 'ol';
    const items = [...node.children].filter((child) => child.tagName.toLowerCase() === 'li');
    return `\n${items
      .map((item, index) => {
        const content = [...item.childNodes].map(markdownNode).join('').trim();
        return `${ordered ? `${index + 1}.` : '-'} ${content.replaceAll('\n', '\n  ')}`;
      })
      .join('\n')}\n`;
  }
  if (['p', 'div', 'section', 'article', 'main', 'header', 'footer', 'figure'].includes(tag)) {
    return `\n\n${children()}\n\n`;
  }
  return children();
}

function normalizeMarkdown(value: string): string {
  return value
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function messageToMarkdown(message: PlatformMessage, simplified: boolean): string {
  const converted = normalizeMarkdown(markdownNode(exportElement(message, simplified)));
  if (converted) return converted;
  return message.plainText.trim();
}

function simplifiedMessages(messages: PlatformMessage[]): PlatformMessage[] {
  return messages.filter((message) => message.role === 'user' || message.role === 'assistant');
}

function roleLabel(role: PlatformMessage['role']): string {
  if (role === 'assistant') return 'Assistant';
  if (role === 'user') return 'User';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function markdownMessage(message: PlatformMessage, simplified: boolean): string[] {
  const timestamp = timestampIso(message.timestamp);
  return [
    `## ${roleLabel(message.role)}${timestamp ? ` · ${timestamp}` : ''}`,
    '',
    messageToMarkdown(message, simplified),
    '',
  ];
}

function standardJsonMessage(message: PlatformMessage) {
  return {
    platform: message.platform,
    conversationId: message.conversationId,
    messageId: message.messageId,
    runtimeMessageId: message.runtimeMessageId,
    role: message.role,
    content: {
      text: message.plainText,
      markdown: messageToMarkdown(message, false),
    },
    timestamp: timestampIso(message.timestamp),
    timestampSource: message.timestampSource,
    order: message.order,
  };
}

function simpleJsonMessage(message: PlatformMessage) {
  return {
    role: message.role,
    content: messageToMarkdown(message, true),
    timestamp: timestampIso(message.timestamp),
  };
}

export function serializeConversation(
  format: ConversationExportFormat,
  titleInput: string,
  url: string,
  messages: PlatformMessage[],
  exportedAt = Date.now(),
): SerializedConversationExport {
  const title = normalizedExportTitle(titleInput);
  const simplified = simplifiedMessages(messages);
  if (format === 'json-standard') {
    return {
      content: `${JSON.stringify(
        {
          title,
          url,
          exportedAt: new Date(exportedAt).toISOString(),
          source: 'visible-page-normalized',
          messages: messages.map(standardJsonMessage),
        },
        null,
        2,
      )}\n`,
      type: 'application/json',
      extension: 'json',
    };
  }
  if (format === 'json-simple') {
    return {
      content: `${JSON.stringify(
        {
          title,
          url,
          exportedAt: new Date(exportedAt).toISOString(),
          messages: simplified.map(simpleJsonMessage),
        },
        null,
        2,
      )}\n`,
      type: 'application/json',
      extension: 'json',
    };
  }
  if (format === 'html-simple') {
    const body = simplified
      .map((message) => {
        const timestamp = timestampIso(message.timestamp);
        return `<article class="message ${message.role}"><header><h2>${escapeHtml(roleLabel(message.role))}</h2>${timestamp ? `<time datetime="${timestamp}">${timestamp}</time>` : ''}</header><pre>${escapeHtml(messageToMarkdown(message, true))}</pre></article>`;
      })
      .join('\n');
    return {
      content: `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title><style>body{max-width:900px;margin:40px auto;padding:0 20px;font:16px/1.6 system-ui;color:#17213d}.message{margin:20px 0;padding:18px;border:1px solid #ddd;border-radius:14px}.user{background:#f4f5ff}.assistant{background:#f7faf8}header{display:flex;align-items:baseline;justify-content:space-between;gap:16px}h2{font-size:12px;text-transform:uppercase}time{color:#667085;font-size:12px}pre{white-space:pre-wrap;font:inherit}</style><h1>${escapeHtml(title)}</h1><p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>${body}</html>`,
      type: 'text/html',
      extension: 'html',
    };
  }

  const selectedMessages = format === 'markdown-simple' ? simplified : messages;
  const content = [
    `# ${title}`,
    '',
    `Source: ${url}`,
    '',
    ...selectedMessages.flatMap((message) =>
      markdownMessage(message, format === 'markdown-simple'),
    ),
  ].join('\n');
  return { content, type: 'text/markdown', extension: 'md' };
}

export async function exportConversation(
  adapter: UserBoundPlatformAdapter,
  format: ConversationExportFormat,
): Promise<void> {
  const messages = await adapter.getMessages();
  await exportConversationMessages(adapter, format, messages);
}

export async function exportConversationMessages(
  adapter: UserBoundPlatformAdapter,
  format: ConversationExportFormat,
  messages: PlatformMessage[],
  filenameSuffix = '',
): Promise<void> {
  const conversation = await adapter.getCurrentConversation();
  const title = conversation.title || `${adapter.id}-conversation`;
  const serialized = serializeConversation(format, title, conversation.url, messages);
  const url = URL.createObjectURL(new Blob([serialized.content], { type: serialized.type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  const safeTitle = title.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80);
  anchor.download = `${safeTitle}${filenameSuffix ? `-${filenameSuffix}` : ''}.${serialized.extension}`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
