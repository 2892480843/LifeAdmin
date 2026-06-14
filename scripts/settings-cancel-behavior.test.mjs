import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const settings = readFileSync(resolve(root, 'src/pages/Settings.tsx'), 'utf8')

test('shared settings save bar wires cancel to section rollback handlers', () => {
  const saveBarSource = settings.match(/function SaveBar[\s\S]*?type ProfileForm/)?.[0] ?? ''
  assert.match(saveBarSource, /onCancel: \(\) => void/)
  assert.match(saveBarSource, /onClick=\{cancelChanges\}/)

  const calls = [...settings.matchAll(/<SaveBar[\s\S]*?\/>/g)].map((match) => match[0])
  assert.equal(calls.length, 3)

  for (const call of calls) {
    assert.match(call, /onSave=\{save[A-Z]\w+\}/)
    assert.match(call, /onCancel=\{cancel[A-Z]\w+\}/)
  }
})

test('profile panel does not render a cancel button', () => {
  const profileSource = settings.match(/function ProfileSection[\s\S]*?function profileFormFromUser/)?.[0] ?? ''
  assert.doesNotMatch(profileSource, /aria-label="取消个人资料修改"/)
  assert.doesNotMatch(profileSource, />取消<\/button>/)
})
