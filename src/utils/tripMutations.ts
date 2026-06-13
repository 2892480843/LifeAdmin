import type { ItineraryItem, Poi, Trip } from '../types'

const editableTripStatuses = new Set<Trip['status']>(['规划中', '草稿'])
const itemColors = ['#2563eb', '#14b8a6', '#f59e0b', '#8b5cf6', '#ec4899', '#10b981']

export function isPoiInTrip(trip: Trip, poiId: string) {
  return trip.itinerary.some((day) => day.items.some((item) => item.poiId === poiId))
}

export function isPoiJoinCandidate(trip: Trip, poi: Poi) {
  return editableTripStatuses.has(trip.status) && trip.cityId === poi.cityId
}

export function canAddPoiToTrip(trip: Trip, poi: Poi) {
  return isPoiJoinCandidate(trip, poi) && !isPoiInTrip(trip, poi.id)
}

export function getPoiJoinCandidates(trips: Trip[], poi: Poi) {
  return trips.filter((trip) => isPoiJoinCandidate(trip, poi))
}

export function addPoiToTrips(trips: Trip[], tripId: string, poi: Poi, timestamp = Date.now()) {
  let added = false
  const nextTrips = trips.map((trip) => {
    if (trip.id !== tripId || !canAddPoiToTrip(trip, poi)) return trip
    added = true
    return appendPoiToTrip(trip, poi, timestamp)
  })

  return added ? { added, trips: nextTrips } : { added, trips }
}

function appendPoiToTrip(trip: Trip, poi: Poi, timestamp: number): Trip {
  const itinerary = trip.itinerary.length
    ? trip.itinerary.map((day) => ({ ...day, items: [...day.items] }))
    : [{ day: 1, date: trip.startDate, title: '新增安排', items: [] }]
  const lastDay = itinerary[itinerary.length - 1]
  const nextIndex = lastDay.items.length

  lastDay.items = [...lastDay.items, createItineraryItem(poi, nextIndex, timestamp)]

  return {
    ...trip,
    budget: trip.budget + poi.price,
    distance: Number((trip.distance + (poi.distance || 0)).toFixed(1)),
    itinerary,
  }
}

function createItineraryItem(poi: Poi, index: number, timestamp: number): ItineraryItem {
  return {
    id: `${poi.id}-added-${timestamp}`,
    time: nextTime(index),
    poiId: poi.id,
    name: poi.name,
    category: poi.category,
    cover: poi.cover,
    activity: `自由游览 ${poi.name}`,
    duration: poi.suggestedDuration,
    transport: '步行',
    cost: poi.price,
    status: '待出发',
    note: poi.aiReason,
    x: poi.x,
    y: poi.y,
    lng: poi.lng,
    lat: poi.lat,
    color: itemColors[index % itemColors.length],
  }
}

function nextTime(index: number) {
  const hour = Math.min(21, 9 + index * 2)
  return `${String(hour).padStart(2, '0')}:00`
}
