import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const exploreSource = readFileSync(resolve(root, 'src/pages/Explore.tsx'), 'utf8')
const profileSource = readFileSync(resolve(root, 'src/pages/Profile.tsx'), 'utf8')
const topNavSource = readFileSync(resolve(root, 'src/components/layout/TopNav.tsx'), 'utf8')

test('top nav search button opens explore with a search focus intent', () => {
  // 桌面端走 /explore?focus=search，移动端走 /mobile/explore；断言验证路径存在即可
  assert.match(topNavSource, /\/explore\?focus=search/)
  assert.match(topNavSource, /aria-label=["']搜索目的地、景点或行程["']/)
})

test('explore focuses the search input when opened by the search button', () => {
  assert.match(exploreSource, /useLocation\(\)/)
  assert.match(exploreSource, /searchInputRef/)
  assert.match(exploreSource, /new URLSearchParams\(location\.search\)/)
  assert.match(exploreSource, /params\.get\(['"]focus['"]\)\s*!==\s*['"]search['"]/)
  assert.match(exploreSource, /searchInputRef\.current\?\.focus\(\)/)
})

test('explore search button falls back to local results when the agent is unavailable', () => {
  assert.match(exploreSource, /showLocalSearchFallback/)
  assert.match(exploreSource, /远程搜索暂不可用，已显示当前匹配结果/)
  assert.match(exploreSource, /setResultsDrawer\('half'\)/)
  assert.doesNotMatch(exploreSource, /setSearchError\(getAgentErrorMessage\(error, '远程搜索暂不可用，已显示本地样例数据'\)\)/)
})

test('profile all favorites link opens explore in favorites filter mode', () => {
  assert.match(profileSource, /to=["']\/explore\?filter=favorites["']/)
  assert.match(profileSource, /查看全部收藏/)
})

test('explore supports the favorites filter query from profile', () => {
  assert.match(exploreSource, /params\.get\(['"]filter['"]\)\s*===\s*['"]favorites['"]/)
  assert.match(exploreSource, /favorites\.includes\(p\.id\)/)
  assert.match(exploreSource, /收藏地点/)
  assert.match(exploreSource, /查看全部收藏/)
})
