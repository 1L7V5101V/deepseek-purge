/** A transcript message projects as one Markdown block unless a reference chip claims part of it. */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, onTestFinished } from 'vitest'
import type { UserTextFacts, UserTextNode } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { UserTextRegistry } from '../src/client/conversation/user-text-registry.ts'
import { markdownMessageRule } from '../src/client/user-text/markdown-rule.ts'
import { sessionReferenceRule } from '../src/client/user-text/session-reference-rule.ts'
import { collapseWhitespaceRule, trimWhitespaceRule } from '../src/client/user-text/whitespace-rules.ts'

function setup() {
  const ctx = new Context()
  onTestFinished(() => ctx.fiber.dispose())
  const registry = new UserTextRegistry(ctx)
  for (const rule of [sessionReferenceRule, markdownMessageRule, collapseWhitespaceRule, trimWhitespaceRule]) {
    registry.register(rule)
  }
  return registry.createEvaluator()
}

const ids = (nodes: readonly UserTextNode[]): string[] => nodes.map(node => node.id)

describe('Markdown user-text projection', () => {
  it('covers the whole message as one Markdown node when the message is enabled', () => {
    const evaluate = setup()
    const text = '# 标题\n\n- 一\n- 二\n\n```ts\nconst answer = 42\n```'
    expect(evaluate({ text, facts: { markdown: true } })).toEqual([
      { id: 'markdown', start: 0, end: text.length, data: { source: text } },
    ])
  })

  it('keeps the plain projection while the message is not enabled', () => {
    const evaluate = setup()
    const text = '**注意：**内容'
    expect(ids(evaluate({ text, facts: {} }))).toEqual(['text'])
    expect(evaluate({ text, facts: {} })[0]?.data).toEqual({ text })
  })

  it.each([
    ['a leading mention', '@会话一 的 **结论**', '会话一'],
    ['a file mention after Markdown', '**结论** 见 @src/deep/file.txt', 'src'],
    ['a wire session mention', '看看 @[查看](dsh-session:abc) 的结果', '会话一'],
  ])('leaves a message with %s on its reference chips', (_, text, label) => {
    const evaluate = setup()
    const nodes = evaluate({ text, facts: { markdown: true, sessionLabels: [label] } })
    expect(ids(nodes)).not.toContain('markdown')
    expect(ids(nodes)).toContain('session')
  })

  it('does not turn a bare @ in prose into a Markdown projection miss', () => {
    const evaluate = setup()
    const mention = '问一下 @不在列表里 的人'
    expect(ids(evaluate({ text: mention, facts: { markdown: true } }))).toEqual(['text'])
    expect(evaluate({ text: mention, facts: { markdown: true } })[0]?.data).toEqual({ text: mention })
  })

  it('does not open a Markdown block at offset zero only, so a re-query from the tail finds nothing', () => {
    const facts: Partial<UserTextFacts> = { markdown: true }
    const read = <K extends keyof UserTextFacts>(key: K) => facts[key]
    expect(markdownMessageRule.match('plain', 0, { read })).toEqual({
      id: 'markdown', start: 0, end: 5, data: { source: 'plain' },
    })
    expect(markdownMessageRule.match('plain', 2, { read })).toBeUndefined()
    expect(markdownMessageRule.match('plain', 0, { read: () => undefined })).toBeUndefined()
  })
})
