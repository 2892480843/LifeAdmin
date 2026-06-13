import type { ItineraryItem, Poi, PreferenceProfile, Trip, TripDraft, User } from '../types'

export interface DerivedPreferenceProfile extends PreferenceProfile {
  insight: string
}

interface DerivePreferenceProfileInput {
  user?: User | null
  trips: Trip[]
  favoritePois: Poi[]
  draft?: TripDraft | null
}

type ScoreMap = Record<string, number>

const interestLabels = ['历史文化', '城市观光', '美食探索', '艺术展览', '自然风光', '购物休闲']
const defaultInterestWeights = [62, 58, 54, 48, 44, 40]
const defaultCuisineLabels = ['本帮菜', '川菜', '小吃', '咖啡甜点']

const categoryInterestMap: Record<string, string> = {
  景点: '城市观光',
  美食: '美食探索',
  文化艺术: '艺术展览',
  购物: '购物休闲',
  亲子游: '城市观光',
  公园自然: '自然风光',
  历史遗迹: '历史文化',
  夜生活: '城市观光',
}

export function derivePreferenceProfile({
  user,
  trips,
  favoritePois,
  draft,
}: DerivePreferenceProfileInput): DerivedPreferenceProfile {
  const items = trips.flatMap((trip) => trip.itinerary.flatMap((day) => day.items))
  const stats = deriveStats(trips)
  const interests = deriveInterests(items, favoritePois, draft)
  const cuisines = deriveCuisines(items, favoritePois, draft)
  const rhythm = deriveRhythm(items)
  const pace = derivePace(trips, draft)
  const partner = derivePartner(draft)
  const budgetLevel = deriveBudgetLevel(trips, draft)
  const tags = deriveTags({ user, trips, favoritePois, draft, interests, cuisines })
  const insight = buildProfileInsight(stats.totalTrips, interests, trips)

  return {
    interests,
    cuisines,
    pace,
    partner,
    budgetLevel,
    rhythm,
    stats,
    tags,
    insight,
  }
}

function deriveStats(trips: Trip[]): PreferenceProfile['stats'] {
  const cityIds = new Set<string>()
  const poiIds = new Set<string>()

  for (const trip of trips) {
    cityIds.add(trip.cityId)
    for (const day of trip.itinerary) {
      for (const item of day.items) {
        poiIds.add(item.poiId ?? item.name)
      }
    }
  }

  return {
    totalTrips: trips.length,
    totalCities: cityIds.size,
    totalPois: poiIds.size,
    totalDays: trips.reduce((sum, trip) => sum + trip.days, 0),
  }
}

function deriveInterests(items: ItineraryItem[], favoritePois: Poi[], draft?: TripDraft | null) {
  const scores = createScoreMap(interestLabels)

  for (const label of draft?.interests ?? []) {
    addScore(scores, normalizeInterestLabel(label), 2.4)
  }
  for (const label of draft?.travelType ?? []) {
    addScore(scores, normalizeInterestLabel(label), 1.4)
  }
  for (const item of items) {
    addScore(scores, categoryInterestMap[item.category] ?? normalizeInterestLabel(item.category), 1)
  }
  for (const poi of favoritePois) {
    addScore(scores, categoryInterestMap[poi.category] ?? normalizeInterestLabel(poi.category), 1.6)
    for (const tag of poi.tags ?? []) addScore(scores, normalizeInterestLabel(tag), 0.35)
  }

  return normalizeScores(scores, interestLabels, defaultInterestWeights)
}

function deriveCuisines(items: ItineraryItem[], favoritePois: Poi[], draft?: TripDraft | null) {
  const scores = createScoreMap(defaultCuisineLabels)

  for (const label of draft?.cuisines ?? []) addScore(scores, label, 3)
  for (const item of items) {
    if (item.category !== '美食') continue
    for (const label of inferCuisineLabels(`${item.name} ${item.activity} ${item.note ?? ''}`)) {
      addScore(scores, label, 1.4)
    }
  }
  for (const poi of favoritePois) {
    if (poi.category !== '美食') continue
    for (const label of inferCuisineLabels(`${poi.name} ${(poi.tags ?? []).join(' ')}`)) {
      addScore(scores, label, 1.8)
    }
  }

  return normalizeScores(scores, defaultCuisineLabels, [58, 52, 46, 40]).slice(0, 4)
}

function deriveRhythm(items: ItineraryItem[]) {
  const scores: ScoreMap = {
    景点游览: 0,
    美食体验: 0,
    休闲放松: 0,
    购物娱乐: 0,
  }

  for (const item of items) {
    const bucket = rhythmBucket(item)
    scores[bucket] += parseDurationHours(item.duration)
  }

  const total = Object.values(scores).reduce((sum, value) => sum + value, 0)
  if (total <= 0) {
    return [
      { label: '景点游览', value: 40 },
      { label: '美食体验', value: 30 },
      { label: '休闲放松', value: 18 },
      { label: '购物娱乐', value: 12 },
    ]
  }

  return Object.entries(scores)
    .map(([label, value]) => ({ label, value: Math.max(6, Math.round((value / total) * 100)) }))
    .sort((a, b) => b.value - a.value)
}

function derivePace(trips: Trip[], draft?: TripDraft | null) {
  const normalized = normalizePace(draft?.pace)
  if (normalized) return normalized

  const totalDays = trips.reduce((sum, trip) => sum + trip.days, 0)
  const totalItems = trips.reduce((sum, trip) => sum + trip.itinerary.reduce((daySum, day) => daySum + day.items.length, 0), 0)
  const itemsPerDay = totalDays > 0 ? totalItems / totalDays : 0

  if (itemsPerDay >= 4) return '紧凑节奏'
  if (itemsPerDay <= 2 && itemsPerDay > 0) return '舒缓节奏'
  return '适中节奏'
}

function derivePartner(draft?: TripDraft | null) {
  const raw = draft?.travellerType || draft?.partner
  if (!raw) return '自由出行'
  if (raw.includes('出行')) return raw
  if (raw.includes('情侣')) return '情侣出行'
  if (raw.includes('朋友')) return '朋友出行'
  if (raw.includes('家庭') || raw.includes('亲子')) return '家庭出行'
  if (raw.includes('独自') || raw.includes('单人')) return '独自出行'
  return `${raw}出行`
}

function deriveBudgetLevel(trips: Trip[], draft?: TripDraft | null) {
  const dailyBudgets = trips
    .filter((trip) => trip.days > 0 && trip.budget > 0)
    .map((trip) => trip.budget / trip.days)

  if (dailyBudgets.length === 0 && draft?.budget) {
    dailyBudgets.push(draft.budget / Math.max(1, draft.days || 1))
  }

  const average = dailyBudgets.length > 0
    ? dailyBudgets.reduce((sum, value) => sum + value, 0) / dailyBudgets.length
    : 0

  if (average >= 1200) return '奢享型（¥1200+/天）'
  if (average >= 800) return '高品质（¥800-1200/天）'
  if (average >= 500) return '舒适型（¥500-800/天）'
  if (average >= 250) return '经济型（¥250-500/天）'
  return '轻预算（¥250/天内）'
}

function deriveTags({
  user,
  trips,
  favoritePois,
  draft,
  interests,
  cuisines,
}: {
  user?: User | null
  trips: Trip[]
  favoritePois: Poi[]
  draft?: TripDraft | null
  interests: { label: string; weight: number }[]
  cuisines: { label: string; weight: number }[]
}) {
  const tags: string[] = []
  const hasInterest = (label: string) => (interests.find((item) => item.label === label)?.weight ?? 0) >= 55

  if (hasInterest('历史文化')) tags.push('深度游爱好者')
  if (hasInterest('城市观光')) tags.push('CityWalk 达人')
  if (hasInterest('美食探索') || cuisines[0]?.weight >= 55) tags.push('美食控')
  if (hasInterest('自然风光')) tags.push('自然风光派')
  if (hasInterest('艺术展览')) tags.push('展览灵感派')
  if (favoritePois.length > 0) tags.push('收藏规划者')
  if (draft?.avoidPeak) tags.push('错峰出行')
  if (trips.filter((trip) => trip.status === '已完成').length >= 2) tags.push('稳定出行者')
  if (user?.level) tags.push(user.level)

  return unique(tags).slice(0, 7)
}

function buildProfileInsight(totalTrips: number, interests: { label: string; weight: number }[], trips: Trip[]) {
  const top = interests.slice(0, 2).map((item) => item.label)
  if (totalTrips === 0) {
    return `暂无行程记录，AI 将先根据您填写的「${top.join(' + ')}」偏好生成路线建议。`
  }

  const cities = suggestNextCities(top, new Set(trips.map((trip) => trip.cityId)))
  return `根据您的 ${totalTrips} 次行程记录，AI 分析您偏好「${top.join(' + ')}」组合路线，建议下次探索${cities.join('或')}经典线路。`
}

function suggestNextCities(topInterests: string[], visitedCityIds: Set<string>) {
  const candidates = topInterests.includes('历史文化') && topInterests.includes('美食探索')
    ? [
        { id: 'xian', name: '西安' },
        { id: 'chengdu', name: '成都' },
      ]
    : topInterests.includes('自然风光')
      ? [
          { id: 'hangzhou', name: '杭州' },
          { id: 'sanya', name: '三亚' },
        ]
      : [
          { id: 'shanghai', name: '上海' },
          { id: 'beijing', name: '北京' },
        ]

  const available = candidates.filter((city) => !visitedCityIds.has(city.id))
  return (available.length > 0 ? available : candidates).slice(0, 2).map((city) => city.name)
}

function createScoreMap(labels: string[]) {
  return Object.fromEntries(labels.map((label) => [label, 0])) as ScoreMap
}

function addScore(scores: ScoreMap, label: string, value: number) {
  if (!label) return
  scores[label] = (scores[label] ?? 0) + value
}

function normalizeScores(scores: ScoreMap, fillLabels: string[], fallbackWeights: number[]) {
  const entries = Object.entries(scores)
  const maxScore = Math.max(0, ...entries.map(([, value]) => value))
  const weighted = entries
    .filter(([, value]) => value > 0)
    .map(([label, value]) => ({
      label,
      value,
      weight: Math.min(96, Math.round(50 + (value / Math.max(1, maxScore)) * 42)),
    }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'zh-CN'))

  const used = new Set(weighted.map((item) => item.label))
  const fallback = fillLabels
    .filter((label) => !used.has(label))
    .map((label, index) => ({ label, weight: fallbackWeights[index] ?? 38 }))

  return [...weighted.map(({ label, weight }) => ({ label, weight })), ...fallback].slice(0, fillLabels.length)
}

function normalizeInterestLabel(label: string) {
  if (label.includes('历史') || label.includes('人文') || label.includes('古迹')) return '历史文化'
  if (label.includes('美食') || label.includes('餐') || label.includes('小吃')) return '美食探索'
  if (label.includes('艺术') || label.includes('展') || label.includes('文创')) return '艺术展览'
  if (label.includes('自然') || label.includes('公园') || label.includes('山') || label.includes('湖')) return '自然风光'
  if (label.includes('购物') || label.includes('休闲')) return '购物休闲'
  if (label.includes('城市') || label.includes('观光') || label.includes('CityWalk')) return '城市观光'
  return label
}

function normalizePace(pace?: string) {
  if (!pace) return ''
  if (pace.includes('舒缓') || pace.includes('慢')) return '舒缓节奏'
  if (pace.includes('紧凑') || pace.includes('快')) return '紧凑节奏'
  if (pace.includes('适中')) return '适中节奏'
  return pace.includes('节奏') ? pace : `${pace}节奏`
}

function inferCuisineLabels(text: string) {
  const labels: string[] = []
  if (/川|火锅|麻辣|锦里|成都/.test(text)) labels.push('川菜')
  if (/本帮|小笼|生煎|豫园|上海/.test(text)) labels.push('本帮菜')
  if (/日料|寿司|拉面/.test(text)) labels.push('日料')
  if (/咖啡|甜点|茶|蛋糕/.test(text)) labels.push('咖啡甜点')
  if (labels.length === 0) labels.push('小吃')
  return labels
}

function rhythmBucket(item: ItineraryItem) {
  if (item.category === '美食') return '美食体验'
  if (item.category === '购物' || item.category === '夜生活') return '购物娱乐'
  if (item.category === '公园自然' || item.transport === '休闲') return '休闲放松'
  return '景点游览'
}

function parseDurationHours(duration: string) {
  const match = duration.match(/(\d+(?:\.\d+)?)/)
  return match ? Number(match[1]) : 1.5
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items))
}
