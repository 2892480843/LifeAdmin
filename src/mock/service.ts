// mock service：统一管理异步接口延迟与返回
import { cities, getCity } from './cities'
import { pois, getPoi } from './pois'
import { loadGeneratedPoiById, loadPoisByCity } from './poiLoader'
import { routePlans, getPlan } from './plans'
import { trips, getTrip, mainTrip } from './trips'
import { weather } from './weather'
import { realtimeEvents, dynamicLogs, assistantMessages } from './events'
import { preferenceProfile } from './profile'
import { currentUser } from './users'

const delay = <T>(data: T, ms = 300): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms))

export const api = {
  login: (account: string) => delay({ ...currentUser, account }, 600),
  getCities: () => delay(cities),
  getCity: (id: string) => delay(getCity(id)),
  getPois: async (cityId?: string) => delay(cityId ? await loadPoisByCity(cityId) : pois),
  getPoi: async (id: string) => delay(getPoi(id) ?? await loadGeneratedPoiById(id)),
  getPlans: () => delay(routePlans, 400),
  getPlan: (id: string) => delay(getPlan(id)),
  getTrips: () => delay(trips),
  getTrip: (id: string) => delay(getTrip(id)),
  getMainTrip: () => delay(mainTrip),
  getWeather: () => delay(weather),
  getRealtimeEvents: () => delay(realtimeEvents),
  getDynamicLogs: () => delay(dynamicLogs),
  getAssistantMessages: () => delay(assistantMessages),
  getProfile: () => delay(preferenceProfile),
  // 智行助手回复
  askAssistant: (question: string) =>
    delay(
      `收到你的问题「${question}」。根据当前行程，我建议优先选择地铁出行以避开拥堵，并预留 15 分钟缓冲时间。需要我同步更新行程吗？`,
      700,
    ),
}
