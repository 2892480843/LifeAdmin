import type { PreferenceProfile } from '../types'
import { trips } from './trips'

function calculateProfileStats() {
  const cityIds = new Set(trips.map((trip) => trip.cityId))
  const poiIds = new Set(
    trips.flatMap((trip) =>
      trip.itinerary.flatMap((day) => day.items.map((item) => item.poiId).filter(Boolean)),
    ),
  )

  return {
    totalTrips: trips.length,
    totalCities: cityIds.size,
    totalPois: poiIds.size,
    totalDays: trips.reduce((sum, trip) => sum + trip.days, 0),
  }
}

// 用户偏好画像
export const preferenceProfile: PreferenceProfile = {
  interests: [
    { label: '历史文化', weight: 92 },
    { label: '城市观光', weight: 88 },
    { label: '美食探索', weight: 85 },
    { label: '艺术展览', weight: 70 },
    { label: '自然风光', weight: 64 },
    { label: '购物休闲', weight: 58 },
  ],
  cuisines: [
    { label: '本帮菜', weight: 90 },
    { label: '川菜', weight: 82 },
    { label: '日料', weight: 68 },
    { label: '咖啡甜点', weight: 75 },
  ],
  pace: '适中节奏',
  partner: '情侣出行',
  budgetLevel: '舒适型（¥500-800/天）',
  rhythm: [
    { label: '景点游览', value: 40 },
    { label: '美食体验', value: 30 },
    { label: '休闲放松', value: 18 },
    { label: '购物娱乐', value: 12 },
  ],
  stats: calculateProfileStats(),
  tags: ['深度游爱好者', 'CityWalk 达人', '美食控', '摄影爱好者', '错峰出行'],
}
