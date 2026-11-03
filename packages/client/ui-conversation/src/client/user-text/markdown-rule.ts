/** Whole-message Markdown candidates; a message carrying a reference keeps its reference chips instead. */
import type { UserTextRule } from '../contract/user-text.ts'

/**
 * Render the message as Markdown unless it carries an `@` reference candidate.
 * A chipped reference and a Markdown parse claim the same source, so a message
 * with references stays on its plain runs instead of losing the chips.
 */
export const markdownMessageRule: UserTextRule<'markdown'> = {
  id: 'markdown',
  order: 100,
  match(text, from, context) {
    if (!context.read('markdown')) return undefined
    if (from > 0 || text.indexOf('@', from) >= 0) return undefined
    return { id: 'markdown', start: 0, end: text.length, data: { source: text } }
  },
}
