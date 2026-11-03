/** Markdown-rendered user text as one message-level inline node. */
import { memo, useMemo } from 'react'
import { MarkdownText, UserTextRun } from '@deepseek-ai/dsh-client-ui-primitives'
import type { MarkdownLabels } from '@deepseek-ai/dsh-client-ui-primitives'
import type { MarkdownUserTextProps } from '../contract/slots.ts'

/**
 * Render a user message's Markdown source with the Chat chrome labels.
 * The reference rules never reach this renderer: a message carrying a
 * reference stays on its chips, because a chip and a Markdown parse claim the
 * same source. A user-text factory mounted outside a Chat view supplies no
 * labels, so the source shows verbatim instead of code chrome without copy.
 * @param props - The Markdown node and the Chat locale seat.
 * @returns a settled Markdown document, or the source verbatim.
 */
export const MarkdownUserText = memo(function MarkdownUserText({ node, t }: MarkdownUserTextProps) {
  const labels = useMemo<MarkdownLabels | undefined>(() => t === undefined ? undefined : {
    code: {
      copyLabel: t('copy'), copiedLabel: t('copied'),
      toolbarLabels: { codeLabel: t('codeBlock.title'), wrapLabel: t('codeBlock.wrap'), unwrapLabel: t('codeBlock.unwrap') },
    },
    footnotes: t('markdown.footnotes'),
  }, [t])
  return labels === undefined
    ? <UserTextRun text={node.data.source} />
    : <MarkdownText text={node.data.source} labels={labels} />
})
