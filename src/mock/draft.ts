import type { TripDraft } from '../types'
import { addMockDays, formatMockDate } from './dates'

export function createDefaultDraft(): TripDraft {
  const days = 2
  const startDate = formatMockDate()

  return {
    cityId: 'shanghai',
    cityName: '上海',
    days,
    startDate,
    endDate: addMockDays(startDate, days - 1),
    travelers: 2,
    travelType: ['城市观光'],
    travellerType: '情侣出行',
    style: '经典热门',
    startPoint: '上海',
    endPoint: '上海',
    interests: ['历史文化', '城市观光'],
    cuisines: ['本帮菜'],
    pace: '适中',
    partner: '情侣',
    accessibility: false,
    spotPreference: '兼顾热门与小众',
    budget: 1200,
    activityTime: ['09:00', '21:00'],
    transport: ['地铁', '步行'],
    walkRange: '中等（1-3 公里）',
    diningBudget: '¥100-200/餐',
    queueTolerance: '30-60 分钟',
    avoidPeak: true,
    freeFirst: false,
    indoorFirst: false,
    accessibleFirst: false,
  }
}

export const defaultDraft: TripDraft = createDefaultDraft()
