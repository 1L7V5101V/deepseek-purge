#!/usr/bin/env node
/**
 * Re-apply this fork's local patches to the installed dsh-purge plugin.
 *
 * The patches live inside `node_modules`, so a plugin upgrade or reinstall silently drops them.
 * Run this after `dsh plugin add dsh-purge` (or after an upgrade) to restore the fork's behaviour:
 *
 *   1. drop the bottom-right launcher bubble from the shell overlay,
 *   2. keep 红队模式 out of the mode dropdown while leaving its tools and backend intact,
 *   3. delete the `tool-subagent-list-agents` row that no longer resolves on runtime 0.2.2,
 *   4. make sure the plugin stays enabled with prompt injection on for every mode.
 *
 * Every step is idempotent: a second run reports "already" instead of writing again.
 *
 * Usage: node scripts/purge-plugin-patches.mjs [--check]
 */

import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Harness home of this fork; an explicit DSH_HOME always wins, same rule as the desktop shell. */
const HOME = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh-purge')
const PLUGIN = join(HOME, 'profiles', 'desktop', 'node_modules', 'dsh-purge')
const CHECK_ONLY = process.argv.includes('--check')

/** One literal replacement against a plugin file. */
const patches = [
  {
    file: join(PLUGIN, 'client.js'),
    label: 'shell overlay without the launcher bubble',
    marker: '去掉右下角 dsh-purge 启动气泡',
    find: '}, () => h(react.Fragment, null, h(WelcomeNotice), h(PurgeLauncher), h(PurgeDock), h(HeroNewSessionMount), h(TabRowPurgeMount), h(EnvAdaptSendGate))));',
    replace: [
      '\t\t\t// 2026-11-18：按用户要求去掉右下角 dsh-purge 启动气泡（PurgeLauncher），',
      '\t\t\t// 面板 PurgeDock 仍可由模式旁的 chip 打开。要恢复就把 h(PurgeLauncher) 加回本行。',
      '\t\t\t}, () => h(react.Fragment, null, h(WelcomeNotice), h(PurgeDock), h(HeroNewSessionMount), h(TabRowPurgeMount), h(EnvAdaptSendGate))));',
    ].join('\n'),
  },
  {
    file: join(PLUGIN, 'lib', 'redteam', 'index.js'),
    label: 'redteam apply() accepts config',
    marker: 'export function apply(ctx, config) {',
    find: 'export function apply(ctx) {',
    replace: 'export function apply(ctx, config) {',
  },
  {
    file: join(PLUGIN, 'lib', 'redteam', 'index.js'),
    label: 'redteam preset registration behind config.registerPreset',
    marker: 'config.registerPreset === false',
    find: '  ctx.effect(() => {\n    let tries = 0',
    replace: [
      '  // 2026-11-18：按用户要求「下拉只保留标准/PTC/极简/创造」，这里用 config.registerPreset 关掉',
      '  // 红队模式的下拉注册。redteam_* 工具、技能落地、演练台后端都不受影响；把 registerPreset 改回',
      '  // true（或删掉该键）即可恢复红队模式。',
      '  if (config && config.registerPreset === false) {',
      "    writeStatus({ ok: false, phase: 'register-disabled', note: 'registerPreset: false' })",
      "    ctx.logger?.info?.('redteam-mode: 预设注册已按配置关闭（registerPreset: false）')",
      '  } else ctx.effect(() => {',
      '    let tries = 0',
    ].join('\n'),
  },
  {
    file: join(PLUGIN, 'cordis.patch.yml'),
    label: 'plugin patch declares registerPreset: false',
    marker: 'registerPreset: false',
    find: '    - id: dsh-purge-redteam\n      name: dsh-purge/redteam\n',
    replace: [
      '    - id: dsh-purge-redteam',
      '      name: dsh-purge/redteam',
      '      config:',
      '        # false = 不在模式下拉里注册「红队模式」（2026-11-18 按用户要求，下拉只留标准/PTC/极简/创造）。',
      '        # redteam_* 工具与演练台后端不受影响；改回 true 即恢复红队模式。',
      '        registerPreset: false',
      '',
    ].join('\n'),
  },
  {
    file: join(PLUGIN, 'presets', 'redteam', 'agent.cordis.yml'),
    label: 'drop the unresolvable tool-subagent-list-agents row',
    marker: 'tool-subagent-list-agents 行已删',
    find: [
      "    - id: tool-subagent-list-agents",
      "      name: '@deepseek-ai/dsh-tool-subagent-control/list-agents'",
      '      disabled: false',
      '',
    ].join('\n'),
    replace: [
      '    # tool-subagent-list-agents 行已删：0.2.2 起 dsh-tool-subagent-control 不再导出',
      '    # ./list-agents 子入口（deepseek-harness 4df09d37d5，2026-10-17 把 list_agents 并进根插件）。',
      '    # 保留该行会让整个预设 import 失败、审计记 never started，模式下拉被过滤。list_agents 工具仍在。',
      '',
    ].join('\n'),
  },
]

/** Injection must stay on for every mode; the plugin's own default already does that. */
async function assertInjectionOn() {
  const file = join(PLUGIN, 'cordis.patch.yml')
  const text = await readFile(file, 'utf8')
  const disabled = /- id: dsh-purge\n(?:.*\n)*?\s+enabled: false/.test(text)
  const gate = text.includes('modeGate: true')
  if (disabled) return 'error: dsh-purge is declared with enabled: false'
  if (gate) return 'error: modeGate: true restricts injection to purge/redteam sessions'
  return 'ok: injection on for every mode'
}

if (!existsSync(PLUGIN)) {
  console.error(`dsh-purge is not installed at ${PLUGIN}`)
  process.exit(1)
}

let failures = 0
for (const patch of patches) {
  if (!existsSync(patch.file)) {
    console.log(`SKIP  ${patch.label} — missing ${patch.file}`)
    failures += 1
    continue
  }
  const text = await readFile(patch.file, 'utf8')
  if (text.includes(patch.marker)) {
    console.log(`ALREADY ${patch.label}`)
    continue
  }
  if (!text.includes(patch.find)) {
    console.log(`MISS  ${patch.label} — anchor not found, plugin layout changed`)
    failures += 1
    continue
  }
  if (CHECK_ONLY) {
    console.log(`WOULD ${patch.label}`)
    continue
  }
  await writeFile(patch.file, text.replace(patch.find, patch.replace), 'utf8')
  console.log(`APPLIED ${patch.label}`)
}

const injection = await assertInjectionOn()
console.log(`injection: ${injection}`)
if (injection.startsWith('error')) failures += 1

if (failures > 0) process.exitCode = 1
