/**
 * DOM-selection → Markdown projection for the transcript's native copy path.
 *
 * A browser copies a rendered selection as plain text: KaTeX's two DOM arms
 * leak the visual glyphs (and sometimes the hidden MathML), headings, lists,
 * and tables lose their structure, and a fenced block collapses to lines.
 * This projection walks the cloned selection instead and rebuilds the
 * Markdown the renderer was given: KaTeX math comes back as `$…$` / `$$…$$`
 * from its TeX annotation, fenced code from the code block's source text, and
 * everything else from the semantic elements the renderer emits. Chrome that
 * is not message content (icon rows, code-block toolbars, buttons) is marked
 * `data-copy-ignore` and never reaches the clipboard.
 */

/** Elements whose subtree never belongs to copied prose. */
const SKIPPED_TAGS = new Set([
  'AUDIO', 'BUTTON', 'CANVAS', 'IFRAME', 'INPUT', 'NOSCRIPT', 'SCRIPT',
  'SELECT', 'STYLE', 'SVG', 'TEMPLATE', 'TEXTAREA', 'VIDEO',
])

/** Elements that only group block children and draw nothing themselves. */
const TRANSPARENT_TAGS = new Set([
  'ARTICLE', 'ASIDE', 'DETAILS', 'DIV', 'FOOTER', 'HEADER', 'LI', 'MAIN', 'NAV', 'SECTION', 'SUMMARY',
])

/** Heading elements, mapped to `#` runs by tag depth. */
const HEADING_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6'])

/** Selector that identifies a block-level child inside a grouping element. */
const BLOCK_SELECTOR = 'address,article,aside,blockquote,details,div,fieldset,figcaption,figure,footer,form,'
  + 'h1,h2,h3,h4,h5,h6,header,hr,li,main,nav,ol,p,pre,section,table,ul'

/** Collapse one text node's whitespace into a single line of inline prose. */
function collapseText(value: string): string {
  return value.replace(/\s+/g, ' ')
}

/** Whether an element is non-content chrome or otherwise outside the message. */
function isSkipped(element: Element): boolean {
  return SKIPPED_TAGS.has(element.tagName)
    || element.hasAttribute('data-copy-ignore')
    || element.getAttribute('aria-hidden') === 'true'
}

/** Read the authored TeX source out of one KaTeX tree, when it kept one. */
function texSource(element: Element): string | undefined {
  const annotation = element.querySelector('annotation[encoding="application/x-tex"]')
  if (annotation === null) return undefined
  const value = annotation.textContent
  return value === null || value.trim() === '' ? undefined : value
}

/** Whether a destination survives a paste as a usable URL. */
function isExternalHref(href: string): boolean {
  return /^(?:https?:|mailto:)/i.test(href)
}

/** Wrap inline code, growing the backtick fence past any run it contains. */
function codeSpan(value: string): string {
  const text = value.replace(/\r?\n|\r/g, ' ')
  const runs = text.match(/`+/g) ?? []
  const fence = '`'.repeat(Math.max(1, ...runs.map(run => run.length + 1)))
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : ''
  return `${fence}${pad}${text}${pad}${fence}`
}

/** Render one anchor, keeping the label when its destination is not pasteable. */
function linkOf(anchor: Element): string {
  const href = anchor.getAttribute('href') ?? ''
  const label = inlineChildren(anchor).trim()
  if (!isExternalHref(href)) return label
  return `[${label === '' ? href : label}](${href})`
}

/** Render one image, keeping alt text when the source is not pasteable. */
function imageOf(image: Element): string {
  const alt = image.getAttribute('alt') ?? ''
  const source = image.getAttribute('src') ?? ''
  if (!/^(?:https?:|data:)/i.test(source)) return alt
  return `![${alt}](${source})`
}

/** Convert every child of an element as inline content. */
function inlineChildren(element: Element): string {
  let out = ''
  for (const child of element.childNodes) out += inlineOf(child)
  return out
}

/** Convert one node as inline content (no block separators). */
function inlineOf(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return collapseText(node.nodeValue ?? '')
  if (node.nodeType !== Node.ELEMENT_NODE) return ''
  const element = node as Element
  if (isSkipped(element)) return ''
  if (element.classList.contains('katex')) {
    const tex = texSource(element)
    return tex === undefined ? '' : `$${tex}$`
  }
  switch (element.tagName) {
    case 'BR':
      return '  \n'
    case 'STRONG':
    case 'B':
      return `**${inlineChildren(element)}**`
    case 'EM':
    case 'I':
      return `*${inlineChildren(element)}*`
    case 'DEL':
    case 'S':
    case 'STRIKE':
      return `~~${inlineChildren(element)}~~`
    case 'CODE':
      // The button text of a file-mention chip lives inside the code element,
      // so the source text is the label; recursion would drop it.
      return codeSpan(element.textContent ?? '')
    case 'A':
      return linkOf(element)
    case 'IMG':
      return imageOf(element)
    default:
      return inlineChildren(element)
  }
}

/** Whether an element draws at least one block-level child. */
function hasBlockChild(element: Element): boolean {
  for (const child of element.children) if (child.matches(BLOCK_SELECTOR)) return true
  return false
}

/** Convert every child of a grouping element as blocks. */
function childBlocks(element: Element): string[] {
  const blocks: string[] = []
  for (const child of element.childNodes) blocks.push(...blocksOf(child))
  return blocks
}

/** Render one code block as a fenced block in its recorded language. */
function fenceOf(element: Element): string {
  const pre = element.querySelector('pre') ?? element
  const code = (pre.textContent ?? '').replace(/\n$/, '')
  const lang = element.getAttribute('data-code-lang') ?? ''
  const runs = code.match(/`+/g) ?? []
  const fence = '`'.repeat(Math.max(3, ...runs.map(run => run.length + 1)))
  return `${fence}${lang}\n${code}\n${fence}`
}

/** Render one list, including nested lists and task markers. */
function listOf(list: Element): string {
  const ordered = list.tagName === 'OL'
  const declared = Number.parseInt(list.getAttribute('start') ?? '', 10)
  const start = Number.isFinite(declared) ? declared : 1
  const lines: string[] = []
  let index = 0
  for (const item of list.children) {
    if (item.tagName !== 'LI') continue
    const marker = ordered ? `${start + index}. ` : '- '
    const indent = ' '.repeat(marker.length)
    const blocks = blocksOf(item)
    const head = blocks.shift() ?? ''
    const [first = '', ...rest] = head.split('\n')
    lines.push(`${marker}${taskMarker(item)}${first}`)
    for (const line of rest) lines.push(`${indent}${line}`)
    for (const block of blocks) {
      // A nested list continues the item; prose and fences keep a blank line
      // so the item stays a valid loose list.
      if (!/^(?:[-*+]|\d+\.)\s/.test(block)) lines.push('')
      for (const line of block.split('\n')) lines.push(`${indent}${line}`)
    }
    index += 1
  }
  return lines.join('\n')
}

/** Read a task-list item's checkbox state, when the item has one. */
function taskMarker(item: Element): string {
  const box = item.querySelector('input[type="checkbox"]')
  if (box === null) return ''
  return (box as HTMLInputElement).checked ? '[x] ' : '[ ] '
}

/** Render one blockquote by prefixing every line. */
function quoteOf(element: Element): string {
  return childBlocks(element)
    .join('\n\n')
    .split('\n')
    .map(line => line.trim() === '' ? '>' : `> ${line}`)
    .join('\n')
}

/** Render one table as a GFM table, first row as the header. */
function tableOf(table: Element): string {
  const rows: string[][] = []
  for (const row of table.querySelectorAll('tr')) {
    const cells = [...row.children]
      .filter(cell => cell.tagName === 'TH' || cell.tagName === 'TD')
      .map(cell => inlineChildren(cell).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim())
    if (cells.length > 0) rows.push(cells)
  }
  const head = rows[0]
  if (head === undefined) return ''
  const width = head.length
  const normalize = (row: string[]): string[] => [
    ...row.slice(0, width), ...Array<string>(Math.max(0, width - row.length)).fill(''),
  ]
  const lines = [
    `| ${normalize(head).join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
  ]
  for (const row of rows.slice(1)) lines.push(`| ${normalize(row).join(' | ')} |`)
  return lines.join('\n')
}

/** Convert one node into the ordered block strings it contributes. */
function blocksOf(node: Node): string[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = collapseText(node.nodeValue ?? '').trim()
    return text === '' ? [] : [text]
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return []
  const element = node as Element
  if (isSkipped(element)) return []
  if (element.matches('.md-code-block')) return [fenceOf(element)]
  if (element.classList.contains('katex-display')) {
    const tex = texSource(element.querySelector('.katex') ?? element)
    return tex === undefined ? [] : ['$$' + tex + '$$']
  }
  if (element.classList.contains('katex')) {
    const tex = texSource(element)
    return tex === undefined ? [] : ['$$' + tex + '$$']
  }
  if (HEADING_TAGS.has(element.tagName)) {
    const text = inlineChildren(element).trim()
    if (text === '') return []
    return [`${'#'.repeat(Number(element.tagName.slice(1)))} ${text}`]
  }
  switch (element.tagName) {
    case 'P': {
      const text = inlineChildren(element).trim()
      return text === '' ? [] : [text]
    }
    case 'UL':
    case 'OL':
      return [listOf(element)]
    case 'BLOCKQUOTE':
      return [quoteOf(element)]
    case 'PRE':
      return [fenceOf(element)]
    case 'TABLE':
      return [tableOf(element)]
    case 'HR':
      return ['---']
    case 'BR':
      return []
    default:
      break
  }
  if (TRANSPARENT_TAGS.has(element.tagName) || hasBlockChild(element)) {
    return hasBlockChild(element) ? childBlocks(element) : [inlineChildren(element).trim()].filter(Boolean)
  }
  const text = inlineChildren(element).trim()
  return text === '' ? [] : [text]
}

/**
 * Project one DOM subtree onto Markdown.
 * @param node - Root of the subtree, typically a holder around a cloned selection.
 * @returns Markdown with blank-line block separation; empty when nothing remains.
 */
export function nodeToMarkdown(node: Node): string {
  return blocksOf(node).filter(block => block.trim() !== '').join('\n\n').trim()
}

/**
 * Project the current document selection onto Markdown.
 * @param range - The selection range to convert.
 * @returns The Markdown projection, or an empty string when it carries no text.
 */
export function selectionToMarkdown(range: Range): string {
  const holder = document.createElement('div')
  holder.append(range.cloneContents())
  return nodeToMarkdown(holder)
}
