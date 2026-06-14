import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { ActivityStatus, Poi, RoutePlan, Trip, TripDraft, User } from '../types'
import { createDefaultDraft } from '../mock/draft'
import { loadGeneratedPoiById, loadPoisByCity } from '../mock/poiLoader'
import { pois as mockPois } from '../mock/pois'
import { trips as mockTrips } from '../mock/trips'
import { currentUser } from '../mock/users'
import { addPoiToTrips } from '../utils/tripMutations'

interface AppState {
  user: User | null
  isAuthed: boolean
  login: (account?: string) => void
  logout: () => void
  updateUser: (patch: Partial<User>) => void
  // 新建行程草稿
  draft: TripDraft
  updateDraft: (patch: Partial<TripDraft>) => void
  resetDraft: () => void
  // 选中的推荐方案
  selectedPlan: RoutePlan | null
  setSelectedPlan: (plan: RoutePlan | null) => void
  // 可变行程
  trips: Trip[]
  addTrip: (trip: Trip) => void
  deleteTrip: (tripId: string) => void
  updateTripStatus: (tripId: string, status: Trip['status']) => void
  updateItemStatus: (tripId: string, itemId: string, status: ActivityStatus) => void
  addPoiToTrip: (tripId: string, poi: Poi) => boolean
  // 本地与远程 POI
  pois: Poi[]
  upsertRemotePoi: (poi: Poi) => void
  getPoiById: (poiId: string) => Poi | undefined
  getPoisByCityId: (cityId: string) => Poi[]
  loadPoiById: (poiId: string) => Promise<Poi | undefined>
  loadPoisByCityId: (cityId: string) => Promise<Poi[]>
  // 收藏
  favorites: string[]
  toggleFavorite: (poiId: string) => void
  isFavorite: (poiId: string) => boolean
}

const AppContext = createContext<AppState | null>(null)

const AUTH_STORAGE_KEY = 'zhixing-auth'
const USER_STORAGE_KEY = 'zhixing-user'
const isProductionDataMode = import.meta.env.VITE_AGENT_AUTH_MODE === 'production'

const cloneTrips = () => JSON.parse(JSON.stringify(mockTrips)) as Trip[]
const markDemoPoi = (poi: Poi): Poi => ({ ...poi, sourceKind: 'demo_mock', sourceProvider: 'demo_mock' })

function readStoredUser() {
  const raw = localStorage.getItem(USER_STORAGE_KEY)
  if (!raw) return null
  try {
    return { ...currentUser, ...(JSON.parse(raw) as Partial<User>) }
  } catch {
    localStorage.removeItem(USER_STORAGE_KEY)
    return null
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    return localStorage.getItem(AUTH_STORAGE_KEY) ? readStoredUser() ?? currentUser : null
  })
  const [draft, setDraft] = useState<TripDraft>(() => createDefaultDraft())
  const [selectedPlan, setSelectedPlan] = useState<RoutePlan | null>(null)
  const [trips, setTrips] = useState<Trip[]>(() => (isProductionDataMode ? [] : cloneTrips()))
  const [loadedPois, setLoadedPois] = useState<Poi[]>([])
  const [remotePois, setRemotePois] = useState<Poi[]>([])
  const [favorites, setFavorites] = useState<string[]>(['waitan', 'wukangroad'])
  const localSeedPois = isProductionDataMode ? [] : mockPois
  const productionPois: Poi[] = isProductionDataMode ? remotePois : []
  const demoPois = localSeedPois.map(markDemoPoi)
  const allPois = useMemo(
    () => uniquePois([...demoPois, ...loadedPois, ...productionPois, ...remotePois]),
    [demoPois, loadedPois, productionPois, remotePois],
  )

  const loadPoisByCityId = useCallback(async (cityId: string) => {
    if (isProductionDataMode) return []
    const items = await loadPoisByCity(cityId)
    const demoItems = items.map(markDemoPoi)
    setLoadedPois((current) => mergePois(current, demoItems))
    return demoItems
  }, [])

  const loadPoiById = useCallback(async (poiId: string) => {
    const local = allPois.find((poi) => poi.id === poiId)
    if (local) return local
    if (isProductionDataMode) return undefined

    const found = await loadGeneratedPoiById(poiId)
    const demoFound = found ? markDemoPoi(found) : undefined
    if (demoFound) setLoadedPois((current) => mergePois(current, [demoFound]))
    return demoFound
  }, [allPois])

  useEffect(() => {
    if (user) {
      localStorage.setItem(AUTH_STORAGE_KEY, '1')
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    }
  }, [user])

  const value = useMemo<AppState>(
    () => ({
      user,
      isAuthed: !!user,
      login: (account) => {
        const normalized = account?.trim()
        const accountPatch = normalized
          ? normalized.includes('@')
            ? { email: normalized }
            : { phone: normalized }
          : {}
        setUser(readStoredUser() ?? { ...currentUser, ...accountPatch })
      },
      logout: () => setUser(null),
      updateUser: (patch) => setUser((u) => ({ ...(u ?? currentUser), ...patch })),
      draft,
      updateDraft: (patch) => setDraft((d) => ({ ...d, ...patch })),
      resetDraft: () => setDraft(createDefaultDraft()),
      selectedPlan,
      setSelectedPlan,
      trips,
      addTrip: (trip) =>
        setTrips((prev) => [trip, ...prev.filter((t) => t.id !== trip.id)]),
      deleteTrip: (tripId) =>
        setTrips((prev) => prev.filter((t) => t.id !== tripId)),
      updateTripStatus: (tripId, status) =>
        setTrips((prev) => prev.map((t) => (t.id === tripId ? { ...t, status } : t))),
      updateItemStatus: (tripId, itemId, status) =>
        setTrips((prev) =>
          prev.map((trip) => {
            if (trip.id !== tripId) return trip
            return {
              ...trip,
              itinerary: trip.itinerary.map((day) => ({
                ...day,
                items: day.items.map((item) =>
                  item.id === itemId ? { ...item, status } : item,
                ),
              })),
            }
          }),
        ),
      addPoiToTrip: (tripId, poi) => {
        const result = addPoiToTrips(trips, tripId, poi)
        if (!result.added) return false
        setTrips(result.trips)
        return result.added
      },
      pois: allPois,
      upsertRemotePoi: (poi) =>
        setRemotePois((items) => [poi, ...items.filter((item) => item.id !== poi.id)]),
      getPoiById: (poiId) => allPois.find((poi) => poi.id === poiId),
      getPoisByCityId: (cityId) => allPois.filter((poi) => poi.cityId === cityId),
      loadPoiById,
      loadPoisByCityId,
      favorites,
      toggleFavorite: (poiId) =>
        setFavorites((f) =>
          f.includes(poiId) ? f.filter((x) => x !== poiId) : [...f, poiId],
        ),
      isFavorite: (poiId) => favorites.includes(poiId),
    }),
    [user, draft, selectedPlan, trips, allPois, loadPoiById, loadPoisByCityId, favorites],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

function uniquePois(items: Poi[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

function mergePois(current: Poi[], incoming: Poi[]) {
  const existingIds = new Set(current.map((item) => item.id))
  const additions = incoming.filter((item) => !existingIds.has(item.id))
  return additions.length > 0 ? [...current, ...additions] : current
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp 必须在 AppProvider 内使用')
  return ctx
}
