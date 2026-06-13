import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

async function importTsModule(path) {
  const source = readFileSync(path, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: path,
  }).outputText

  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
}

test('profile page derives the preference profile from live app data', () => {
  const profilePage = readFileSync(resolve(root, 'src/pages/Profile.tsx'), 'utf8')

  assert.match(profilePage, /derivePreferenceProfile/, 'Profile should use the derived profile helper')
  assert.doesNotMatch(profilePage, /preferenceProfile/, 'Profile should not render the static mock profile')
})

test('derived profile reflects the supplied trips, favorites and draft preferences', async () => {
  const { derivePreferenceProfile } = await importTsModule(resolve(root, 'src/utils/profileInsights.ts'))
  const trips = [
    {
      id: 'trip-real-data',
      cityId: 'xian',
      days: 2,
      travelers: 2,
      budget: 1200,
      distance: 10,
      status: '已完成',
      planType: '体验优先',
      itinerary: [
        {
          day: 1,
          items: [
            {
              id: 'museum-1',
              poiId: 'museum-1',
              name: '城墙博物馆',
              category: '历史遗迹',
              duration: '3 小时',
              transport: '步行',
              cost: 80,
              activity: '城墙与博物馆深度游览',
            },
            {
              id: 'hotpot-1',
              poiId: 'hotpot-1',
              name: '川味火锅',
              category: '美食',
              duration: '1.5 小时',
              transport: '步行',
              cost: 220,
              activity: '川菜火锅晚餐',
            },
          ],
        },
      ],
    },
  ]
  const favoritePois = [
    {
      id: 'mall-1',
      name: '潮流购物中心',
      category: '购物',
      tags: ['潮流', '购物'],
      price: 180,
    },
  ]
  const draft = {
    interests: ['自然风光'],
    cuisines: ['川菜'],
    pace: '舒缓',
    partner: '朋友',
    travellerType: '朋友出行',
    budget: 1200,
    activityTime: ['09:00', '21:00'],
  }

  const profile = derivePreferenceProfile({ trips, favoritePois, draft })

  assert.equal(profile.stats.totalTrips, 1)
  assert.equal(profile.stats.totalCities, 1)
  assert.equal(profile.stats.totalPois, 2)
  assert.equal(profile.stats.totalDays, 2)
  assert.equal(profile.pace, '舒缓节奏')
  assert.equal(profile.partner, '朋友出行')
  assert.equal(profile.budgetLevel, '舒适型（¥500-800/天）')
  assert.equal(profile.cuisines[0].label, '川菜')
  assert.match(profile.insight, /1 次行程记录/)
  assert.doesNotMatch(profile.insight, /12 次行程记录/)

  const interestLabels = profile.interests.map((item) => item.label)
  assert.ok(interestLabels.includes('历史文化'), '历史遗迹行程应计入历史文化兴趣')
  assert.ok(interestLabels.includes('美食探索'), '美食行程应计入美食探索兴趣')
  assert.ok(interestLabels.includes('购物休闲'), '收藏购物 POI 应计入购物休闲兴趣')
  assert.ok(interestLabels.includes('自然风光'), '草稿偏好应计入画像')
  assert.ok(profile.tags.includes('美食控'), '美食偏好应生成真实标签')
})
