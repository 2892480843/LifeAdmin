import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const settings = readFileSync(resolve(root, 'src/pages/Settings.tsx'), 'utf8')

test('settings page omits the top command header', () => {
  assert.doesNotMatch(settings, /<RoutePageHeader\b/)
  assert.doesNotMatch(settings, /系统配置中心/)
  assert.doesNotMatch(settings, /Settings Center/)
})
