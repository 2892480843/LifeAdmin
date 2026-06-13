import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sidebar = readFileSync(resolve(root, 'src/components/layout/Sidebar.tsx'), 'utf8')

test('sidebar membership modal exposes a complete benefits overview', () => {
  assert.match(sidebar, /membershipBenefits/)
  assert.match(sidebar, /membershipPlans/)
  assert.match(sidebar, /当前方案/)
  assert.match(sidebar, /查看完整 AI 设置/)
  assert.match(sidebar, /navigate\('\/settings\?section=ai'\)/)
})
