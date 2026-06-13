import type { Trip, User } from '../types'
import { postAgentJson } from './agent'
import type { AgentRequestOptions } from './agent'

const NOTIFICATION_CACHE_TTL_MS = 5_000

export interface SystemNotification {
  id: string
  type: 'trip' | 'weather' | 'route'
  title: string
  desc: string
  path: string
  createdAt: string
  readAt: string | null
}

export interface SystemNotificationResult {
  ok: boolean
  generatedAt: string
  unreadCount: number
  notifications: SystemNotification[]
}

interface NotificationRequestOptions extends AgentRequestOptions {
  forceRefresh?: boolean
}

interface NotificationPayload {
  user: ReturnType<typeof pickNotificationUser> | null
  trips: ReturnType<typeof pickNotificationTrip>[]
}

let notificationCache: {
  key: string
  expiresAt: number
  value?: SystemNotificationResult
  promise?: Promise<SystemNotificationResult>
} | null = null

export async function fetchSystemNotifications(
  params: { user: User | null; trips: Trip[] },
  options?: NotificationRequestOptions,
): Promise<SystemNotificationResult> {
  const payload = {
    user: params.user ? pickNotificationUser(params.user) : null,
    trips: params.trips.map(pickNotificationTrip),
  }
  const cacheKey = getNotificationCacheKey(payload)
  const now = Date.now()
  const { forceRefresh, ...agentOptions } = options ?? {}
  if (!forceRefresh && notificationCache?.key === cacheKey && notificationCache.expiresAt > Date.now()) {
    if (notificationCache.value) return notificationCache.value
    if (notificationCache.promise) return notificationCache.promise
  }

  const promise = postAgentJson<SystemNotificationResult>('/api/agent/notifications', payload, agentOptions)
  notificationCache = {
    key: cacheKey,
    expiresAt: now + NOTIFICATION_CACHE_TTL_MS,
    promise,
  }

  try {
    const value = await promise
    notificationCache = {
      key: cacheKey,
      expiresAt: Date.now() + NOTIFICATION_CACHE_TTL_MS,
      value,
    }
    return value
  } catch (error) {
    if (notificationCache?.key === cacheKey && notificationCache.promise === promise) {
      notificationCache = null
    }
    throw error
  }
}

export async function markSystemNotificationRead(
  params: { id: string; userId?: string },
  options?: AgentRequestOptions,
): Promise<{ ok: boolean; readId: string; readAt: string }> {
  notificationCache = null
  return postAgentJson('/api/agent/notifications/read', params, options)
}

function getNotificationCacheKey(payload: NotificationPayload) {
  return JSON.stringify({
    userId: payload.user?.id ?? 'anonymous',
    trips: payload.trips.map((trip) => ({
      id: trip.id,
      status: trip.status,
      startDate: trip.startDate,
      endDate: trip.endDate,
      items: trip.itinerary.flatMap((day) => day.items.map((item) => `${day.date}:${item.id}:${item.status}`)),
    })),
  })
}

function pickNotificationUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    city: user.city,
  }
}

function pickNotificationTrip(trip: Trip) {
  return {
    id: trip.id,
    title: trip.title,
    cityId: trip.cityId,
    startDate: trip.startDate,
    endDate: trip.endDate,
    status: trip.status,
    itinerary: trip.itinerary.map((day) => ({
      day: day.day,
      date: day.date,
      title: day.title,
      items: day.items.map((item) => ({
        id: item.id,
        name: item.name,
        status: item.status,
        lng: item.lng,
        lat: item.lat,
      })),
    })),
  }
}
