import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

test('POI validation allows same-city chain branches with distinct address and coordinates', () => {
  const result = runValidate([
    poi({
      id: 'beijing-chain-a',
      name: '南门涮肉(北洼路店)',
      address: '北京城区北洼路28号',
      lng: 116.305392,
      lat: 39.936461,
    }),
    poi({
      id: 'beijing-chain-b',
      name: '南门涮肉(东单店)',
      address: '建国门内大街26号新闻大厦北门3层',
      lng: 116.421739,
      lat: 39.907405,
    }),
  ])

  assert.equal(result.status, 0, result.stderr || result.stdout)
})

test('POI validation rejects true same-place duplicates', () => {
  const result = runValidate([
    poi({
      id: 'beijing-dup-a',
      name: '南门涮肉(北洼路店)',
      address: '北京城区北洼路28号',
      lng: 116.305392,
      lat: 39.936461,
    }),
    poi({
      id: 'beijing-dup-b',
      name: '南门涮肉(北洼路店)',
      address: '北京城区北洼路28号',
      lng: 116.305392,
      lat: 39.936461,
    }),
  ])

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /duplicate same-city place/)
})

function runValidate(pois) {
  const dir = mkdtempSync(join(tmpdir(), 'routewise-pois-'))
  const cityPath = join(dir, 'cities.json')
  const dataPath = join(dir, 'pois.json')
  const progressPath = join(dir, 'progress.json')

  writeFileSync(cityPath, JSON.stringify({ cities: [{ id: 'beijing', name: '北京' }] }))
  writeFileSync(dataPath, JSON.stringify(pois))
  writeFileSync(progressPath, JSON.stringify({ cities: { beijing: { status: 'completed', coverage: 'target-met' } } }))

  return spawnSync(process.execPath, ['scripts/validate-pois.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      VALIDATE_POIS_CITY_SOURCE: cityPath,
      VALIDATE_POIS_DATA_SOURCE: dataPath,
      VALIDATE_POIS_PROGRESS_SOURCE: progressPath,
    },
    encoding: 'utf8',
  })
}

function poi(patch) {
  return {
    id: patch.id,
    name: patch.name,
    cityId: 'beijing',
    category: '美食',
    rating: 4.5,
    reviewCount: 0,
    cover: '',
    images: [],
    imageConfidence: 'pending-review',
    imageSource: 'pending-manual-review',
    imageVerifiedAt: '2026-06-02T00:00:00.000Z',
    imagePendingReview: true,
    imageReviewReason: 'No trusted POI photo was available from the source.',
    tags: ['美食'],
    x: 50,
    y: 50,
    lng: patch.lng,
    lat: patch.lat,
    address: patch.address,
    openingHours: '开放时间以官方公告或地图实时信息为准',
    ticket: '以官方公告或现场为准',
    suggestedDuration: '1.5-2 小时',
    suitableFor: '城市观光 / 摄影 / 家庭',
    price: 0,
    distance: 1,
    aiReason: '适合作为城市美食候选点。',
    description: '该地点来自高德远程搜索，详情信息以地图服务实时结果为准。',
    reviews: [],
  }
}
