import { readFileSync } from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'

const source = readFileSync(new URL('../src/pages/TripDetail.tsx', import.meta.url), 'utf8')

test('navigation target status chip does not wrap under narrow panel width', () => {
  assert.match(
    source,
    /<Tag tone=\{statusTone\[targetItem\.status\]\} className="shrink-0 whitespace-nowrap">\{targetItem\.status\}<\/Tag>/,
  )
})
