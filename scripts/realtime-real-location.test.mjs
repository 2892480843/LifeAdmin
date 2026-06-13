import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const realtimeSource = readFileSync(resolve(root, 'src/pages/Realtime.tsx'), 'utf8')
const locationServiceSource = readFileSync(resolve(root, 'src/services/locationService.ts'), 'utf8')

test('realtime page requests real browser location before the first realtime snapshot', () => {
  assert.match(realtimeSource, /initialLocationTripIdRef/)
  assert.match(realtimeSource, /requestLocation\(\{ refreshRealtime: true, fallbackToTrip: true \}\)/)
  assert.doesNotMatch(realtimeSource, /failureCountRef\.current = 0\s+void loadRealtime\(\)/)
})

test('location service asks the browser for a fresh high-accuracy position', () => {
  assert.match(locationServiceSource, /enableHighAccuracy:\s*true/)
  assert.match(locationServiceSource, /maximumAge:\s*0/)
})
