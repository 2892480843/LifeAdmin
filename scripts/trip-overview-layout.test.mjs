import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const overviewSource = readFileSync(resolve(root, 'src/pages/TripOverview.tsx'), 'utf8')

test('trip overview day tabs fit multi-day drafts without horizontal clipping', () => {
  assert.match(overviewSource, /gridTemplateColumns:\s*'repeat\(auto-fit,\s*minmax\(3\.5rem,\s*1fr\)\)'/)
  assert.doesNotMatch(overviewSource, /sticky top-0 z-10 flex overflow-x-auto/)
  assert.doesNotMatch(overviewSource, /flex-shrink-0 rounded-t-lg/)
})
