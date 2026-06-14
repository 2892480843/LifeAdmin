import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { buildGeneratedPois } from './build-generated-pois.mjs'

const root = process.cwd()
const appSource = readFileSync(resolve(root, 'src/App.tsx'), 'utf8')
const appContextSource = readFileSync(resolve(root, 'src/store/AppContext.tsx'), 'utf8')
const poiLoaderSource = readFileSync(resolve(root, 'src/mock/poiLoader.ts'), 'utf8')

test('app routes lazy-load pages behind Suspense', () => {
  assert.match(appSource, /import \{ lazy, Suspense \} from 'react'/)
  assert.doesNotMatch(appSource, /import Dashboard from '\.\/pages\/Dashboard'/)
  assert.match(appSource, /const Dashboard = lazy\(\(\) => import\('\.\/pages\/Dashboard'\)\)/)
  assert.match(appSource, /<Suspense fallback=/)
})

test('root app context avoids the mock barrel import', () => {
  assert.doesNotMatch(appContextSource, /from '\.\.\/mock'/)
  assert.match(appContextSource, /from '\.\.\/mock\/poiLoader'/)
  assert.match(appContextSource, /from '\.\.\/mock\/draft'/)
})

test('loadGeneratedPoiById uses a generated id-to-shard index', () => {
  assert.match(poiLoaderSource, /poiShardIndex/)
  assert.match(poiLoaderSource, /const shard = poiShardIndex\[id\]/)
  assert.match(poiLoaderSource, /import\('\.\/generatedPois\/poiShardIndex'\)/)
  assert.doesNotMatch(poiLoaderSource, /for \(const shard of/)
})

test('build-generated-pois writes a lightweight poi id shard index', async () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'routewise-build-pois-'))
  mkdirSync(join(tempRoot, 'src/data'), { recursive: true })
  mkdirSync(join(tempRoot, 'data'), { recursive: true })

  writeFileSync(join(tempRoot, 'src/data/china-prefecture-cities.json'), JSON.stringify({
    cities: [
      { id: 'beijing', adcode: '110000' },
      { id: 'guangzhou', adcode: '440100' },
    ],
  }))
  writeFileSync(join(tempRoot, 'data/generated-pois.json'), JSON.stringify([
    minimalPoi('beijing-food-1', 'beijing'),
    minimalPoi('guangzhou-park-1', 'guangzhou'),
  ]))

  await buildGeneratedPois({ root: tempRoot, quiet: true })

  const indexSource = readFileSync(join(tempRoot, 'src/mock/generatedPois/poiShardIndex.ts'), 'utf8')
  assert.match(indexSource, /export const poiShardIndex/)
  assert.match(indexSource, /"beijing-food-1": "featured"/)
  // 省份级分片：广州(adcode 440100)归入 p44，而非旧的 south 区域
  assert.match(indexSource, /"guangzhou-park-1": "p44"/)
})

function minimalPoi(id, cityId) {
  return {
    id,
    name: id,
    cityId,
    category: '景点',
    rating: 4.5,
    reviewCount: 0,
    cover: '',
    images: [],
    tags: [],
    x: 50,
    y: 50,
    lng: 116,
    lat: 39,
    address: '',
    openingHours: '',
    ticket: '',
    suggestedDuration: '',
    suitableFor: '',
    price: 0,
    distance: 0,
    aiReason: '',
    description: '',
    reviews: [],
  }
}
