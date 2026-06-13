import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const profile = readFileSync(resolve(root, 'src/pages/Profile.tsx'), 'utf8')

test('profile page uses a structured overview and insight layout', () => {
  assert.match(profile, /ProfileHeroCard/, 'Profile should promote the account summary into a dedicated hero card')
  assert.match(profile, /PreferenceInsightPanel/, 'Profile should isolate preference insights into a focused panel')
  assert.match(profile, /AccountQuickDock/, 'Profile should group account actions in a compact dock')
  assert.match(profile, /AI 偏好洞察/, 'Profile should label the generated preference insight clearly')
  assert.match(profile, /近期路线资产/, 'Profile should frame trips and places as recent route assets')
})
