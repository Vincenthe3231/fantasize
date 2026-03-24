import type { Editor } from '@tiptap/core';

export function getRichTextBlockLabel(editor: Editor): string {
  if (editor.isActive('heading', { level: 1 })) return 'Heading 1';
  if (editor.isActive('heading', { level: 2 })) return 'Heading 2';
  if (editor.isActive('heading', { level: 3 })) return 'Heading 3';
  if (editor.isActive('bulletList')) return 'Bullet list';
  if (editor.isActive('orderedList')) return 'Numbered list';
  if (editor.isActive('blockquote')) return 'Quote';
  if (editor.isActive('codeBlock')) return 'Code block';
  return 'Paragraph';
}
