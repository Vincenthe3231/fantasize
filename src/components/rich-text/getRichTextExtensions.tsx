import type { Node as FlowNode } from 'reactflow';
import type { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Mention from '@tiptap/extension-mention';
import { ReactRenderer } from '@tiptap/react';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import MentionList, { type MentionListHandle } from './MentionList';
import { collectMentionCandidates, type MentionItem } from './nodeMentionUtils';
import type { SuggestionProps } from '@tiptap/suggestion';

export type RichTextExtensionOptions = {
  placeholder?: string;
  /** When false, omit @-mention extension (smaller bundle / comments). */
  enableMentions?: boolean;
  /** Current graph nodes for @ list; called on each query. */
  getWorkflowNodes?: () => FlowNode[];
  /** Hide this node id from @ list (e.g. self). */
  excludeNodeId?: string;
};

function mentionSuggestionRender(getWorkflowNodes: () => FlowNode[], excludeId?: string) {
  return () => {
    let component: ReactRenderer<MentionListHandle> | null = null;
    let popup: TippyInstance | null = null;

    return {
      onStart: (props: SuggestionProps<MentionItem>) => {
        component = new ReactRenderer(MentionList, {
          props: {
            items: props.items as MentionItem[],
            command: props.command,
          },
          editor: props.editor,
        });

        if (!props.clientRect) {
          return;
        }

        popup = tippy(document.body, {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
          zIndex: 10000,
        });
      },

      onUpdate(props: SuggestionProps<MentionItem>) {
        component?.updateProps({
          items: props.items as MentionItem[],
          command: props.command,
        });

        if (!props.clientRect) {
          return;
        }

        popup?.setProps({
          getReferenceClientRect: props.clientRect,
        });
      },

      onKeyDown(props: { event: KeyboardEvent }) {
        if (props.event.key === 'Escape') {
          popup?.hide();
          return true;
        }
        return component?.ref?.onKeyDown?.(props) ?? false;
      },

      onExit() {
        popup?.destroy();
        popup = null;
        component?.destroy();
        component = null;
      },
    };
  };
}

export function getRichTextExtensions(options: RichTextExtensionOptions = {}): Extension[] {
  const {
    placeholder = 'Write…',
    enableMentions = true,
    getWorkflowNodes = () => [],
    excludeNodeId,
  } = options;

  const extensions: Extension[] = [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
    Underline,
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      HTMLAttributes: {
        class: 'text-[var(--accent-color)] underline underline-offset-2',
      },
    }),
    TextStyle,
    Color.configure({ types: ['textStyle'] }),
    Placeholder.configure({ placeholder }),
  ];

  if (enableMentions) {
    extensions.push(
      Mention.configure({
        HTMLAttributes: {
          class: 'vf-mention',
        },
        renderText({ node }) {
          return `@${node.attrs.label ?? node.attrs.id}`
        },
        renderHTML({ node }) {
          return [
            'span',
            {
              'data-type': 'mention',
              'data-id': node.attrs.id,
              'data-label': node.attrs.label ?? '',
              class: 'vf-mention',
            },
            `@${node.attrs.label ?? node.attrs.id}`,
          ]
        },
        suggestion: {
          char: '@',
          items: ({ query }) => collectMentionCandidates(getWorkflowNodes(), query, excludeNodeId),
          render: mentionSuggestionRender(getWorkflowNodes, excludeNodeId),
        },
      })
    );
  }

  return extensions;
}
