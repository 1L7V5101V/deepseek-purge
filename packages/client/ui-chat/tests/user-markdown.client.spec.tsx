// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { cleanup, render } from '@testing-library/react'
import { MarkdownUserText } from '../src/client/chat/UserMarkdown.tsx'
import { markdownLabels } from '../src/client/markdown-labels.ts'

afterEach(cleanup)

type MarkdownProps = Parameters<typeof MarkdownUserText>[0]
type Translate = MarkdownProps['t']

/** The unit reads only the node and the Chat seat; framework seats stay unmodeled here. */
function view(text: string, withChatSeat = true): ReturnType<typeof render> {
  const props = {
    node: { id: 'markdown', start: 0, end: text.length, data: { source: text } },
    raw: text,
    interactive: false,
    t: (key => key) satisfies Translate,
  } satisfies Partial<MarkdownProps>
  return render(createElement(MarkdownUserText, { ...props, t: withChatSeat ? props.t : undefined } as MarkdownProps))
}

describe('Markdown user text', () => {
  it('renders the message as settled Markdown blocks', () => {
    const { container } = view('**结论**\n\n- 一\n- 二')
    expect(container.querySelector('strong')?.textContent).toBe('结论')
    expect([...container.querySelectorAll('li')].map(li => li.textContent)).toEqual(['一', '二'])
  })

  it('keeps single-tilde ranges literal in a user message', () => {
    const text = '峰值在 0.5~1 与 800~1100 nC/m 之间'
    const { container } = view(text)
    expect(container.querySelector('del')).toBeNull()
    expect(container.textContent).toBe(text)
  })

  it('shows the source verbatim when no Chat labels are supplied', () => {
    const text = '**not parsed**'
    const { container } = view(text, false)
    expect(container.textContent).toBe(text)
    expect(container.querySelector('strong')).toBeNull()
  })

  it('builds the code labels from the Chat dictionary', () => {
    expect(markdownLabels(key => `[${key}]`)).toMatchObject({
      code: { copyLabel: '[copy]', copiedLabel: '[copied]' },
      footnotes: '[markdown.footnotes]',
    })
  })
})
