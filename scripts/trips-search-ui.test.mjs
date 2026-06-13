import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tripsSource = readFileSync(resolve(root, 'src/pages/Trips.tsx'), 'utf8')

test('trips search field uses a polished focus-safe control', () => {
  assert.match(tripsSource, /role=["']search["']/)
  assert.match(tripsSource, /type=["']search["']/)
  assert.match(tripsSource, /placeholder=["']搜索行程、城市或方案类型["']/)
  assert.match(tripsSource, /focus-visible:ring-0/)
  assert.match(tripsSource, /focus-visible:ring-offset-0/)
  assert.match(tripsSource, /aria-label=["']清空行程搜索["']/)
  assert.match(tripsSource, /group-focus-within:bg-brand-50/)
})

test('trips status counts are scoped to the current search keyword', () => {
  assert.match(tripsSource, /const searchScopedTrips = useMemo/)
  assert.match(tripsSource, /全部:\s*searchScopedTrips\.length/)
  assert.match(tripsSource, /规划中:\s*searchScopedTrips\.filter\(\(trip\) => trip\.status === '规划中'\)\.length/)
  assert.match(tripsSource, /return searchScopedTrips\.filter\(\(trip\) => \{/)
})

test('trip asset cover image does not render route data overlays', () => {
  assert.doesNotMatch(tripsSource, /\bbuildRoutePoints\b/)
  assert.doesNotMatch(tripsSource, /\brouteSmoothPath\b/)
  assert.doesNotMatch(tripsSource, /\banimate-route-flow\b/)
})
