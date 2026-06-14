import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const overviewSource = readFileSync(resolve(root, 'src/pages/TripOverview.tsx'), 'utf8')
const detailSource = readFileSync(resolve(root, 'src/pages/TripDetail.tsx'), 'utf8')
const tripsSource = readFileSync(resolve(root, 'src/mock/trips.ts'), 'utf8')

test('trip pages keep the requested trip instead of falling back when itinerary data is empty', () => {
  assert.doesNotMatch(overviewSource, /found\s*&&\s*found\.itinerary\.length\s*\?\s*found\s*:\s*mainTrip/)
  assert.doesNotMatch(detailSource, /found\s*&&\s*found\.itinerary\.length\s*\?\s*found\s*:\s*mainTrip/)
})

test('listed mock trips provide matching overview content', () => {
  for (const id of ['trip-beijing-3d', 'trip-chengdu-2d', 'trip-hangzhou-2d']) {
    const tripBlock = blockForTrip(id)
    assert.doesNotMatch(tripBlock, /itinerary:\s*\[\s*\]/, `${id} should include itinerary days`)
    assert.doesNotMatch(tripBlock, /notes:\s*\[\s*\]/, `${id} should include notes`)
    assert.doesNotMatch(tripBlock, /checkpoints:\s*\[\s*\]/, `${id} should include checkpoints`)
    assert.doesNotMatch(tripBlock, /tips:\s*\[\s*\]/, `${id} should include tips`)
  }
})

function blockForTrip(id) {
  const start = tripsSource.indexOf(`id: '${id}'`)
  assert.notEqual(start, -1, `${id} should exist`)

  const nextTrip = tripsSource.indexOf('\n  {\n    id:', start + 1)
  const end = nextTrip === -1 ? tripsSource.indexOf('\n  },\n]', start) : nextTrip
  assert.notEqual(end, -1, `${id} block should be parseable`)
  return tripsSource.slice(start, end)
}
