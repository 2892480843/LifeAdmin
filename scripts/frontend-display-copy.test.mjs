import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const root = process.cwd()

const userVisibleSources = [
  'src/pages/Login.tsx',
  'src/pages/Settings.tsx',
  'src/pages/Explore.tsx',
  'src/pages/Profile.tsx',
  'src/pages/newtrip/StepBasic.tsx',
  'src/pages/newtrip/StepGenerating.tsx',
  'src/components/ui/CitySelect.tsx',
  'src/mock/events.ts',
  'src/mock/service.ts',
  'src/mock/trips.ts',
  'src/mock/pois.ts',
]

const loginSource = readFileSync(resolve(root, 'src/pages/Login.tsx'), 'utf8')
const stepBasicSource = readFileSync(resolve(root, 'src/pages/newtrip/StepBasic.tsx'), 'utf8')
const newTripSource = readFileSync(resolve(root, 'src/pages/newtrip/NewTrip.tsx'), 'utf8')
const blockedCopyPatterns = [
  /本地兜底/,
  /本地样例/,
  /内置样例/,
  /演示/,
  /示例/,
  /模拟/,
]

test('frontend user-visible copy does not expose demo or local fallback labels', () => {
  const violations = []

  for (const relativePath of userVisibleSources) {
    const source = readFileSync(resolve(root, relativePath), 'utf8')
    for (const pattern of blockedCopyPatterns) {
      if (pattern.test(source)) {
        violations.push(`${relativePath}: ${pattern}`)
      }
    }
  }

  assert.deepEqual(violations, [])
})

test('login page does not show third-party or quick entry panels', () => {
  assert.doesNotMatch(loginSource, /第三方登录/)
  assert.doesNotMatch(loginSource, /快速体验入口/)
  assert.doesNotMatch(loginSource, /进入体验/)
  assert.doesNotMatch(loginSource, /thirdPartyLogin/)
  assert.doesNotMatch(loginSource, /enterDemo/)
})

test('new trip basic step uses clearer city and route endpoint labels', () => {
  assert.match(stepBasicSource, />旅行城市</)
  assert.match(stepBasicSource, /Field label="起点"/)
  assert.match(stepBasicSource, /placeholder="起点"/)
  assert.match(newTripSource, /label="旅行城市"/)
  assert.match(newTripSource, /未设置旅行城市/)
  assert.doesNotMatch(stepBasicSource, />目的地</)
  assert.doesNotMatch(stepBasicSource, /Field label="出发地"/)
  assert.doesNotMatch(stepBasicSource, /placeholder="出发地"/)
  assert.doesNotMatch(newTripSource, /label="目的地"/)
  assert.doesNotMatch(newTripSource, /未设置目的地/)
})
