import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const root = process.cwd()

function loadTripMutations() {
  const source = readFileSync(resolve(root, 'src/utils/tripMutations.ts'), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  })
  const module = { exports: {} }
  vm.runInNewContext(outputText, {
    exports: module.exports,
    module,
    require: (id) => {
      throw new Error(`Unexpected runtime import in tripMutations: ${id}`)
    },
  })
  return module.exports
}

const basePoi = {
  id: 'yuyuan',
  name: '豫园',
  cityId: 'shanghai',
  category: '历史遗迹',
  rating: 4.6,
  reviewCount: 8421,
  cover: '/yuyuan.jpg',
  images: [],
  tags: [],
  x: 60,
  y: 48,
  lng: 121.492,
  lat: 31.227,
  address: '上海市黄浦区安仁街 218 号',
  openingHours: '09:00-16:30',
  ticket: '¥40',
  suggestedDuration: '2-3 小时',
  suitableFor: '家庭 / 文化爱好者',
  price: 40,
  distance: 2,
  aiReason: '适合加入上海城市路线',
  description: '江南古典园林代表',
  reviews: [],
}

function trip(overrides = {}) {
  return {
    id: 'trip-shanghai',
    title: '上海两日游',
    cityId: 'shanghai',
    cover: '/trip.jpg',
    startDate: '2026-06-07',
    endDate: '2026-06-08',
    days: 2,
    travelers: 2,
    budget: 1200,
    distance: 16.2,
    totalDuration: '约 16 小时',
    status: '规划中',
    planType: '效率优先',
    itinerary: [
      {
        day: 1,
        date: '2026-06-07',
        title: '城市地标',
        items: [
          {
            id: 'waitan-09:00',
            time: '09:00',
            poiId: 'waitan',
            name: '外滩',
            category: '景点',
            cover: '/waitan.jpg',
            activity: '漫步外滩',
            duration: '1.5 小时',
            transport: '步行',
            cost: 0,
            status: '待出发',
            x: 62,
            y: 40,
            lng: 121.49,
            lat: 31.24,
            color: '#2563eb',
          },
        ],
      },
    ],
    notes: [],
    checkpoints: [],
    tips: [],
    ...overrides,
  }
}

test('POI join candidates are editable trips in the same city only', () => {
  const { canAddPoiToTrip, getPoiJoinCandidates } = loadTripMutations()
  const shanghaiPlan = trip({ id: 'trip-shanghai-plan', status: '规划中' })
  const shanghaiDraft = trip({ id: 'trip-shanghai-draft', status: '草稿', itinerary: [] })
  const shanghaiCompleted = trip({ id: 'trip-shanghai-done', status: '已完成' })
  const hangzhouFavorite = trip({ id: 'trip-hangzhou-favorite', cityId: 'hangzhou', status: '收藏' })

  assert.equal(canAddPoiToTrip(shanghaiPlan, basePoi), true)
  assert.equal(canAddPoiToTrip(shanghaiDraft, basePoi), true)
  assert.equal(canAddPoiToTrip(shanghaiCompleted, basePoi), false)
  assert.equal(canAddPoiToTrip(hangzhouFavorite, basePoi), false)
  assert.deepEqual(
    getPoiJoinCandidates([shanghaiPlan, shanghaiDraft, shanghaiCompleted, hangzhouFavorite], basePoi).map((item) => item.id),
    ['trip-shanghai-plan', 'trip-shanghai-draft'],
  )
})

test('adding a POI appends accurate itinerary data to the target trip last day', () => {
  const { addPoiToTrips } = loadTripMutations()
  const original = trip()
  const { added, trips } = addPoiToTrips([original], original.id, basePoi, 12345)
  const updatedTrip = trips[0]
  const addedItem = updatedTrip.itinerary[0].items.at(-1)

  assert.equal(added, true)
  assert.notEqual(updatedTrip, original)
  assert.equal(updatedTrip.budget, 1240)
  assert.equal(updatedTrip.distance, 18.2)
  assert.equal(addedItem.id, 'yuyuan-added-12345')
  assert.equal(addedItem.poiId, 'yuyuan')
  assert.equal(addedItem.name, '豫园')
  assert.equal(addedItem.time, '11:00')
  assert.equal(addedItem.cost, 40)
  assert.equal(addedItem.lng, 121.492)
  assert.equal(addedItem.lat, 31.227)
})

test('adding a POI rejects duplicate, completed, favorite, and cross-city trips', () => {
  const { addPoiToTrips } = loadTripMutations()
  const duplicatePoi = { ...basePoi, id: 'waitan', name: '外滩' }
  const completed = trip({ id: 'trip-completed', status: '已完成' })
  const favorite = trip({ id: 'trip-favorite', status: '收藏' })
  const crossCity = trip({ id: 'trip-cross-city', cityId: 'hangzhou' })

  for (const [targetTrip, poi] of [
    [trip(), duplicatePoi],
    [completed, basePoi],
    [favorite, basePoi],
    [crossCity, basePoi],
  ]) {
    const result = addPoiToTrips([targetTrip], targetTrip.id, poi, 12345)
    assert.equal(result.added, false)
    assert.deepEqual(result.trips, [targetTrip])
  }
})
