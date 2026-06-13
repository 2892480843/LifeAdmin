import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  Baby,
  BadgeCheck,
  Castle,
  ChevronDown,
  ChevronUp,
  Clock,
  Heart,
  List,
  Loader2,
  MapPin,
  MapPinned,
  Maximize2,
  Minimize2,
  Navigation,
  Palette,
  RotateCcw,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trees,
  UtensilsCrossed,
  Wine,
  X,
} from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import MapCanvas from '../components/MapCanvas'
import type { MapMarker } from '../components/MapCanvas'
import { CitySelect, Slider, Stars } from '../components/ui'
import SmartImage from '../components/ui/SmartImage'
import { cities, cityOptionGroups } from '../mock'
import { getAgentErrorMessage, isAgentRequestCanceled, searchPois, type AgentSearchSource } from '../services/agent'
import { useApp } from '../store/AppContext'
import type { Poi, PoiCategory, PoiImageConfidence } from '../types'
import { displayPlaceImage, hasPendingPlaceImageReview } from '../utils/poiImages'

const categories: { label: PoiCategory; icon: typeof MapPin }[] = [
  { label: '景点', icon: MapPin },
  { label: '美食', icon: UtensilsCrossed },
  { label: '文化艺术', icon: Palette },
  { label: '购物', icon: ShoppingBag },
  { label: '亲子游', icon: Baby },
  { label: '公园自然', icon: Trees },
  { label: '历史遗迹', icon: Castle },
  { label: '夜生活', icon: Wine },
]

const categoryColor: Record<PoiCategory, string> = {
  景点: '#2563eb',
  美食: '#f59e0b',
  文化艺术: '#0f766e',
  购物: '#475569',
  亲子游: '#0d9488',
  公园自然: '#059669',
  历史遗迹: '#64748b',
  夜生活: '#e11d48',
}

const QUICK_CITY_IDS = ['beijing', 'shanghai', 'guangzhou', 'shenzhen', 'chengdu', 'hangzhou', 'xian', 'chongqing'] as const
const quickCities = QUICK_CITY_IDS.map((id) => cities.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => c !== undefined)

const openOptions = ['全部', '本机时间估算', '24 小时', '晚间营业'] as const
const ratingOptions = [0, 3, 4, 4.5] as const
const resultDrawerHeights = {
  collapsed: 'h-24',
  half: 'h-[52vh]',
  full: 'h-[88vh]',
}

type OpenFilter = (typeof openOptions)[number]
type DrawerState = 'closed' | keyof typeof resultDrawerHeights
type ExploreSource = 'local' | AgentSearchSource

interface ExploreResult {
  id: string
  sourceProvider?: string
  sourceId?: string
  rawSnapshotId?: string
  name: string
  category: PoiCategory
  rating: number
  reviewCount: number
  cover: string
  distance?: number
  suggestedDuration: string
  openingHours?: unknown
  lng?: number
  lat?: number
  x: number
  y: number
  address?: string
  city?: string
  district?: string
  aiReason?: string
  imageConfidence?: PoiImageConfidence
  imageSource?: string
  imageVerifiedAt?: string
  imagePendingReview?: boolean
  imageReviewReason?: string
  source: ExploreSource
}

function normalizeOpeningHours(openingHours: unknown): string {
  if (typeof openingHours === 'string') return openingHours
  if (openingHours == null) return ''
  if (Array.isArray(openingHours)) {
    return openingHours.map(normalizeOpeningHours).filter(Boolean).join(' / ')
  }
  if (typeof openingHours === 'object') {
    const values = Object.values(openingHours as Record<string, unknown>)
      .map(normalizeOpeningHours)
      .filter(Boolean)
    return values.join(' / ')
  }
  return String(openingHours)
}

function matchesOpenFilter(openingHours: unknown, filter: OpenFilter) {
  if (filter === '全部') return true
  const normalized = normalizeOpeningHours(openingHours)
  if (filter === '24 小时') return /全天|24\s*小时|24h/i.test(normalized)
  if (filter === '晚间营业') return isNightOpen(normalized)
  if (filter === '本机时间估算') return isOpenNow(normalized)
  return true
}

function isOpenNow(openingHours: unknown) {
  const normalized = normalizeOpeningHours(openingHours)
  if (/全天|24\s*小时|24h/i.test(normalized)) return true
  if (normalized.includes('周一闭馆') && new Date().getDay() === 1) return false

  const range = parseTimeRange(normalized)
  if (!range) return false

  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const { start, end } = range
  if (end < start) return currentMinutes >= start || currentMinutes <= end
  return currentMinutes >= start && currentMinutes <= end
}

function isNightOpen(openingHours: unknown) {
  const normalized = normalizeOpeningHours(openingHours)
  if (/全天|24\s*小时|24h/i.test(normalized)) return true
  const range = parseTimeRange(normalized)
  if (!range) return false
  return range.start >= 17 * 60 || range.end >= 21 * 60 || range.end < range.start
}

function parseTimeRange(openingHours: unknown) {
  const normalized = normalizeOpeningHours(openingHours)
  const match = normalized.match(/(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/)
  if (!match) return null
  const start = Number(match[1]) * 60 + Number(match[2])
  const end = Number(match[3]) * 60 + Number(match[4])
  return { start, end }
}

function getOpenState(openingHours: unknown) {
  const normalized = normalizeOpeningHours(openingHours)
  if (!normalized || /官方公告|地图|各店不同|现场|实时/.test(normalized)) {
    return { label: '需实时确认', className: 'bg-amber-50 text-amber-700 ring-amber-100' }
  }
  if (isOpenNow(normalized)) {
    return { label: '营业中', className: 'bg-emerald-50 text-emerald-700 ring-emerald-100' }
  }
  return { label: '可能休息', className: 'bg-rose-50 text-rose-700 ring-rose-100' }
}

function formatDistance(distance: number | undefined) {
  if (typeof distance !== 'number') return '距离待定'
  return `${distance >= 10 ? distance.toFixed(0) : distance.toFixed(1)} km`
}

const providerLabels: Record<AgentSearchSource, string> = {
  amap: '高德结果',
  dianping: '大众点评结果',
  'multi-provider': '多来源结果',
  'local-fallback': '远程结果',
}

function providerResultLabel(source: ExploreSource) {
  if (source === 'local') return '精选地点'
  return providerLabels[source] ?? '远程结果'
}

function remoteResultSourceLabel(results: ExploreResult[] | null) {
  if (!results) return '精选地点'
  const remoteSources = Array.from(new Set(results.map((result) => result.source).filter((source) => source !== 'local')))
  if (remoteSources.length === 1) return providerResultLabel(remoteSources[0])
  if (remoteSources.length > 1) return providerResultLabel('multi-provider')
  return '远程结果'
}

function resultReason(result: ExploreResult) {
  if (result.aiReason) return result.aiReason
  if (result.source !== 'local') {
    return `来自${providerResultLabel(result.source)}，可作为当前城市探索的候选地点，建议打开详情后结合服务方信息确认。`
  }
  return '符合当前筛选条件，适合加入本次路线备选清单。'
}

function shortOpeningHours(openingHours: unknown) {
  const normalized = normalizeOpeningHours(openingHours)
  return normalized.length > 48 ? `${normalized.slice(0, 48)}...` : normalized
}

export default function Explore() {
  const navigate = useNavigate()
  const location = useLocation()
  const { upsertRemotePoi, favorites, trips, pois: appPois, loadPoisByCityId } = useApp()
  const [cityId, setCityId] = useState('shanghai')
  const [keyword, setKeyword] = useState('')
  const [activeCats, setActiveCats] = useState<PoiCategory[]>([])
  const [minRating, setMinRating] = useState(0)
  const [maxDistance, setMaxDistance] = useState(40)
  const [openFilter, setOpenFilter] = useState<OpenFilter>('全部')
  const [activePoi, setActivePoi] = useState<string | null>(null)
  const [remoteResults, setRemoteResults] = useState<ExploreResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [loadingLocalPois, setLoadingLocalPois] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [resultsDrawer, setResultsDrawer] = useState<DrawerState>('closed')
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const searchAbortRef = useRef<AbortController | null>(null)
  const searchRequestIdRef = useRef(0)
  const compactViewport = useCompactViewport()

  const currentCity = cities.find((c) => c.id === cityId)
  const cityPois = useMemo(() => appPois.filter((poi) => poi.cityId === cityId), [appPois, cityId])
  const favoritesOnly = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('filter') === 'favorites'
  }, [location.search])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('focus') !== 'search') return

    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [location.search])

  useEffect(() => {
    let cancelled = false
    setLoadingLocalPois(true)
    loadPoisByCityId(cityId)
      .catch(() => {
        if (!cancelled) setSearchError('POI 数据加载失败，已保留当前可用地点')
      })
      .finally(() => {
        if (!cancelled) setLoadingLocalPois(false)
      })

    return () => {
      cancelled = true
    }
  }, [cityId, loadPoisByCityId])

  const filtered = useMemo(() => {
    return cityPois
      .filter((p) => {
        if (p.cityId !== cityId) return false
        if (favoritesOnly && !favorites.includes(p.id)) return false
        if (keyword && !p.name.includes(keyword) && !p.tags.some((t) => t.includes(keyword))) return false
        if (activeCats.length && !activeCats.includes(p.category)) return false
        if (p.rating < minRating) return false
        if (p.distance > maxDistance) return false
        if (!matchesOpenFilter(p.openingHours, openFilter)) return false
        return true
      })
      .map<ExploreResult>((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        rating: p.rating,
        reviewCount: p.reviewCount,
        cover: displayPlaceImage(p.cover, p.imageConfidence),
        distance: p.distance,
        suggestedDuration: p.suggestedDuration,
        openingHours: normalizeOpeningHours(p.openingHours),
        lng: p.lng,
        lat: p.lat,
        x: p.x,
        y: p.y,
        address: p.address,
        aiReason: p.aiReason,
        imageConfidence: p.imageConfidence,
        imageSource: p.imageSource,
        imageVerifiedAt: p.imageVerifiedAt,
        imagePendingReview: p.imagePendingReview ?? hasPendingPlaceImageReview(p.cover, p.imageConfidence),
        imageReviewReason: p.imageReviewReason,
        source: 'local',
      }))
  }, [cityId, favoritesOnly, favorites, keyword, activeCats, minRating, maxDistance, openFilter, cityPois])

  const displayResults = remoteResults ?? filtered
  const activeResult = activePoi ? displayResults.find((p) => p.id === activePoi) ?? null : null
  const hasActiveFilters = useMemo(
    () =>
      keyword.trim() !== '' ||
      activeCats.length > 0 ||
      minRating > 0 ||
      maxDistance < 40 ||
      openFilter !== '全部' ||
      favoritesOnly ||
      remoteResults !== null,
    [activeCats.length, keyword, minRating, maxDistance, openFilter, favoritesOnly, remoteResults],
  )
  const resultSourceLabel = favoritesOnly ? '查看全部收藏' : remoteResultSourceLabel(remoteResults)
  const resultPanelTitle = favoritesOnly ? '收藏地点' : '附近景点'
  const pageTitle = favoritesOnly ? `${currentCity?.name ?? '目的地'}收藏地点` : `${currentCity?.name ?? '目的地'} 周边`
  const emptyResultTitle = favoritesOnly ? '当前城市暂无收藏地点' : '没有找到符合条件的地点'
  const emptyResultDescription = favoritesOnly ? '切换城市查看其他收藏，或先去地点详情页收藏更多地点' : '尝试减少过滤条件或切换城市'
  const resetFiltersLabel = favoritesOnly ? '退出收藏筛选 →' : '重置所有过滤 →'
  const drawerHeightClass = resultsDrawer !== 'closed' ? resultDrawerHeights[resultsDrawer] : ''

  const joinedPoiIds = useMemo(
    () => new Set(trips.flatMap((trip) => trip.itinerary.flatMap((day) => day.items.map((item) => item.poiId).filter(Boolean)))),
    [trips],
  )

  const markers: MapMarker[] = displayResults.map((p, index) => {
    const status: MapMarker['status'] = activePoi === p.id
      ? 'selected'
      : joinedPoiIds.has(p.id)
        ? 'joined'
        : favorites.includes(p.id)
          ? 'favorite'
          : p.imagePendingReview
            ? 'risk'
            : 'default'
    return {
      id: p.id,
      x: p.x || 45 + (index % 5) * 8,
      y: p.y || 35 + Math.floor(index / 5) * 8,
      lng: p.lng,
      lat: p.lat,
      label: p.name,
      color: activePoi === p.id ? '#2563eb' : status === 'joined' ? '#11bfae' : status === 'favorite' ? '#f59e0b' : categoryColor[p.category],
      active: activePoi === p.id,
      status,
    }
  })

  useEffect(() => {
    return () => {
      searchRequestIdRef.current += 1
      searchAbortRef.current?.abort()
      searchAbortRef.current = null
    }
  }, [])

  useEffect(() => {
    searchRequestIdRef.current += 1
    searchAbortRef.current?.abort()
    searchAbortRef.current = null
    setRemoteResults(null)
    setSearchError('')
    setSearching(false)
  }, [cityId, activeCats, minRating, maxDistance, openFilter, favoritesOnly])

  useEffect(() => {
    if (activePoi && !displayResults.some((p) => p.id === activePoi)) {
      setActivePoi(null)
    }
  }, [activePoi, displayResults])

  const toggleCat = (category: PoiCategory) => {
    setActiveCats((current) =>
      current.includes(category) ? current.filter((item) => item !== category) : [...current, category],
    )
  }

  const doSearch = async () => {
    const q = keyword.trim()
    if (favoritesOnly) {
      searchRequestIdRef.current += 1
      searchAbortRef.current?.abort()
      searchAbortRef.current = null
      setRemoteResults(null)
      setSearchError('')
      setSearching(false)
      setResultsDrawer('half')
      return
    }

    if (!q && activeCats.length === 0) {
      searchRequestIdRef.current += 1
      searchAbortRef.current?.abort()
      searchAbortRef.current = null
      setRemoteResults(null)
      setSearchError('')
      setSearching(false)
      return
    }

    searchAbortRef.current?.abort()
    const controller = new AbortController()
    const requestId = searchRequestIdRef.current + 1
    searchRequestIdRef.current = requestId
    searchAbortRef.current = controller
    setSearching(true)
    setSearchError('')
    try {
      const result = await searchPois({
        keyword: q,
        cityName: currentCity?.name,
        categories: activeCats,
        minRating,
        maxDistance,
      }, {
        signal: controller.signal,
      })
      if (requestId !== searchRequestIdRef.current || controller.signal.aborted) return
      const nextResults = result.pois.map<ExploreResult>((p, index) => {
        const cover = displayPlaceImage(p.cover || p.imageUrl || p.thumbnail, p.imageConfidence)
        const source = normalizeExploreSource(result.source, p.sourceProvider)
        return {
          id: normalizeRemotePoiId(p.id, p.name, index, result.source, p.sourceProvider, p.sourceId),
          sourceProvider: p.sourceProvider,
          sourceId: p.sourceId,
          rawSnapshotId: p.rawSnapshotId,
          name: p.name,
          category: p.category ?? '景点',
          rating: p.rating ?? 4.5,
          reviewCount: p.reviewCount ?? 0,
          cover,
          distance: p.distance,
          suggestedDuration: '建议 1-2 小时',
          openingHours: normalizeOpeningHours(p.openingHours),
          lng: p.lng,
          lat: p.lat,
          x: 45 + (index % 5) * 8,
          y: 35 + Math.floor(index / 5) * 8,
          address: p.address,
          city: p.city,
          district: p.district,
          imageConfidence: p.imageConfidence ?? (cover ? 'poi-photo' : 'pending-review'),
          imageSource: p.imageSource,
          imageVerifiedAt: p.imageVerifiedAt,
          imagePendingReview: p.imagePendingReview ?? !cover,
          imageReviewReason: p.imageReviewReason,
          source,
        }
      })
      setRemoteResults(nextResults)
      setResultsDrawer('half')
      if (nextResults.length === 0) setSearchError('没有搜索到相关地点，请换个关键词或放宽筛选条件')
    } catch (error) {
      if (requestId !== searchRequestIdRef.current || isAgentRequestCanceled(error)) return
      showLocalSearchFallback(error)
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setSearching(false)
        if (searchAbortRef.current === controller) searchAbortRef.current = null
      }
    }
  }

  const showLocalSearchFallback = (error: unknown) => {
    setRemoteResults(null)
    setResultsDrawer('half')
    const agentMessage = getAgentErrorMessage(error, '')
    const localMessage = filtered.length > 0
      ? '远程搜索暂不可用，已显示当前匹配结果'
      : '远程搜索暂不可用，当前没有找到匹配地点'
    setSearchError(agentMessage ? `${localMessage}。${agentMessage}` : localMessage)
  }

  const resetFilters = () => {
    if (!hasActiveFilters) return
    setActiveCats([])
    setMinRating(0)
    setMaxDistance(40)
    setOpenFilter('全部')
    setKeyword('')
    setRemoteResults(null)
    setSearchError('')
    setActivePoi(null)
    if (favoritesOnly) navigate('/explore', { replace: true })
  }

  const clearSearch = () => {
    setKeyword('')
    setRemoteResults(null)
    setSearchError('')
    setActivePoi(null)
  }

  const openResult = (result: ExploreResult) => {
    if (result.source === 'local') {
      navigate(`/poi/${result.id}`)
      return
    }
    const poi = toRemotePoi(result, currentCity?.id ?? cityId)
    upsertRemotePoi(poi)
    navigate(`/poi/${poi.id}`)
  }

  const handleMarkerClick = (id: string) => {
    setActivePoi(id)
    setResultsDrawer('closed')
  }

  const renderSearchBar = (variant: 'panel' | 'mobile') => {
    const mobile = variant === 'mobile'
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void doSearch()
        }}
        className={`group flex min-w-0 items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white/95 p-1.5 shadow-card backdrop-blur-xl transition duration-[180ms] focus-within:border-brand-300 focus-within:ring-4 focus-within:ring-brand-100/80 ${
          mobile ? 'min-h-12' : 'min-h-11'
        }`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-50 text-slate-400 transition duration-[180ms] group-focus-within:bg-brand-50 group-focus-within:text-brand-600">
          <Search size={17} aria-hidden="true" />
        </span>
        <input
          ref={searchInputRef}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void doSearch()
            }
          }}
          aria-label="搜索地点、景点、美食或关键词"
          placeholder={mobile ? '搜索地点、景点、美食...' : '搜索地点'}
          className="h-9 min-w-0 flex-1 bg-transparent px-1 text-sm font-medium text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
        />
        {keyword && (
          <button
            type="button"
            onClick={clearSearch}
            aria-label="清空搜索关键词"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition duration-[180ms] hover:bg-slate-100 hover:text-slate-600 active:scale-[0.96]"
          >
            <X size={16} />
          </button>
        )}
        <button
          type="submit"
          disabled={searching}
          aria-label="执行地点搜索"
          className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-brand-600 bg-brand-600 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(37,99,235,0.22)] transition duration-[180ms] hover:border-brand-700 hover:bg-brand-700 active:scale-[0.98] active:bg-brand-800 disabled:border-brand-300 disabled:bg-brand-300 disabled:shadow-none ${
            mobile ? 'w-9 px-0' : 'min-w-14 px-2.5'
          }`}
        >
          {searching ? (
            <Loader2 size={16} className="animate-spin" />
          ) : mobile ? (
            <Search size={16} aria-hidden="true" />
          ) : (
            '搜索'
          )}
        </button>
      </form>
    )
  }

  const renderFilterPanel = (mode: 'desktop' | 'mobile') => (
    <div className="space-y-5">
      {favoritesOnly && (
        <section className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
          <p className="flex items-center gap-1.5 font-semibold">
            <Heart size={13} className="fill-rose-500 text-rose-500" aria-hidden="true" />
            查看全部收藏
          </p>
          <p className="mt-1 leading-5 text-rose-600/80">当前仅展示已收藏地点，可继续按城市、分类和评分缩小范围。</p>
        </section>
      )}

      <section>
        <div className="mb-2.5 flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">城市</label>
          <span className="text-xs text-slate-400">{currentCity?.poiCount ?? 0} 个地点</span>
        </div>

        <div className="mb-2 grid grid-cols-4 gap-1">
          {quickCities.map((city) => (
            <button
              key={city.id}
              type="button"
              onClick={() => setCityId(city.id)}
              aria-label={`切换到${city.name}`}
              aria-pressed={cityId === city.id}
              className={`rounded-lg border py-2 text-center text-xs font-medium transition-colors ${
                cityId === city.id
                  ? 'border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-100'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              {city.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 py-1">
          <span className="h-px flex-1 bg-slate-100" />
          <span className="text-[10px] text-slate-400">其他城市</span>
          <span className="h-px flex-1 bg-slate-100" />
        </div>

        <CitySelect
          value={cityId}
          onChange={setCityId}
          groups={cityOptionGroups}
          ariaLabel="选择探索城市"
          showPinyin={false}
          showPoiCount
        />
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">分类</p>
          <span className="text-xs text-slate-400">{activeCats.length ? `${activeCats.length} 项` : '不限'}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {categories.map((category) => {
            const active = activeCats.includes(category.label)
            const Icon = category.icon
            return (
              <button
                key={category.label}
                type="button"
                onClick={() => toggleCat(category.label)}
                aria-label={`${active ? '取消' : '选择'}${category.label}分类`}
                aria-pressed={active}
                className={`flex min-h-10 min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors ${
                  active
                    ? 'border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-100'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700'
                }`}
              >
                <Icon size={15} className="shrink-0" />
                <span className="truncate">{category.label}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">最低评分</p>
        <div className="grid grid-cols-4 gap-1.5 rounded-lg bg-slate-100 p-1">
          {ratingOptions.map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => setMinRating(rating)}
              aria-label={rating === 0 ? '不限最低评分' : `最低评分 ${rating} 分`}
              aria-pressed={minRating === rating}
              className={`flex min-h-9 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium transition-colors ${
                minRating === rating ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {rating === 0 ? (
                '不限'
              ) : (
                <>
                  <Star size={12} className="fill-amber-400 text-amber-400" />
                  {rating}+
                </>
              )}
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">距离范围</label>
          <span className="rounded-md bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700">{maxDistance} km 内</span>
        </div>
        <Slider value={maxDistance} min={1} max={40} onChange={setMaxDistance} />
        <div className="mt-2 flex justify-between text-[11px] text-slate-400">
          <span>近距离</span>
          <span>全城探索</span>
        </div>
      </section>

      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">营业时间</p>
        <div className="grid grid-cols-2 gap-2">
          {openOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setOpenFilter(option)}
              aria-label={`筛选营业时间：${option}`}
              aria-pressed={openFilter === option}
              className={`min-h-10 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                openFilter === option
                  ? 'border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-100'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </section>

      {mode === 'desktop' && (
        <div className="mt-6 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={resetFilters}
            disabled={!hasActiveFilters}
            className="btn-ghost w-full py-2 text-sm"
            aria-label="重置所有过滤条件"
          >
            <RotateCcw size={14} aria-hidden="true" /> 重置过滤
          </button>
        </div>
      )}
    </div>
  )

  const renderSkeletonRows = () => (
    <div className="space-y-3 p-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex gap-3 rounded-lg border border-slate-100 bg-white p-3">
          <div className="h-20 w-24 shrink-0 animate-pulse rounded-lg bg-slate-100" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  )

  const renderResultCard = (result: ExploreResult) => {
    const active = activePoi === result.id
    const openState = getOpenState(result.openingHours)
    const imagePendingReview = hasPendingPlaceImageReview(
      result.cover,
      result.imageConfidence,
      result.imagePendingReview,
    )
    return (
      <button
        key={result.id}
        type="button"
        onMouseEnter={() => setActivePoi(result.id)}
        onFocus={() => setActivePoi(result.id)}
        onClick={() => openResult(result)}
        aria-label={`查看 ${result.name} 详情`}
        className={`group flex w-full min-w-0 gap-3 border-b border-slate-100 px-4 py-3 text-left transition duration-[180ms] hover:bg-slate-50 ${
          active ? 'bg-brand-50/70 shadow-inner ring-1 ring-inset ring-brand-200' : 'bg-white'
        }`}
      >
        <div className="h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-100">
          <SmartImage src={result.cover} alt={result.name} fallbackText={result.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{result.name}</p>
              <p className="mt-0.5 truncate text-[11px] text-slate-400">{result.address ?? currentCity?.name ?? '当前城市'}</p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-amber-500">{result.rating.toFixed(1)}</span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <Stars rating={result.rating} size={11} />
            <span className="text-[11px] text-slate-400">
              {result.reviewCount ? `${result.reviewCount.toLocaleString()} 评` : result.source !== 'local' ? providerResultLabel(result.source) : '暂无评价'}
            </span>
            <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700">{result.category}</span>
            {imagePendingReview && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-100">
                <AlertCircle size={11} /> 图片待确认
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-600">
              <Navigation size={11} /> {formatDistance(result.distance)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-600">
              <Clock size={11} /> {result.suggestedDuration}
            </span>
            <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 ring-1 ${openState.className}`}>{openState.label}</span>
            {normalizeOpeningHours(result.openingHours) && (
              <span className="max-w-full truncate rounded-md bg-slate-50 px-1.5 py-0.5 text-slate-500" title={normalizeOpeningHours(result.openingHours)}>
                {shortOpeningHours(result.openingHours)}
              </span>
            )}
          </div>

          <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{resultReason(result)}</p>
        </div>
      </button>
    )
  }

  const renderResultList = () => (
    <div className="min-w-0">
      {searchError && (
        <div className="m-3 flex gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span className="min-w-0">{searchError}</span>
        </div>
      )}
      {(searching || (loadingLocalPois && displayResults.length === 0)) && renderSkeletonRows()}
      {!searching && displayResults.map(renderResultCard)}
      {!searching && !loadingLocalPois && displayResults.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center">
          {favoritesOnly ? (
            <Heart size={28} className="mb-3 text-slate-200" aria-hidden="true" />
          ) : (
            <Search size={28} className="mb-3 text-slate-200" aria-hidden="true" />
          )}
          <h3 className="text-sm font-semibold text-slate-600">{emptyResultTitle}</h3>
          <p className="mt-1 text-xs text-slate-400">{emptyResultDescription}</p>
          <button type="button" onClick={resetFilters} className="mt-4 text-sm font-medium text-brand-600 hover:text-brand-700">
            {resetFiltersLabel}
          </button>
        </div>
      )}
    </div>
  )

  const renderActivePreview = () => {
    if (!compactViewport || !activeResult || filterOpen || resultsDrawer !== 'closed') return null
    const openState = getOpenState(activeResult.openingHours)
    return (
      <div className="map-glass-panel absolute inset-x-3 bottom-20 z-30 overflow-hidden lg:hidden">
        <div className="flex gap-3 p-3">
          <div className="h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-100">
            <SmartImage src={activeResult.cover} alt={activeResult.name} fallbackText={activeResult.name} className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{activeResult.name}</p>
                <div className="mt-1 flex items-center gap-1">
                  <Stars rating={activeResult.rating} size={11} />
                  <span className="text-xs font-semibold text-amber-500">{activeResult.rating.toFixed(1)}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActivePoi(null)}
                aria-label="关闭地点预览"
                className="flex min-h-9 min-w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px]">
              <span className="rounded-md bg-brand-50 px-1.5 py-0.5 font-medium text-brand-700">{activeResult.category}</span>
              <span className={`rounded-md px-1.5 py-0.5 ring-1 ${openState.className}`}>{openState.label}</span>
              <span className="inline-flex items-center gap-1 text-slate-500">
                <Navigation size={11} /> {formatDistance(activeResult.distance)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => openResult(activeResult)}
              aria-label={`查看 ${activeResult.name} 详情`}
              className="btn-primary mt-3 min-h-10 w-full py-2 text-sm"
            >
              查看详情
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <AppLayout sidebar={false} contentClassName="bg-slate-100">
      {!compactViewport && (
      <div className="page-enter hidden h-[calc(100vh-4rem)] overflow-hidden lg:grid lg:grid-cols-[16rem_minmax(0,1fr)_300px]">
        <aside className="explore-filter-panel min-h-0 overflow-y-auto bg-white p-4">
          <div className="mb-4">
            <p className="section-eyebrow">地图探索</p>
            <h1 className="mt-1 text-base font-semibold text-slate-950">{pageTitle}</h1>
          </div>
          <div className="mb-4">{renderSearchBar('panel')}</div>
          {renderFilterPanel('desktop')}
        </aside>

        <main className="relative min-h-0">
          <MapCanvas markers={markers} onMarkerClick={handleMarkerClick} height="100%" className="!rounded-none !border-0" />
          <div className="absolute left-4 right-4 top-4 z-20 mx-auto max-w-xl">{renderSearchBar('panel')}</div>
          <button type="button" onClick={() => setSearchError('附近定位暂未接入，当前使用地图中心展示周边结果')} className="os-icon-button absolute left-4 top-20 z-20" aria-label="附近定位">
            <Navigation size={16} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => setSearchError('全屏地图暂未接入，当前保持三栏布局')} className="os-icon-button absolute bottom-4 right-4 z-20" aria-label="全屏">
            <Maximize2 size={16} aria-hidden="true" />
          </button>
          <div className="map-glass-panel pointer-events-none absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 px-3 py-2 text-[11px] font-medium text-slate-600">
            <LegendDot color="#2563eb" label="地图" />
            <LegendDot color="#f59e0b" label="收藏" />
            <LegendDot color="#11bfae" label="已加入" />
            <LegendDot color="#e11d48" label="风险" />
          </div>
        </main>

        <aside className="min-h-0 overflow-hidden border-l border-slate-200 bg-white">
          <div className="sticky top-0 z-10 border-b border-slate-100 bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-950">{resultPanelTitle}</p>
              <span className="text-xs text-slate-400">{displayResults.length} 个结果</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{loadingLocalPois ? '正在加载城市 POI 分片' : resultSourceLabel}</p>
          </div>
          <div className="h-full overflow-y-auto pb-16">{renderResultList()}</div>
        </aside>
      </div>
      )}

      {compactViewport && (
      <div className="relative h-[calc(100dvh-7.5rem)] min-h-[640px] overflow-hidden lg:hidden">
        <h1 className="sr-only">地图探索工作台</h1>
        <MapCanvas markers={markers} onMarkerClick={handleMarkerClick} height="100%" className="!rounded-none !border-0" />

        <div className="map-glass-panel pointer-events-none absolute bottom-4 left-1/2 z-30 hidden -translate-x-1/2 items-center gap-3 px-3 py-2 text-[11px] font-medium text-slate-600 lg:flex">
          <LegendDot color="#2563eb" label="默认" />
          <LegendDot color="#2563eb" label="选中" pulse />
          <LegendDot color="#f59e0b" label="收藏" />
          <LegendDot color="#11bfae" label="已加入" />
          <LegendDot color="#e11d48" label="风险" />
        </div>

        <div className="pointer-events-none absolute inset-0 hidden lg:block">
          <aside className="map-glass-panel pointer-events-auto absolute bottom-4 left-4 top-4 flex w-[320px] flex-col overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Sparkles size={16} className="text-brand-600" /> AI 探索工作台
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">搜索、筛选并快速定位可加入路线的地点</p>
                </div>
                <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">{currentCity?.name}</span>
              </div>
              {renderSearchBar('panel')}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{renderFilterPanel('desktop')}</div>
          </aside>

          <aside className="map-glass-panel pointer-events-auto absolute bottom-4 right-4 top-4 flex w-[368px] flex-col overflow-hidden">
            <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/90 px-4 py-3 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <MapPinned size={16} className="text-brand-600" /> {resultPanelTitle}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{resultSourceLabel}</p>
                </div>
                <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{displayResults.length} 个地点</span>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                <BadgeCheck size={14} className="shrink-0 text-emerald-600" />
                <span className="min-w-0 truncate">悬停结果会同步高亮地图标记，点击进入详情。</span>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{renderResultList()}</div>
          </aside>
        </div>

        <div className="absolute inset-x-3 top-3 z-30 lg:hidden">{renderSearchBar('mobile')}</div>

        {searchError && !filterOpen && resultsDrawer === 'closed' && (
          <div className="absolute left-3 right-3 top-[4.25rem] z-30 flex gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 shadow-card lg:hidden">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <span className="min-w-0">{searchError}</span>
          </div>
        )}

        {renderActivePreview()}

        {!filterOpen && resultsDrawer === 'closed' && (
          <div className="pointer-events-none absolute inset-x-3 bottom-4 z-30 flex gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              aria-label="打开筛选抽屉"
              className="btn-ghost pointer-events-auto min-h-11 flex-1 justify-center bg-white/95 px-3 py-2 text-sm shadow-card backdrop-blur"
            >
              <SlidersHorizontal size={16} /> 筛选
            </button>
            <button
              type="button"
              onClick={() => setResultsDrawer('half')}
              aria-label="打开结果抽屉"
              className="btn-primary pointer-events-auto min-h-11 flex-1 justify-center px-3 py-2 text-sm shadow-card"
            >
              <List size={16} /> 结果 {displayResults.length}
            </button>
          </div>
        )}
      </div>
      )}

      {filterOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-slate-900/35" aria-label="关闭筛选抽屉" onClick={() => setFilterOpen(false)} />
          <section className="drawer-panel absolute inset-x-0 bottom-0 mx-auto flex max-h-[86vh] max-w-xl flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">筛选地点</p>
                <p className="mt-0.5 text-xs text-slate-500">当前匹配 {displayResults.length} 个结果</p>
              </div>
              <button
                type="button"
                onClick={() => setFilterOpen(false)}
                aria-label="关闭筛选抽屉"
                className="flex min-h-10 min-w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">{renderFilterPanel('mobile')}</div>
            <div className="flex items-center gap-2 border-t border-slate-100 bg-white px-4 py-3">
              <button
                type="button"
                onClick={resetFilters}
                disabled={!hasActiveFilters}
                aria-label="重置移动端筛选条件"
                className="btn-ghost min-h-11 flex-1 justify-center px-3 py-2 text-sm disabled:border-slate-200 disabled:text-slate-400"
              >
                <RotateCcw size={15} /> 重置
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterOpen(false)
                  setResultsDrawer('half')
                }}
                aria-label={`应用筛选并查看 ${displayResults.length} 个结果`}
                className="btn-primary min-h-11 flex-[1.4] justify-center px-3 py-2 text-sm"
              >
                应用筛选 · {displayResults.length}
              </button>
            </div>
          </section>
        </div>
      )}

      {resultsDrawer !== 'closed' && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-slate-900/25" aria-label="关闭结果抽屉" onClick={() => setResultsDrawer('closed')} />
          <section className={`drawer-panel absolute inset-x-0 bottom-0 mx-auto flex max-w-xl flex-col overflow-hidden transition-[height] duration-200 ${drawerHeightClass}`}>
            <div className="border-b border-slate-100 bg-white px-4 pb-3 pt-2">
              <button
                type="button"
                onClick={() => setResultsDrawer(resultsDrawer === 'collapsed' ? 'half' : 'collapsed')}
                aria-label="切换结果抽屉高度"
                className="mx-auto mb-2 flex min-h-6 w-16 items-center justify-center rounded-full text-slate-300 hover:text-slate-500"
              >
                <span className="h-1 w-10 rounded-full bg-current" />
              </button>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{resultPanelTitle}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {resultSourceLabel} · {displayResults.length} 个地点
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {resultsDrawer !== 'collapsed' && (
                    <button
                      type="button"
                      onClick={() => setResultsDrawer('collapsed')}
                      aria-label="折叠结果抽屉"
                      className="flex min-h-10 min-w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                    >
                      <ChevronDown size={17} />
                    </button>
                  )}
                  {resultsDrawer === 'collapsed' && (
                    <button
                      type="button"
                      onClick={() => setResultsDrawer('half')}
                      aria-label="展开到半屏结果抽屉"
                      className="flex min-h-10 min-w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                    >
                      <ChevronUp size={17} />
                    </button>
                  )}
                  {resultsDrawer === 'half' && (
                    <button
                      type="button"
                      onClick={() => setResultsDrawer('full')}
                      aria-label="展开到全屏结果抽屉"
                      className="flex min-h-10 min-w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                    >
                      <Maximize2 size={17} />
                    </button>
                  )}
                  {resultsDrawer === 'full' && (
                    <button
                      type="button"
                      onClick={() => setResultsDrawer('half')}
                      aria-label="收回到半屏结果抽屉"
                      className="flex min-h-10 min-w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                    >
                      <Minimize2 size={17} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setResultsDrawer('closed')}
                    aria-label="关闭结果抽屉"
                    className="flex min-h-10 min-w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            </div>
            {resultsDrawer !== 'collapsed' ? (
              <div className="min-h-0 flex-1 overflow-y-auto">{renderResultList()}</div>
            ) : (
              <button
                type="button"
                onClick={() => setResultsDrawer('half')}
                aria-label="展开结果列表"
                className="flex min-h-0 flex-1 items-center justify-center px-4 text-xs text-slate-500"
              >
                点击展开列表，或继续在地图上选择地点
              </button>
            )}
          </section>
        </div>
      )}
    </AppLayout>
  )
}

function LegendDot({ color, label, pulse = false }: { color: string; label: string; pulse?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${pulse ? 'node-pulse' : ''}`} style={{ backgroundColor: color, color }} />
      {label}
    </span>
  )
}

function useCompactViewport() {
  const [compact, setCompact] = useState(() => (
    typeof window === 'undefined' ? false : window.matchMedia('(max-width: 1023px)').matches
  ))

  useEffect(() => {
    const query = window.matchMedia('(max-width: 1023px)')
    const sync = () => setCompact(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  return compact
}

function normalizeExploreSource(resultSource: AgentSearchSource, sourceProvider: string | undefined): AgentSearchSource {
  if (sourceProvider === 'amap' || sourceProvider === 'dianping') return sourceProvider
  return resultSource
}

function normalizeRemotePoiId(
  id: string | undefined,
  name: string,
  index: number,
  resultSource: AgentSearchSource,
  provider: string | undefined,
  sourceId: string | undefined,
) {
  const sourceProvider = sanitizeRemoteIdPart(provider || (resultSource === 'multi-provider' ? 'remote' : resultSource))
  const source = sanitizeRemoteIdPart(id || `${name}-${index}`)
  const providerSourceId = sanitizeRemoteIdPart(sourceId || source)
  return `${sourceProvider}-${providerSourceId}`.replace(/[^\w-]+/g, '-')
}

function sanitizeRemoteIdPart(value: string) {
  return String(value || 'remote')
    .trim()
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'remote'
}

function toRemotePoi(result: ExploreResult, cityId: string): Poi {
  const cover = displayPlaceImage(result.cover, result.imageConfidence)
  const sourceLabel = providerResultLabel(result.source)
  const sourceProvider = result.sourceProvider || (result.source === 'local-fallback' ? undefined : result.source)
  const sourceId = result.sourceId || result.id
  const tags = [sourceLabel, result.city, result.district, result.imagePendingReview ? '图片待确认' : ''].filter(Boolean) as string[]
  const openingHours = normalizeOpeningHours(result.openingHours)
  return {
    id: result.id,
    sourceKind: sourceProvider ? 'provider_snapshot' : undefined,
    sourceProvider,
    sourceId,
    rawSnapshotId: result.rawSnapshotId,
    name: result.name,
    cityId,
    category: result.category,
    rating: result.rating,
    reviewCount: result.reviewCount,
    cover,
    images: cover ? [cover] : [],
    imageConfidence: result.imageConfidence,
    imageSource: result.imageSource,
    imageVerifiedAt: result.imageVerifiedAt,
    imagePendingReview: result.imagePendingReview,
    imageReviewReason: result.imageReviewReason,
    tags,
    x: result.x,
    y: result.y,
    lng: result.lng ?? 0,
    lat: result.lat ?? 0,
    address: result.address ?? '暂无详细地址',
    openingHours: openingHours || `${sourceLabel}暂未提供营业时间`,
    ticket: '以现场为准',
    suggestedDuration: result.suggestedDuration,
    suitableFor: '周边探索 / 临时加入行程',
    price: 0,
    distance: result.distance ?? 0,
    aiReason: `这是来自${sourceLabel}的地点结果，可基于当前位置发起导航，也可以加入未完成行程。`,
    description: `${result.name} 位于${result.address ?? result.city ?? '所在城市'}。该地点来自${sourceLabel}，详情信息以服务方实时结果为准。`,
    reviews: [],
  }
}
