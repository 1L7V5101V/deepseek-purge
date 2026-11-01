// @vitest-environment jsdom
/**
 * Pins the transcript's selection→Markdown projection: the DOM shapes the chat
 * renderer actually emits (KaTeX's two arms, fenced code with its toolbar,
 * GFM tables and lists) plus the chrome every copy must drop.
 */
import { describe, expect, it } from 'vitest'
import { nodeToMarkdown, selectionToMarkdown } from '../src/markdown/selection.ts'

function markdown(html: string): string {
  const root = document.createElement('div')
  root.innerHTML = html
  return nodeToMarkdown(root)
}

const INLINE_MATH = '<span class="katex">'
  + '<span class="katex-mathml"><math><semantics><annotation encoding="application/x-tex">'
  + '\\Delta n=(G/C_A)^{1/3}'
  + '</annotation></semantics></math></span>'
  + '<span class="katex-html" aria-hidden="true">Δn=(G/CA)1/3</span>'
  + '</span>'

const DISPLAY_MATH = '<span class="katex-display">'
  + '<span class="katex">'
  + '<span class="katex-mathml"><math><semantics><annotation encoding="application/x-tex">'
  + 'a^2+b^2=c^2'
  + '</annotation></semantics></math></span>'
  + '<span class="katex-html" aria-hidden="true">a2+b2=c2</span>'
  + '</span>'
  + '</span>'

describe('nodeToMarkdown', () => {
  it('keeps headings and inline emphasis', () => {
    expect(markdown('<h2>标题</h2><p>这是 <strong>加粗</strong>、<em>斜体</em> 与 <code>npm run build</code>。</p>'))
      .toBe('## 标题\n\n这是 **加粗**、*斜体* 与 `npm run build`。')
  })

  it('restores inline TeX from the KaTeX annotation, not its glyphs', () => {
    expect(markdown(`<p>公式 ${INLINE_MATH}。</p>`))
      .toBe('公式 $\\Delta n=(G/C_A)^{1/3}$。')
  })

  it('restores display TeX as a block', () => {
    expect(markdown(`<p>推得</p>${DISPLAY_MATH}<p>其中 c 为常数。</p>`))
      .toBe('推得\n\n$$\na^2+b^2=c^2\n$$\n\n其中 c 为常数。')
  })

  it('fences code in its recorded language and drops the toolbar', () => {
    expect(markdown(
      '<div class="md-code-block" data-code-lang="ts">'
      + '<div data-copy-ignore>复制</div>'
      + '<div data-code-block-content><pre class="shiki"><code><span class="line">const a = 1</span></code></pre></div>'
      + '</div>',
    )).toBe('```ts\nconst a = 1\n```')
  })

  it('keeps list nesting and ordered offsets', () => {
    expect(markdown('<ul><li>一</li><li>二<ul><li>二点一</li></ul></li></ul>'))
      .toBe('- 一\n- 二\n  - 二点一')
    expect(markdown('<ol start="3"><li>三</li><li>四</li></ol>')).toBe('3. 三\n4. 四')
  })

  it('rebuilds a GFM table', () => {
    expect(markdown(
      '<table><thead><tr><th>列 a</th><th>列 b</th></tr></thead>'
      + '<tbody><tr><td>1</td><td>2</td></tr></tbody></table>',
    )).toBe('| 列 a | 列 b |\n| --- | --- |\n| 1 | 2 |')
  })

  it('quotes every line of a blockquote', () => {
    expect(markdown('<blockquote><p>引用</p><p>第二段</p></blockquote>'))
      .toBe('> 引用\n>\n> 第二段')
  })

  it('drops message chrome, buttons, and icon rows', () => {
    expect(markdown(
      '<div data-copy-ignore>14:24</div><button type="button">复制</button><p>正文</p>',
    )).toBe('正文')
  })

  it('returns nothing for a selection that carries only chrome', () => {
    expect(markdown('<div data-copy-ignore>14:24</div>')).toBe('')
  })
})

describe('selectionToMarkdown', () => {
  it('projects a whole message selection', () => {
    const root = document.createElement('div')
    root.innerHTML = `<p>结论 ${INLINE_MATH}</p>`
    document.body.append(root)
    const range = document.createRange()
    range.selectNodeContents(root)
    expect(selectionToMarkdown(range)).toBe('结论 $\\Delta n=(G/C_A)^{1/3}$')
    root.remove()
  })

  it('keeps inline markup on a partial selection', () => {
    const root = document.createElement('div')
    root.innerHTML = '<p>one <strong>two</strong> three</p>'
    document.body.append(root)
    const paragraph = root.querySelector('p')
    if (paragraph === null) throw new Error('fixture paragraph missing')
    const strongText = paragraph.querySelector('strong')?.firstChild
    const tail = paragraph.childNodes[2]
    if (strongText === null || strongText === undefined || tail === null || tail === undefined) {
      throw new Error('fixture text nodes missing')
    }
    const range = document.createRange()
    range.setStart(strongText, 1)
    range.setEnd(tail, 3)
    expect(selectionToMarkdown(range)).toBe('**wo** th')
    root.remove()
  })
})
