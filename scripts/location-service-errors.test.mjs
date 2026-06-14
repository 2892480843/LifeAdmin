import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const source = readFileSync(resolve(process.cwd(), 'src/services/locationService.ts'), 'utf8')

test('location service maps CoreLocation unknown failures to a friendly app message', () => {
  assert.match(source, /getGeolocationErrorMessage/)
  assert.match(source, /CoreLocation/)
  assert.match(source, /kCLErrorLocationUnknown/)
  assert.match(source, /定位暂时不可用/)
  assert.doesNotMatch(source, /error\.message \|\| '定位失败'/)
})

test('location service handles timeout and unavailable geolocation errors separately', () => {
  assert.match(source, /positionUnavailable/)
  assert.match(source, /timeout/)
  assert.match(source, /定位超时/)
})
