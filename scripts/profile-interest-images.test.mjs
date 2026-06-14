import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const profile = readFileSync(resolve(root, 'src/pages/Profile.tsx'), 'utf8')

const interestLabels = ['历史文化', '城市观光', '美食探索', '艺术展览', '自然风光', '购物休闲']

test('profile interest heat cards render mapped travel images', () => {
  assert.match(profile, /interestImagePoiNames/, 'Profile should keep label-to-POI image mapping near the page')
  assert.match(profile, /getInterestImageSrc/, 'Profile should resolve interest images from POI covers')
  assert.match(profile, /SmartImage\s+src=\{interestImageSrc\}/, 'Interest heat cards should render SmartImage')
  assert.doesNotMatch(profile, /rgba\(37,99,235,\$\{0\.08 \+ item\.weight \/ 180\}\)/, 'Cards should not use the old gradient placeholder')

  for (const label of interestLabels) {
    assert.match(profile, new RegExp(`['"]${label}['"]`), `${label} should have a mapped image source`)
  }
})
