/**
 * Inline visualization frame for a recovered `visualize{...}` directive.
 * Reads the referenced HTML through the owner's `readVisualizeHtml` delegate,
 * mounts it in an opaque sandboxed iframe (scripts allowed, no same-origin),
 * and falls back to inert text while loading or on failure.
 */

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useMarkdownDelegate } from './MarkdownDelegate.tsx'
import css from './VisualizeFrame.module.css'

/** Inline frame for one visualization directive. */
export function VisualizeFrame({ path, mode }: { path: string; mode?: 'wide' | undefined }): ReactNode {
  const { readVisualizeHtml } = useMarkdownDelegate()
  const [url, setUrl] = useState<string>()

  // Mounting here means the directive was fully parsed (recoverVisualize only
  // rewrites a complete marker), so load immediately — including mid-stream —
  // so the figure appears inline with the prose instead of waiting for the
  // whole message to settle.
  useEffect(() => {
    if (readVisualizeHtml === undefined) return
    const controller = new AbortController()
    let objectUrl: string | undefined
    void (async () => {
      try {
        const html = await readVisualizeHtml(path, controller.signal)
        controller.signal.throwIfAborted()
        objectUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
        setUrl(objectUrl)
      } catch {
        if (!controller.signal.aborted) setUrl(undefined)
      }
    })()
    return () => {
      controller.abort()
      if (objectUrl !== undefined) URL.revokeObjectURL(objectUrl)
    }
  }, [readVisualizeHtml, path])

  const wide = mode === 'wide'
  if (url !== undefined) {
    return (
      <div className={wide ? css.wide : css.root}>
        <iframe
          key={url}
          className={css.frame}
          src={url}
          sandbox="allow-scripts"
          title={path}
          data-visualize={wide ? 'wide' : undefined}
        />
      </div>
    )
  }
  return <div className={css.root} role="status">{path}</div>
}
