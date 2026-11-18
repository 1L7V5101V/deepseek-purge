/** Filesystem ownership for the Electron-managed desktop installation. */

import { join } from 'node:path'
import { homedir } from 'node:os'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'

/** Home directory of this fork, kept apart from an upstream DeepSeek Harness installation. */
const PURGE_HOME_DIR_NAME = '.dsh-purge'

// Pin the home before anything resolves it. The Host is a child process that inherits this
// environment, so the shell and the Host agree on one home even though the published runtime
// packages still carry their own default; an explicit DSH_HOME always wins.
if (process.env.DSH_HOME === undefined || process.env.DSH_HOME.trim() === '') {
  process.env.DSH_HOME = join(homedir(), PURGE_HOME_DIR_NAME)
}

/** Stable desktop installation paths under the shared Harness home. */
export interface DesktopPaths {
  readonly profile: string
  readonly lock: string
}

/**
 * Resolve every Electron-owned path without changing the shared data roots.
 * @param dshHome - Harness home shared with npm-installed dsh.
 * @returns immutable desktop path set.
 */
export function resolveDesktopPaths(dshHome: string = resolveDshHome()): DesktopPaths {
  return {
    profile: join(dshHome, 'profiles', 'desktop'),
    lock: join(dshHome, 'profiles', 'desktop', 'lock'),
  }
}

/**
 * Resolve this fork's Electron state directory, kept out of the upstream userData directory.
 * @param dshHome - Harness home shared with npm-installed dsh.
 * @returns directory holding window state, crash reports and the plugin operation journal.
 */
export function resolveDesktopUserData(dshHome: string = resolveDshHome()): string {
  return join(dshHome, 'electron')
}
