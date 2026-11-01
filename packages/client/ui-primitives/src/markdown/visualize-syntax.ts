/**
 * Recover standalone `visualize{...}` directives and turn them into a custom
 * mdast node, following the same post-parse pattern as `recoverLocalImages`.
 * The directive is authored as its own paragraph so it can sit between prose
 * blocks; only an unambiguous, unescaped text child is rewritten, and the
 * source round-trip check keeps escaped examples literal.
 */

import type { Node, Root, RootContent } from 'mdast'

/** A custom mdast node emitted by {@link recoverVisualize} and rendered by the Markdown renderer. */
export interface Visualize extends Node {
  readonly type: 'visualize'
  /** File path the directive names; the renderer resolves it against the owner's workspace. */
  readonly path: string
  /** Optional full-width mode for desktop-style surfaces. */
  readonly mode?: 'wide' | undefined
}

declare module 'mdast' {
  interface RootContentMap {
    visualize: Visualize
  }
  interface BlockContentMap {
    visualize: Visualize
  }
}

/** One directive: `visualize{"path":"<path>"}` with an optional `"mode":"wide"`. */
const DIRECTIVE = /^visualize\{"path":"((?:\/(?!\/)|\.{1,2}\/|[a-z]:[\\/])[^"\n]+)"(?:,"mode":"(wide)")?\}$/iu

/**
 * Recover only unambiguous, unescaped paragraphs containing exactly one
 * `visualize{...}` directive. The whole paragraph is replaced in place by the
 * block-level node so it renders as an inline visualization instead of text.
 * @param root - Parsed Markdown tree, modified in place.
 * @param source - Original source, to distinguish authored syntax from escapes.
 * @returns The same root with recovered visualize nodes.
 */
export function recoverVisualize(root: Root, source: string): Root {
  const visit = (node: Root | RootContent): void => {
    if ('children' in node) {
      const children = node.children as RootContent[]
      for (let index = 0; index < children.length; index += 1) {
        const child = children[index]
        if (child === undefined) continue
        if (child.type === 'paragraph' && child.children.length === 1) {
          const [only] = child.children
          if (only !== undefined && only.type === 'text' && only.position !== undefined
            && source.slice(only.position.start.offset, only.position.end.offset) === only.value) {
            const match = DIRECTIVE.exec(only.value)
            if (match !== null) {
              const path = match[1] ?? ''
              const mode = match[2] as 'wide' | undefined
              children[index] = mode === 'wide'
                ? { type: 'visualize', path, mode: 'wide', position: child.position }
                : { type: 'visualize', path, position: child.position }
              continue
            }
          }
        }
        visit(child)
      }
    }
  }
  visit(root)
  return root
}
