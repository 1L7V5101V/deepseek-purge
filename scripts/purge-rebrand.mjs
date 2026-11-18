#!/usr/bin/env node
/**
 * Re-apply the DeepSeek Purge rebrand on top of a freshly pulled upstream tree.
 *
 * Every edit is a plain string replacement, so this script is idempotent: run it
 * after `git fetch upstream && git rebase upstream/master` and it restores the
 * fork's branding without a merge conflict. Binary icon assets are regenerated
 * by `node scripts/purge-rebrand.mjs --icons` (needs the bundled Python + Pillow).
 *
 * Usage:
 *   node scripts/purge-rebrand.mjs          # text only
 *   node scripts/purge-rebrand.mjs --icons  # text + regenerate icon-windows.png / tray-windows.ico
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OLD = 'DeepSeek Harness'
const NEW = 'DeepSeek Purge'

/** Files whose every `DeepSeek Harness` occurrence becomes `DeepSeek Purge`. */
const PLAIN = [
  'apps/cli/src/args.ts',
  'apps/cli/src/plugin.ts',
  'apps/desktop/cli/dsh',
  'apps/desktop/cli/dsh.cmd',
  'apps/desktop/src/locale.ts',
  'apps/desktop/src/main.ts',
  'apps/desktop/scripts/development-app.ts',
  'apps/desktop/scripts/electron-builder-config.mjs',
  'apps/desktop/scripts/package-macos.ts',
  'apps/desktop/scripts/package-target.ts',
  'apps/desktop/scripts/smoke-packaged-runtime.ts',
  'apps/desktop/scripts/verify-retained-desktop.ts',
]

/** Extra, file-scoped rewrites that are not the product name itself. */
const SCOPED = [
  ['apps/desktop/scripts/electron-builder-config.mjs', 'deepseek-harness-${version}', 'deepseek-purge-${version}'],
  ['apps/desktop/.env.windows', 'com.deepseek.harness', 'com.deepseek.purge'],
  ['apps/web/vite.config.ts', 'DSH Local Build', NEW],
  ['apps/web/index.html', 'DSH Local Build', NEW],
]

const stats = { files: 0, hits: 0 }

/**
 * Fork-only edits that are code, not renames, so a rebase can drop them without any conflict.
 * The script cannot re-apply these safely; it only reports them so the loss is never silent.
 */
const FORK_MARKERS = [
  ['apps/desktop/src/paths.ts', "PURGE_HOME_DIR_NAME = '.dsh-purge'"],
  ['apps/desktop/src/main.ts', "app.setPath('userData', resolveDesktopUserData())"],
  ['apps/desktop/src/main.ts', 'resolveDesktopUserData } from'],
  ['apps/desktop/cli/dsh.cmd', 'if not defined DSH_HOME'],
  ['apps/desktop/cli/dsh', 'DSH_HOME:=$HOME/.dsh-purge'],
]

/** Rewrite one file, preserving its existing bytes and line endings. */
function rewrite(relative, pairs) {
  const absolute = join(ROOT, relative)
  if (!existsSync(absolute)) return
  const before = readFileSync(absolute, 'utf8')
  let after = before
  for (const [from, to] of pairs) after = after.split(from).join(to)
  if (after === before) return
  writeFileSync(absolute, after)
  stats.files += 1
  stats.hits += pairs.reduce((n, [from]) => n + before.split(from).length - 1, 0)
  console.log(`  ~ ${relative}`)
}

console.log('rebrand: text')
for (const relative of PLAIN) rewrite(relative, [[OLD, NEW]])
for (const relative of readdirSync(join(ROOT, 'apps/desktop/installer/locales'))) {
  if (relative.endsWith('.json')) rewrite(`apps/desktop/installer/locales/${relative}`, [[OLD, NEW]])
}
for (const [relative, from, to] of SCOPED) rewrite(relative, [[from, to]])
console.log(`rebrand: ${stats.files} file(s), ${stats.hits} replacement(s)`)

const missing = FORK_MARKERS.filter(([relative, marker]) => {
  const absolute = join(ROOT, relative)
  return !existsSync(absolute) || !readFileSync(absolute, 'utf8').includes(marker)
})
if (missing.length > 0) {
  console.warn('rebrand: WARNING — a rebase dropped fork-only code; restore it by hand:')
  for (const [relative, marker] of missing) console.warn(`  ! ${relative}: ${marker}`)
  process.exitCode = 1
}

if (process.argv.includes('--icons')) {
  const python = process.env.DSH_PYTHON ?? 'python'
  const script = join(ROOT, 'scripts/purge-icon.py')
  if (!existsSync(script)) throw new Error(`rebrand: missing ${script}`)
  console.log('rebrand: icons')
  execFileSync(python, [script], { stdio: 'inherit' })
}
