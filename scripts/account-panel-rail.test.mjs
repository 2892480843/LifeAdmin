import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const profile = readFileSync(resolve(root, 'src/pages/Profile.tsx'), 'utf8')
const settings = readFileSync(resolve(root, 'src/pages/Settings.tsx'), 'utf8')
const tripOverview = readFileSync(resolve(root, 'src/pages/TripOverview.tsx'), 'utf8')
const newTrip = readFileSync(resolve(root, 'src/pages/newtrip/NewTrip.tsx'), 'utf8')

test('account pages disable decorative accent rails on large content panels', () => {
  assert.match(profile, /<SystemPanel\s+accent="emerald"\s+showAccentRail=\{false\}/)
  assert.match(settings, /<SystemPanel\s+accent="brand"\s+showAccentRail=\{false\}/)
})

test('trip overview summary panel disables the decorative accent rail', () => {
  assert.match(tripOverview, /<SystemPanel\s+accent="brand"\s+showAccentRail=\{false\}\s+className="p-4">/)
})

test('new trip draft summary panel disables the decorative accent rail', () => {
  assert.match(newTrip, /<SystemPanel\s+accent=\{step === 4 \? 'emerald' : 'brand'\}\s+showAccentRail=\{false\}\s+className="p-4 sm:p-5">/)
})
