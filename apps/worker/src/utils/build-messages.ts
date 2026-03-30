import type { Message } from '@line-crm/line-sdk';
import { extractFlexAltText } from './flex-alt-text.js';

/**
 * Build a single LINE Message from type + content.
 * Handles: text, image, image_link (→ Flex), flex, video
 */
export function buildSingleMessage(
  type: string,
  content: string,
  altText?: string,
): Message {
  if (type === 'text') {
    return { type: 'text', text: content };
  }

  if (type === 'image') {
    try {
      const parsed = JSON.parse(content) as {
        originalContentUrl: string;
        previewImageUrl: string;
      };
      return {
        type: 'image',
        originalContentUrl: parsed.originalContentUrl,
        previewImageUrl: parsed.previewImageUrl,
      };
    } catch {
      return { type: 'text', text: content };
    }
  }

  // image_link → Flex message with tappable image
  if (type === 'image_link') {
    try {
      const parsed = JSON.parse(content) as {
        originalContentUrl: string;
        previewImageUrl: string;
        linkUrl: string;
      };
      return {
        type: 'flex',
        altText: altText || '画像メッセージ',
        contents: {
          type: 'bubble',
          body: {
            type: 'box',
            layout: 'vertical',
            paddingAll: '0px',
            contents: [
              {
                type: 'image',
                url: parsed.originalContentUrl,
                size: 'full',
                aspectRatio: '20:13',
                aspectMode: 'cover',
                action: { type: 'uri', uri: parsed.linkUrl },
              },
            ],
          },
        },
      };
    } catch {
      return { type: 'text', text: content };
    }
  }

  if (type === 'flex') {
    try {
      const contents = JSON.parse(content);
      cleanEmptyNodes(contents);
      return {
        type: 'flex',
        altText: altText || extractFlexAltText(contents),
        contents,
      };
    } catch {
      return { type: 'text', text: content };
    }
  }

  if (type === 'video') {
    try {
      const parsed = JSON.parse(content) as {
        originalContentUrl: string;
        previewImageUrl: string;
      };
      return {
        type: 'video',
        originalContentUrl: parsed.originalContentUrl,
        previewImageUrl: parsed.previewImageUrl,
      };
    } catch {
      return { type: 'text', text: content };
    }
  }

  // Fallback
  return { type: 'text', text: content };
}

/** Remove empty text nodes from Flex JSON (caused by conditional blocks like {{#if_ref}}) */
function cleanEmptyNodes(obj: unknown): void {
  if (!obj || typeof obj !== 'object') return;
  const node = obj as Record<string, unknown>;
  for (const key of ['header', 'body', 'footer']) {
    if (node[key]) cleanEmptyNodes(node[key]);
  }
  if (Array.isArray(node.contents)) {
    node.contents = (node.contents as unknown[]).filter((c) => {
      if (c && typeof c === 'object' && (c as Record<string, unknown>).type === 'text') {
        const text = (c as Record<string, unknown>).text;
        return typeof text === 'string' && text.trim().length > 0;
      }
      return true;
    });
    for (const c of node.contents as unknown[]) cleanEmptyNodes(c);
  }
}

/**
 * Build LINE Message array from messageType + messageContent.
 * Supports legacy single messages and new 'multi' type (up to 5).
 */
export function buildMessages(
  messageType: string,
  messageContent: string,
  altText?: string,
): Message[] {
  if (messageType === 'multi') {
    try {
      const items = JSON.parse(messageContent) as {
        type: string;
        content: string;
      }[];
      return items
        .slice(0, 5) // LINE API max 5 messages
        .map((item) => buildSingleMessage(item.type, item.content, altText));
    } catch {
      return [{ type: 'text', text: messageContent }];
    }
  }

  return [buildSingleMessage(messageType, messageContent, altText)];
}
