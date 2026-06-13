import type { ItineraryItem, PlanStop, PlanType, Poi, RoutePlan, Trip, TripDraft } from '../types'
import { getCity, getPoi } from '../mock'
import { displayPlaceImage } from './poiImages'

const colors = ['#2563eb', '#14b8a6', '#f59e0b', '#8b5cf6', '#ec4899', '#10b981']
const timeSlots = ['09:00', '10:30', '12:00', '14:00', '16:00', '18:00', '20:00']
const planTypes: PlanType[] = ['效率优先', '体验优先', '预算优先']

export const selectedPlanTripId = (plan: RoutePlan) => `trip-${plan.id}`

export function isSelectedPlanTrip(id: string | undefined, plan: RoutePlan | null) {
  if (!id || !plan) return false
  return id === selectedPlanTripId(plan) || id === plan.id
}

export function createDraftRoutePlans(draft: TripDraft, pois: Poi[] = []): RoutePlan[] {
  const city = getCity(draft.cityId)
  const cityName = draft.cityName || city?.name || '目的地'
  const days = Math.max(1, draft.days || 1)

  return planTypes.map((type, index) => {
    const stops = selectDraftStops({ draft, pois, cityName, type, days })
    return {
      id: `draft-${sanitizeId(draft.cityId || cityName)}-${sanitizeId(type)}`,
      type,
      name: `${cityName}${planTypeTitle(type)}${days}日路线`,
      recommended: index === 0,
      days,
      totalDuration: `约 ${Math.max(4, days * (type === '体验优先' ? 7 : 6))} 小时`,
      budget: planBudget(draft.budget, type),
      distance: Number((Math.max(6, stops.length * (type === '体验优先' ? 1.8 : 1.5))).toFixed(1)),
      satisfaction: Math.max(84, 94 - index * 3),
      tags: planTags(type, draft),
      stops,
      summary: draftSummary(type, draft, cityName),
      aiReason: draftAiReason(type, draft, cityName),
    }
  })
}

export function buildTripFromPlan(plan: RoutePlan, draft: TripDraft): Trip {
  const city = getCity(draft.cityId)
  const days = Math.max(1, draft.days || plan.days || 1)
  const effectivePlan = alignPlanToDraft(plan, draft, days)
  const stopsPerDay = Math.max(1, Math.ceil(effectivePlan.stops.length / days))

  return {
    id: selectedPlanTripId(effectivePlan),
    title: effectivePlan.name,
    cityId: draft.cityId,
    cover:
      displayPlaceImage(effectivePlan.stops[0]?.cover) ||
      displayPlaceImage(city?.cover) ||
      '',
    startDate: draft.startDate,
    endDate: draft.endDate,
    days,
    travelers: draft.travelers,
    budget: effectivePlan.budget,
    distance: effectivePlan.distance,
    totalDuration: effectivePlan.totalDuration,
    status: '规划中',
    planType: effectivePlan.type,
    itinerary: Array.from({ length: days }, (_, dayIndex) => {
      const dayStops = effectivePlan.stops.slice(dayIndex * stopsPerDay, (dayIndex + 1) * stopsPerDay)
      return {
        day: dayIndex + 1,
        date: addDays(draft.startDate, dayIndex),
        title: `${effectivePlan.type} · 第 ${dayIndex + 1} 天`,
        items: dayStops.map((stop, stopIndex) => {
          const globalIndex = dayIndex * stopsPerDay + stopIndex
          const poi = getPoi(stop.poiId)
          const fallbackX = 45 + (globalIndex % 5) * 8
          const fallbackY = 35 + Math.floor(globalIndex / 5) * 8
          const item: ItineraryItem = {
            id: `${effectivePlan.id}-${stop.poiId}-${stop.order}`,
            time: timeSlots[globalIndex % timeSlots.length],
            poiId: stop.poiId,
            name: stop.name,
            category: stop.category ?? poi?.category ?? '景点',
            cover: displayPlaceImage(stop.cover, stop.imageConfidence) || displayPlaceImage(poi?.cover, poi?.imageConfidence) || '',
            activity: poi ? `游览${poi.name}` : `探索${stop.name}`,
            duration: poi?.suggestedDuration ?? '1-2 小时',
            transport: globalIndex === 0 ? '步行' : globalIndex % 2 === 0 ? '地铁' : '步行',
            cost: firstFiniteNumber(stop.cost, poi?.price, 0),
            status: '待出发',
            note: stop.address ? `${stop.address}。${poi?.aiReason ?? effectivePlan.summary}` : poi?.aiReason ?? effectivePlan.summary,
            x: firstFiniteNumber(stop.x, poi?.x, fallbackX),
            y: firstFiniteNumber(stop.y, poi?.y, fallbackY),
            lng: firstFiniteNumber(stop.lng, poi?.lng, 0),
            lat: firstFiniteNumber(stop.lat, poi?.lat, 0),
            color: colors[globalIndex % colors.length],
          }
          return item
        }),
      }
    }),
    notes: [
      effectivePlan.summary,
      ...(effectivePlan.aiReason ? [effectivePlan.aiReason] : []),
      `方案标签：${effectivePlan.tags.join('、')}`,
    ],
    checkpoints: effectivePlan.stops.slice(0, 4).map((stop) => `${stop.order}. ${stop.name}`),
    tips: [`满意度 ${effectivePlan.satisfaction}%`, `站点顺序：${effectivePlan.stops.map((stop) => stop.name).join(' → ')}`],
  }
}

function alignPlanToDraft(plan: RoutePlan, draft: TripDraft, days: number): RoutePlan {
  const hasKnownForeignStops = plan.stops.some((stop) => {
    const poi = getPoi(stop.poiId)
    return poi && poi.cityId !== draft.cityId
  })
  const hasNoStops = plan.stops.length === 0
  const hasStaleDays = Boolean(draft.days && plan.days && draft.days !== plan.days)

  if (hasKnownForeignStops || hasNoStops) {
    const draftPlan = createDraftRoutePlans(draft)[planTypes.indexOf(plan.type)]
    return {
      ...draftPlan,
      id: plan.id,
      type: plan.type,
      recommended: plan.recommended,
      satisfaction: plan.satisfaction || draftPlan.satisfaction,
    }
  }

  if (hasStaleDays) {
    return {
      ...plan,
      days,
      name: `${draft.cityName || getCity(draft.cityId)?.name || '目的地'}${planTypeTitle(plan.type)}${days}日路线`,
      totalDuration: `约 ${Math.max(4, days * (plan.type === '体验优先' ? 7 : 6))} 小时`,
    }
  }

  return plan
}

function selectDraftStops({
  draft,
  pois,
  cityName,
  type,
  days,
}: {
  draft: TripDraft
  pois: Poi[]
  cityName: string
  type: PlanType
  days: number
}) {
  const targetCount = Math.min(8, Math.max(4, days * 2))
  const rankedPois = rankPoisForPlan(draft, pois, type)
  const stops = rankedPois.slice(0, targetCount).map((poi, index) => poiToPlanStop(poi, index))
  const generic = genericStops(draft, cityName)

  return fillStops(stops, generic, targetCount).map((stop, index) => ({
    ...stop,
    order: index + 1,
  }))
}

function rankPoisForPlan(draft: TripDraft, pois: Poi[], type: PlanType) {
  const preferenceText = [...draft.interests, ...draft.travelType, ...draft.cuisines].join(' ')
  return pois
    .filter((poi) => !draft.cityId || poi.cityId === draft.cityId)
    .sort((left, right) => {
      const scoreLeft = poiScore(left, preferenceText, type)
      const scoreRight = poiScore(right, preferenceText, type)
      return scoreRight - scoreLeft
    })
}

function poiScore(poi: Poi, preferenceText: string, type: PlanType) {
  let score = poi.rating * 10 + Math.min(10, poi.reviewCount / 100)
  if (preferenceMatchesCategory(preferenceText, poi.category)) score += 35
  if (type === '预算优先') score += Math.max(0, 20 - poi.price / 20)
  if (type === '体验优先' && ['文化艺术', '历史遗迹', '夜生活'].includes(poi.category)) score += 12
  if (type === '效率优先' && ['景点', '公园自然', '历史遗迹'].includes(poi.category)) score += 10
  return score
}

function preferenceMatchesCategory(text: string, category: Poi['category']) {
  if (/美食|餐|火锅|烧烤|小吃/.test(text)) return category === '美食'
  if (/文化|历史|古迹|展览|博物/.test(text)) return category === '文化艺术' || category === '历史遗迹'
  if (/亲子|儿童|乐园/.test(text)) return category === '亲子游'
  if (/自然|公园|户外/.test(text)) return category === '公园自然'
  if (/夜生活|夜市|酒吧/.test(text)) return category === '夜生活'
  if (/购物|商场/.test(text)) return category === '购物'
  return category === '景点'
}

function poiToPlanStop(poi: Poi, index: number): PlanStop {
  return {
    poiId: poi.id,
    name: poi.name,
    cover: poi.cover,
    order: index + 1,
    category: poi.category,
    lng: poi.lng,
    lat: poi.lat,
    x: poi.x,
    y: poi.y,
    rating: poi.rating,
    cost: poi.price,
    address: poi.address,
    openingHours: poi.openingHours,
    imageConfidence: poi.imageConfidence,
    imageSource: poi.imageSource,
    imageVerifiedAt: poi.imageVerifiedAt,
    imagePendingReview: poi.imagePendingReview,
    imageReviewReason: poi.imageReviewReason,
  }
}

function genericStops(draft: TripDraft, cityName: string): PlanStop[] {
  const baseNames = [
    `${cityName}核心地标`,
    `${cityName}文化体验`,
    `${cityName}特色餐饮`,
    `${cityName}城市漫步`,
    `${cityName}自然公园`,
    `${cityName}夜间休闲`,
    `${cityName}购物补给`,
    `${cityName}收官打卡`,
  ]

  return baseNames.map((name, index) => ({
    poiId: `draft-${sanitizeId(draft.cityId || cityName)}-${index + 1}`,
    name,
    cover: '',
    order: index + 1,
  }))
}

function fillStops(stops: PlanStop[], fallback: PlanStop[], targetCount: number) {
  const seen = new Set<string>()
  return [...stops, ...fallback]
    .filter((stop) => {
      const key = stop.poiId || stop.name
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, targetCount)
}

function planTypeTitle(type: PlanType) {
  if (type === '体验优先') return '深度体验'
  if (type === '预算优先') return '高性价比'
  return '高效精华'
}

function planBudget(budget: number, type: PlanType) {
  const base = Math.max(300, budget || 800)
  if (type === '预算优先') return Math.round(base * 0.78)
  if (type === '体验优先') return Math.round(base)
  return Math.round(base * 0.9)
}

function planTags(type: PlanType, draft: TripDraft) {
  const transport = draft.transport[0] || '动线优化'
  if (type === '体验优先') return ['深度体验', draft.pace || '舒适节奏', transport]
  if (type === '预算优先') return ['控制预算', '少绕路', transport]
  return ['核心覆盖', '动线最优', transport]
}

function draftSummary(type: PlanType, draft: TripDraft, cityName: string) {
  const interests = draft.interests.slice(0, 2).join('、') || draft.travelType.slice(0, 2).join('、') || '当前偏好'
  if (type === '体验优先') return `围绕${cityName}的${interests}安排更充足的停留时间，适合放慢节奏深度体验。`
  if (type === '预算优先') return `结合人均预算和${draft.transport.join('、') || '可用交通'}，优先控制交通与活动成本。`
  return `围绕${cityName}核心点位组织顺路行程，兼顾${interests}和通勤效率。`
}

function draftAiReason(type: PlanType, draft: TripDraft, cityName: string) {
  const constraints = [draft.pace, draft.walkRange, draft.avoidPeak ? '错峰优先' : '常规节奏'].filter(Boolean).join('、')
  if (type === '体验优先') return `Agent 根据${cityName}、兴趣偏好和${constraints}，优先保留体验停留与街区探索时间。`
  if (type === '预算优先') return `Agent 根据${cityName}、人均预算 ¥${draft.budget} 和交通偏好，优先减少高成本节点。`
  return `Agent 根据${cityName}、出行天数和交通偏好，优先减少绕路并覆盖核心节点。`
}

function sanitizeId(value: string) {
  return String(value || 'item')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item'
}

function addDays(date: string, offset: number) {
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  parsed.setDate(parsed.getDate() + offset)
  return parsed.toISOString().slice(0, 10)
}

function firstFiniteNumber(...values: unknown[]) {
  for (const value of values) {
    const number = Number(value)
    if (Number.isFinite(number)) return number
  }
  return 0
}
