import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  CloudRain,
  Clock,
  Hourglass,
  Info,
  Loader2,
  LocateFixed,
  MapPin,
  RefreshCcw,
  Route,
  Send,
  ShieldAlert,
  Sparkles,
  Sun,
  ToggleLeft,
  ToggleRight,
  TrafficCone,
  TrendingUp,
  Users,
  WifiOff,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import MapCanvas from '../components/MapCanvas'
import type { MapMarker, RouteGroup } from '../components/MapCanvas'
import { Card, Tag, Toast } from '../components/ui'
import { RoutePageHeader, StatusPill } from '../components/ui/RouteSystem'
import { requestCurrentLocation } from '../services/locationService'
import type { CurrentLocation, LocationStatus } from '../services/locationService'
import { askRealtimeAssistant, fetchRealtimeSnapshot, isRealtimeRequestCanceled, realtimeErrorStatus, realtimeRetryAfterSeconds } from '../services/realtimeService'
import type {
  RealtimeEventItem,
  RealtimeRecommendationAction,
  RealtimeRecommendationRisk,
  RealtimeRouteLeg,
  RealtimeSnapshot,
  RealtimeStatus,
} from '../services/realtimeService'
import { useApp } from '../store/AppContext'
import type { ChatMessage, EventType, ItineraryDay, ItineraryItem, Trip } from '../types'

const AUTO_REFRESH_SECONDS = 60
const MAX_BACKOFF_SECONDS = 300

const eventMeta: Record<EventType, { icon: LucideIcon; tone: string; bg: string; tagTone: 'red' | 'blue' | 'orange'; action: string }> = {
  交通拥堵: { icon: TrafficCone, tone: 'text-rose-700', bg: 'bg-rose-50', tagTone: 'red', action: '改乘地铁或绕行' },
  天气变化: { icon: CloudRain, tone: 'text-brand-700', bg: 'bg-brand-50', tagTone: 'blue', action: '准备室内备选' },
  排队提醒: { icon: Hourglass, tone: 'text-amber-700', bg: 'bg-amber-50', tagTone: 'orange', action: '错峰或预约' },
  景点拥挤: { icon: Users, tone: 'text-amber-700', bg: 'bg-amber-50', tagTone: 'orange', action: '延后抵达' },
}

const logTone = { info: 'bg-brand-500', success: 'bg-emerald-500', warning: 'bg-amber-500' }
const routeModeLabel = { driving: '驾车', walking: '步行', transit: '公共交通' }

export default function Realtime() {
  const navigate = useNavigate()
  const location = useLocation()
  const { trips } = useApp()
  const activeTrip = useMemo(() => pickActiveTrip(trips), [trips])
  const activeDay = useMemo(() => pickActiveDay(activeTrip), [activeTrip])
  const visibleItems = activeDay?.items ?? []
  const completedCount = visibleItems.filter((item) => item.status === '已完成').length

  const [snapshot, setSnapshot] = useState<RealtimeSnapshot | null>(null)
  const [status, setStatus] = useState<RealtimeStatus>('ready')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null)
  const [countdownSeconds, setCountdownSeconds] = useState(0)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)

  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle')
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation | null>(null)
  const [locationError, setLocationError] = useState('')

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState('')

  const autoRefreshRef = useRef(autoRefreshEnabled)
  const loadingRef = useRef(false)
  const failureCountRef = useRef(0)
  const currentLocationRef = useRef<CurrentLocation | null>(null)
  const locationStatusRef = useRef<LocationStatus>('idle')
  const initialLocationTripIdRef = useRef<string | null>(null)
  const locationRefreshTimerRef = useRef<number | null>(null)
  const realtimeAbortRef = useRef<AbortController | null>(null)
  const realtimeRequestIdRef = useRef(0)
  const assistantAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    autoRefreshRef.current = autoRefreshEnabled
  }, [autoRefreshEnabled])

  useEffect(() => {
    currentLocationRef.current = currentLocation
  }, [currentLocation])

  useEffect(() => {
    locationStatusRef.current = locationStatus
  }, [locationStatus])

  useEffect(() => {
    if (!location.hash) return

    const target = document.getElementById(location.hash.slice(1))
    if (!target) return

    window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [location.hash])

  useEffect(() => {
    return () => {
      realtimeRequestIdRef.current += 1
      realtimeAbortRef.current?.abort()
      realtimeAbortRef.current = null
      assistantAbortRef.current?.abort()
      assistantAbortRef.current = null
      if (locationRefreshTimerRef.current !== null) {
        window.clearTimeout(locationRefreshTimerRef.current)
      }
    }
  }, [])

  const scheduleRefresh = useCallback((delaySeconds: number | null) => {
    if (!delaySeconds) {
      setNextRefreshAt(null)
      setCountdownSeconds(0)
      return
    }

    setNextRefreshAt(Date.now() + delaySeconds * 1000)
    setCountdownSeconds(delaySeconds)
  }, [])

  const loadRealtime = useCallback(async (locationOverride?: CurrentLocation | null) => {
    if (!activeTrip) {
      setSnapshot(null)
      setStatus('no-trip')
      setError('')
      scheduleRefresh(null)
      return
    }

    realtimeAbortRef.current?.abort()
    const controller = new AbortController()
    const requestId = realtimeRequestIdRef.current + 1
    realtimeRequestIdRef.current = requestId
    realtimeAbortRef.current = controller
    loadingRef.current = true
    setLoading(true)
    setError('')

    try {
      const data = await fetchRealtimeSnapshot(activeTrip, locationOverride ?? currentLocationRef.current, {
        signal: controller.signal,
      })
      if (requestId !== realtimeRequestIdRef.current || controller.signal.aborted) return
      setSnapshot(data)
      setStatus(data.status)
      setLastUpdatedAt(data.generatedAt || new Date().toISOString())

      const failed = !data.ok || data.status === 'error' || data.status === 'missing-config'
      if (failed) {
        const nextFailureCount = failureCountRef.current + 1
        failureCountRef.current = nextFailureCount
        scheduleRefresh(autoRefreshRef.current ? backoffSeconds(nextFailureCount) : null)
      } else {
        failureCountRef.current = 0
        scheduleRefresh(autoRefreshRef.current ? AUTO_REFRESH_SECONDS : null)
      }

      setError(data.ok ? '' : firstWarning(data) || statusDescription(data.status))
    } catch (err) {
      if (requestId !== realtimeRequestIdRef.current || isRealtimeRequestCanceled(err)) return
      const retryAfterSeconds = realtimeRetryAfterSeconds(err)
      if (retryAfterSeconds !== null) {
        const rateLimitRetryAfterSeconds = retryAfterSeconds
        failureCountRef.current = 0
        setStatus('error')
        setError(`请求过于频繁，后端要求等待 ${formatRetryAfterLabel(rateLimitRetryAfterSeconds)} 后自动恢复。`)
        setLastUpdatedAt(new Date().toISOString())
        scheduleRefresh(autoRefreshRef.current ? rateLimitRetryAfterSeconds : null)
        return
      }
      const nextFailureCount = failureCountRef.current + 1
      failureCountRef.current = nextFailureCount
      setStatus(realtimeErrorStatus(err))
      setError(err instanceof Error ? err.message : String(err))
      setLastUpdatedAt(new Date().toISOString())
      scheduleRefresh(autoRefreshRef.current ? backoffSeconds(nextFailureCount) : null)
    } finally {
      if (requestId === realtimeRequestIdRef.current) {
        loadingRef.current = false
        setLoading(false)
        if (realtimeAbortRef.current === controller) realtimeAbortRef.current = null
      }
    }
  }, [activeTrip, scheduleRefresh])

  const requestLocation = useCallback(async (options: { refreshRealtime?: boolean; fallbackToTrip?: boolean } = {}) => {
    if (locationStatusRef.current === 'requesting') return

    locationStatusRef.current = 'requesting'
    setLocationStatus('requesting')
    setLocationError('')

    const result = await requestCurrentLocation()
    locationStatusRef.current = result.status
    setLocationStatus(result.status)

    if (result.status === 'success' && result.location) {
      const location = result.location
      currentLocationRef.current = location
      setCurrentLocation(location)
      setLocationError('')
      if (options.refreshRealtime === false) return
      if (locationRefreshTimerRef.current !== null) {
        window.clearTimeout(locationRefreshTimerRef.current)
      }
      const retryRefresh = () => {
        if (loadingRef.current) {
          locationRefreshTimerRef.current = window.setTimeout(retryRefresh, 300)
          return
        }
        locationRefreshTimerRef.current = null
        void loadRealtime(location)
      }
      retryRefresh()
      return
    }

    currentLocationRef.current = null
    setCurrentLocation(null)
    setLocationError(result.error || locationStatusLabel(result.status))
    if (options.fallbackToTrip) {
      void loadRealtime(null)
    }
  }, [loadRealtime])

  useEffect(() => {
    failureCountRef.current = 0

    if (!activeTrip) {
      initialLocationTripIdRef.current = null
      void loadRealtime(null)
      return
    }

    if (initialLocationTripIdRef.current === activeTrip.id) return
    initialLocationTripIdRef.current = activeTrip.id
    void requestLocation({ refreshRealtime: true, fallbackToTrip: true })
  }, [activeTrip, loadRealtime, requestLocation])

  useEffect(() => {
    if (!activeTrip || !autoRefreshEnabled) {
      scheduleRefresh(null)
      return
    }

    if (nextRefreshAt === null && !loadingRef.current && locationStatusRef.current !== 'requesting') {
      scheduleRefresh(AUTO_REFRESH_SECONDS)
    }
  }, [activeTrip, autoRefreshEnabled, nextRefreshAt, scheduleRefresh])

  useEffect(() => {
    if (!activeTrip || !autoRefreshEnabled || nextRefreshAt === null) return

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1000))
      setCountdownSeconds(remaining)
      if (remaining === 0 && !loadingRef.current) {
        void loadRealtime()
      }
    }

    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [activeTrip, autoRefreshEnabled, nextRefreshAt, loadRealtime])

  const currentLocationDisplayPoint = useMemo(() => {
    return currentLocation ? deriveCurrentLocationDisplayPoint(currentLocation, visibleItems) : null
  }, [currentLocation, visibleItems])

  const markers = useMemo(() => {
    const itemMarkers: MapMarker[] = visibleItems.map((item, index) => ({
      id: item.id,
      x: item.x,
      y: item.y,
      lng: item.lng,
      lat: item.lat,
      label: item.name,
      color: item.color,
      order: index + 1,
      active: item.status === '进行中',
    }))

    if (currentLocation) {
      const point = currentLocationDisplayPoint ?? { x: 50, y: 50 }
      itemMarkers.push({
        id: 'current-location',
        x: point.x,
        y: point.y,
        lng: currentLocation.lng,
        lat: currentLocation.lat,
        label: '当前位置',
        color: '#0f766e',
        active: true,
      })
    }

    return itemMarkers
  }, [currentLocation, currentLocationDisplayPoint, visibleItems])

  const routeGroups = useMemo<RouteGroup[]>(() => {
    if (snapshot?.route?.legs?.length) {
      return snapshot.route.legs.map((leg) => ({
        color: leg.trafficStatus && leg.trafficStatus !== '畅通' ? '#f97316' : '#2563eb',
        points: normalizeLegPolyline(leg, currentLocationDisplayPoint),
      }))
    }
    return [{ color: '#94a3b8', points: visibleItems.map((item) => toMapPoint(item)) }]
  }, [currentLocationDisplayPoint, snapshot, visibleItems])

  const send = async () => {
    if (!input.trim() || sending || !activeTrip) return
    const question = input.trim()
    const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    const nextMessages = [...messages, { id: `u-${Date.now()}`, role: 'user' as const, text: question, time }]
    setMessages(nextMessages)
    setInput('')
    setSending(true)
    assistantAbortRef.current?.abort()
    const controller = new AbortController()
    assistantAbortRef.current = controller

    try {
      const reply = await askRealtimeAssistant({
        question,
        trip: activeTrip,
        snapshot,
        messages: nextMessages,
        currentLocation,
        signal: controller.signal,
      })
      if (assistantAbortRef.current !== controller || controller.signal.aborted) return
      setMessages((items) => [...items, { id: `a-${Date.now()}`, role: 'assistant', text: reply, time }])
    } catch (error) {
      if (assistantAbortRef.current !== controller || isRealtimeRequestCanceled(error)) return
      setMessages((items) => [
        ...items,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: '暂无实时建议。当前模型或实时上下文不可用。',
          time,
        },
      ])
    } finally {
      if (assistantAbortRef.current === controller) {
        assistantAbortRef.current = null
        setSending(false)
      }
    }
  }

  const prepareEventAction = (event: RealtimeEventItem) => {
    setInput(`${event.affectedPoi} 受到${event.type}影响，请给出可执行调整方案。`)
  }

  const nextRefreshLabel = autoRefreshEnabled
    ? activeTrip
      ? loading
        ? '刷新中'
        : `${Math.max(0, countdownSeconds)} 秒后`
      : '无行程'
    : '已关闭'
  const lastUpdatedLabel = lastUpdatedAt ? formatDateTime(lastUpdatedAt) : '暂无'
  const serviceUnavailable = !loading && (status === 'error' || status === 'missing-config' || (!snapshot && Boolean(error)))
  const noTrip = !loading && status === 'no-trip'
  const realtimeEvents = snapshot?.events ?? []
  const recommendationActions = snapshot?.recommendation?.actions ?? []
  const previewableRecommendationActions = recommendationActions.filter((action) => action.canApply)
  const canPreviewRecommendation = previewableRecommendationActions.length > 0
  const showEmptyEvents = !loading && !serviceUnavailable && !noTrip && Boolean(snapshot?.ok) && realtimeEvents.length === 0
  const showUnavailableCards = !loading && !serviceUnavailable && !noTrip && Boolean(snapshot?.unavailable)
  const currentNode = visibleItems.find((item) => item.status === '进行中') ?? visibleItems[0]

  return (
    <AppLayout sidebar={false}>
      <div className="flex min-w-0 xl:h-[calc(100vh-4rem)] xl:overflow-hidden">
        <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-4 xl:block">
          <h2 className="mb-1 text-sm font-semibold text-slate-800">当前行程</h2>
          <p className="mb-3 text-xs text-slate-400">{activeTrip?.title ?? '暂无当前行程'}</p>
          <Card className="mb-4 bg-brand-50/60 p-3">
            <p className="text-xs text-slate-500">行程进度</p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-brand-600" style={{ width: visibleItems.length ? `${(completedCount / visibleItems.length) * 100}%` : '0%' }} />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">已完成 {completedCount} / {visibleItems.length} 个地点</p>
          </Card>
          <ol className="relative space-y-3 border-l border-dashed border-slate-200 pl-4">
            {visibleItems.map((item) => (
              <li key={item.id} className="relative">
                <span className="absolute -left-[22px] top-1 h-3 w-3 rounded-full border-2 border-white" style={{ backgroundColor: item.color }} />
                <p className="text-xs font-medium text-slate-400">{item.time}</p>
                <p className="text-sm text-slate-700">{item.name}</p>
                <Tag tone={item.status === '已完成' ? 'green' : item.status === '进行中' ? 'blue' : 'gray'} className="mt-0.5">{item.status}</Tag>
              </li>
            ))}
            {visibleItems.length === 0 && <li className="text-sm text-slate-400">暂无行程节点</li>}
          </ol>
        </aside>

        <div className="min-w-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 lg:px-6 lg:py-6">
          <div className="mb-5">
            <RoutePageHeader
              eyebrow="Realtime Operations"
              title="实时动态与智能调整"
              description={snapshot?.ok ? '实时数据来自高德地图、路径规划、交通态势与天气接口。' : statusDescription(status)}
              status={<RealtimeStatusTag status={status} loading={loading} />}
              statusTone={status === 'ready' ? 'emerald' : status === 'partial' ? 'amber' : 'rose'}
              meta={
                <>
                  <StatusPill tone={autoRefreshEnabled ? 'emerald' : 'slate'}>自动刷新 {autoRefreshEnabled ? '开启' : '关闭'}</StatusPill>
                  <StatusPill tone={currentLocation ? 'emerald' : 'amber'}>当前位置 {locationStatusLabel(locationStatus)}</StatusPill>
                  {snapshot?.recommendation && <Tag tone="blue">AI 建议已生成</Tag>}
                </>
              }
              actions={
                <button
                  type="button"
                  onClick={() => void loadRealtime()}
                  disabled={loading || !activeTrip}
                  className="btn-ghost min-h-10 justify-center px-3 py-2 text-sm disabled:border-slate-200 disabled:text-slate-400"
                  aria-label="手动刷新实时快照"
                >
                  {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCcw size={15} />}
                  手动刷新
                </button>
              }
            />
            {error && <p className="mt-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">{error}</p>}
          </div>

          <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <RealtimeMetric icon={Route} label="行程进度" value={activeDay ? `第${activeDay.day}天 Day ${activeDay.day}` : '暂无行程'} detail={`共${activeTrip?.days ?? 0}天行程`} tone="brand" />
            <RealtimeMetric icon={MapPin} label="当前节点" value={currentNode?.name ?? '暂无节点'} detail={currentNode ? `预计停留 ${currentNode.duration}` : '请先创建行程'} tone="locate" />
            <div id="weather-status" className="scroll-mt-28">
              <RealtimeMetric
                icon={Sun}
                label="天气状况"
                value={snapshot?.weather ? `${snapshot.weather.weather} ${snapshot.weather.temperature}°C` : '暂无实时天气数据'}
                detail={snapshot?.weather ? '高德天气已更新' : '等待实时天气接口返回'}
                tone="notice"
              />
            </div>
            <RealtimeMetric
              icon={ShieldAlert}
              label="风险预警"
              value={realtimeEvents.length > 0 ? `${realtimeEvents.length}条提醒` : '0条提醒'}
              detail={realtimeEvents[0]?.title ?? '暂无提醒'}
              tone="risk"
            />
          </div>

          <div className="command-surface mb-5 p-4">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
                <Sparkles size={16} className="text-white" aria-hidden="true" />
              </div>
              <div>
                <p className="section-eyebrow">AI 智能调整</p>
                <h2 className="text-base font-semibold text-slate-950">{canPreviewRecommendation ? '发现真实可执行建议' : '暂无可执行建议'}</h2>
              </div>
              <span className="status-dot-live ml-auto" />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <RouteCompare title="当前路线" items={visibleItems.slice(0, 3).map((item) => item.name)} />
              <RouteCompare title="建议预览" items={previewableRecommendationActions.map((item) => item.label)} emptyLabel="暂无可执行建议" highlight />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setToast('已确认保持当前路线，不作调整')
                }}
                className="btn-ghost flex-1"
                aria-label="保持当前路线，不采纳建议"
              >
                保持当前路线
              </button>
              <button
                type="button"
                onClick={() => {
                  document.getElementById('realtime-recommendation')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  setToast('当前仅预览 AI 建议，不会修改行程节点')
                }}
                disabled={!canPreviewRecommendation}
                className="btn-primary flex-1 disabled:bg-slate-300 disabled:text-white"
                aria-label="预览 AI 调整建议"
              >
                <CheckCircle2 size={16} aria-hidden="true" />
                {canPreviewRecommendation ? '预览调整建议' : '暂无可执行建议'}
              </button>
            </div>
          </div>

          <div className="mb-5 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatusCard icon={Clock} label="最后更新时间" value={lastUpdatedLabel} />
            <StatusCard icon={RefreshCcw} label="下次刷新" value={nextRefreshLabel} />
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">自动刷新</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{autoRefreshEnabled ? '已开启' : '已关闭'}</p>
                </div>
                <button
                  type="button"
                  aria-pressed={autoRefreshEnabled}
                  onClick={() => setAutoRefreshEnabled((value) => !value)}
                  className="btn-ghost px-2.5 py-2 text-xs"
                >
                  {autoRefreshEnabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  {autoRefreshEnabled ? '开启' : '关闭'}
                </button>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">基础间隔 60 秒，连续失败退避到 120/240/300 秒。</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">当前位置</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{locationStatusLabel(locationStatus)}</p>
                </div>
                <Tag tone={locationStatusTone(locationStatus)}>{locationStatusLabel(locationStatus)}</Tag>
              </div>
              <button
                type="button"
                onClick={() => void requestLocation()}
                disabled={locationStatus === 'requesting' || locationStatus === 'unsupported'}
                className="btn-ghost mt-3 w-full justify-center px-3 py-2 text-sm disabled:border-slate-200 disabled:text-slate-400"
              >
                {locationStatus === 'requesting' ? <Loader2 size={15} className="animate-spin" /> : <LocateFixed size={15} />}
                {currentLocation ? '重新定位' : '获取当前位置'}
              </button>
              {locationError && <p className="mt-2 text-xs text-amber-600">{locationError}</p>}
              {currentLocation && (
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {locationCoordinateLabel(currentLocation)} {currentLocation.lng.toFixed(5)}, {currentLocation.lat.toFixed(5)} · 精度约 {currentLocation.accuracy} m
                </p>
              )}
            </Card>
          </div>

          <RealtimeSourceSnapshot snapshot={snapshot} loading={loading} />

          <div className="mb-5 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {loading && (
              <div className="flex items-center gap-2 text-xs leading-5 text-slate-500 sm:col-span-2 xl:col-span-4">
                <Loader2 size={14} className="shrink-0 animate-spin text-brand-600" />
                <span>正在获取实时风险事件…</span>
              </div>
            )}
            {loading && Array.from({ length: 4 }).map((_, index) => <EventSkeleton key={index} />)}
            {serviceUnavailable && (
              <RealtimeServiceStateCard
                status={status}
                description={statusDescription(status)}
                onRetry={() => void loadRealtime()}
              />
            )}
            {noTrip && (
              <NoTripStateCard
                onCreate={() => navigate('/new-trip')}
                onSelect={() => navigate('/trips')}
              />
            )}
            {!loading && !serviceUnavailable && !noTrip && realtimeEvents.map((event) => <EventCard key={event.id} event={event} onAction={prepareEventAction} />)}
            {showEmptyEvents && (
              <EmptyStateCard icon={CheckCircle2} title="暂无实时风险事件" description="高德实时接口当前未返回需要提醒的交通或天气风险。" />
            )}
            {showUnavailableCards && snapshot?.unavailable && (
              <>
                <UnavailableCard icon={Hourglass} title={snapshot.unavailable.queue.label} description={snapshot.unavailable.queue.message} />
                <UnavailableCard icon={Users} title={snapshot.unavailable.crowd.label} description={snapshot.unavailable.crowd.message} />
              </>
            )}
          </div>

          <div className="grid min-w-0 gap-5 xl:grid-cols-3">
            <div id="route-status" className="scroll-mt-28 lg:col-span-2">
              <Card className="h-full p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white"><Route size={15} /></span>
                <h3 className="text-base font-semibold text-slate-800">实时路线概况</h3>
                <Tag tone={snapshot?.route ? 'blue' : 'gray'} className="ml-1">{snapshot?.route ? '高德路径规划' : '暂无路线数据'}</Tag>
                {currentLocation && <Tag tone="green">已接入当前位置</Tag>}
              </div>

              <div className="grid items-start gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <MapCanvas markers={markers} routeGroups={routeGroups} height="280px" />
                <div className="space-y-3">
                  <MetricRow icon={Clock} label="预计耗时" value={snapshot?.route?.durationText ?? '暂无实时数据'} />
                  <MetricRow icon={MapPin} label="路线距离" value={snapshot?.route?.distanceText ?? '暂无实时数据'} />
                  <MetricRow icon={TrafficCone} label="拥堵路段" value={snapshot?.route ? `${snapshot.route.congestionLegs} 段` : '暂无实时数据'} />
                  <MetricRow icon={CloudRain} label="当前天气" value={formatWeather(snapshot)} />
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {snapshot?.route?.legs.map((leg, index) => (
                  <div key={`${leg.from.name}-${leg.to.name}-${index}`} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-800">{leg.from.name} → {leg.to.name}</p>
                      <Tag tone={leg.trafficStatus && leg.trafficStatus !== '畅通' ? 'orange' : 'green'}>{leg.trafficStatus || routeModeLabel[leg.mode]}</Tag>
                    </div>
                    <p className="text-xs text-slate-500">{routeModeLabel[leg.mode]} · {leg.durationText} · {leg.distanceText}</p>
                    {leg.trafficDescription && <p className="mt-1 text-xs text-slate-400">{leg.trafficDescription}</p>}
                  </div>
                ))}
                {!snapshot?.route && (
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-500">
                    {loading ? '正在请求高德路径规划接口。' : '暂无可用路线数据，请确认当前行程节点包含经纬度且后端高德 Key 已配置。'}
                  </div>
                )}
              </div>
              </Card>
            </div>

            <Card className="flex max-h-[560px] flex-col p-0">
              <div className="flex items-center gap-2 border-b border-slate-100 p-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white"><Bot size={16} /></span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">智行助手</p>
                  <p className="text-xs text-slate-500">基于当前行程与实时接口结果回答</p>
                </div>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.length === 0 && (
                  <div className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                    输入问题后，助手会读取当前行程、当前位置、天气、路线和路况结果；没有实时数据的字段会明确说明暂无实时数据。
                  </div>
                )}
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${message.role === 'user' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                      {message.text}
                    </div>
                  </div>
                ))}
                {sending && <p className="text-xs text-slate-400">助手正在读取实时数据...</p>}
              </div>
              <div className="flex items-center gap-2 border-t border-slate-100 p-3">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && void send()}
                  placeholder="询问当前路线、天气或交通..."
                  className="input"
                  aria-label="询问当前路线、天气或交通"
                />
                <button onClick={() => void send()} disabled={sending || !activeTrip} className="btn-primary shrink-0 px-3 py-2 disabled:bg-slate-300" aria-label="发送给智行助手">
                  <Send size={16} />
                </button>
              </div>
            </Card>
          </div>

          <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <h3 className="mb-4 text-base font-semibold text-slate-800">实时更新记录</h3>
              <ol className="relative space-y-4 border-l border-slate-200 pl-5">
                {snapshot?.logs.map((log) => (
                  <li key={log.id} className="relative">
                    <span className={`absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-white ${logTone[log.type]}`} />
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">{log.title}</span>
                      <span className="text-xs text-slate-400">{log.time}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">{log.detail}</p>
                  </li>
                ))}
                {!snapshot?.logs.length && (
                  <li className="text-sm text-slate-500">{loading ? '正在获取实时更新记录。' : '暂无更新记录。'}</li>
                )}
              </ol>
            </Card>

            <div id="realtime-recommendation" className="scroll-mt-28">
              <RecommendationCard recommendation={snapshot?.recommendation ?? null} loading={loading} />
            </div>
          </div>
        </div>
      </div>
      <Toast message={toast} onClose={() => setToast('')} />
    </AppLayout>
  )
}

function RealtimeMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: string
  detail: string
  tone: 'brand' | 'locate' | 'notice' | 'risk'
}) {
  const toneClass = {
    brand: 'text-brand-600 bg-brand-50',
    locate: 'text-locate-600 bg-locate-50',
    notice: 'text-notice-600 bg-notice-50',
    risk: 'text-risk-600 bg-risk-50',
  }[tone]

  return (
    <div className="metric-tile">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-slate-400">{label}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneClass}`}>
          <Icon size={16} aria-hidden="true" />
        </span>
      </div>
      <p className="truncate text-lg font-semibold text-slate-950">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{detail}</p>
    </div>
  )
}

function RouteCompare({ title, items, emptyLabel = '暂无节点', highlight = false }: { title: string; items: string[]; emptyLabel?: string; highlight?: boolean }) {
  const displayItems = items.length ? items.slice(0, 4) : [emptyLabel]
  return (
    <div className={`rounded-card border p-3 ${highlight ? 'border-brand-200 bg-brand-50/50' : 'border-slate-200 bg-white'}`}>
      <p className={`mb-2 text-xs font-semibold ${highlight ? 'text-brand-600' : 'text-slate-500'}`}>
        {title} {highlight && <Tag tone="blue">优化</Tag>}
      </p>
      <div className="space-y-2">
        {displayItems.map((item, index) => (
          <div key={`${title}-${item}-${index}`} className="flex items-center gap-2 text-sm text-slate-600">
            <span className={`h-2 w-2 rounded-full ${highlight ? 'bg-brand-500' : 'bg-slate-300'}`} />
            <span className="min-w-0 truncate">{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function pickActiveTrip(trips: Trip[]) {
  return trips.find((trip) => trip.status !== '已完成' && trip.itinerary.some((day) => day.items.length > 0)) ??
    trips.find((trip) => trip.itinerary.some((day) => day.items.length > 0)) ??
    null
}

function pickActiveDay(trip: Trip | null): ItineraryDay | null {
  if (!trip) return null
  const today = new Date().toISOString().slice(0, 10)
  return trip.itinerary.find((day) => day.date === today && day.items.length > 0) ??
    trip.itinerary.find((day) => day.items.length > 0) ??
    null
}

function toMapPoint(item: ItineraryItem) {
  return { x: item.x, y: item.y, lng: item.lng, lat: item.lat }
}

function normalizeLegPolyline(leg: RealtimeRouteLeg, currentLocationDisplayPoint: { x: number; y: number } | null) {
  const points = leg.polyline.length > 1 ? leg.polyline : [leg.from, leg.to]
  const fromX = leg.from.id === 'current-location' && currentLocationDisplayPoint ? currentLocationDisplayPoint.x : leg.from.x ?? 50
  const fromY = leg.from.id === 'current-location' && currentLocationDisplayPoint ? currentLocationDisplayPoint.y : leg.from.y ?? 50

  return points.map((point, index) => {
    const ratio = points.length > 1 ? index / (points.length - 1) : 0
    return {
      x: interpolate(fromX, leg.to.x ?? 50, ratio),
      y: interpolate(fromY, leg.to.y ?? 50, ratio),
      lng: point.lng,
      lat: point.lat,
    }
  })
}

function deriveCurrentLocationDisplayPoint(location: CurrentLocation, items: ItineraryItem[]) {
  const geoItems = items.filter((item) => Number.isFinite(item.lng) && Number.isFinite(item.lat))
  if (geoItems.length === 0) return { x: 50, y: 50 }

  const lngs = [location.lng, ...geoItems.map((item) => item.lng)]
  const lats = [location.lat, ...geoItems.map((item) => item.lat)]
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const lngSpan = Math.max(maxLng - minLng, 0.0001)
  const latSpan = Math.max(maxLat - minLat, 0.0001)

  return {
    x: clamp(10 + ((location.lng - minLng) / lngSpan) * 80, 8, 92),
    y: clamp(90 - ((location.lat - minLat) / latSpan) * 80, 8, 92),
  }
}

function interpolate(start: number, end: number, ratio: number) {
  return start + (end - start) * ratio
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function backoffSeconds(failureCount: number) {
  return Math.min(AUTO_REFRESH_SECONDS * 2 ** Math.max(0, failureCount - 1), MAX_BACKOFF_SECONDS)
}

function firstWarning(snapshot: RealtimeSnapshot) {
  return snapshot.warnings?.[0] ?? ''
}

function statusDescription(status: RealtimeStatus) {
  if (status === 'missing-config') return '配置缺失：请配置 Agent token 与后端高德 Web Service Key。'
  if (status === 'no-trip') return '暂无当前行程，无法请求实时路线与天气。'
  if (status === 'partial') return '部分实时接口请求失败，页面仅展示已获取到的真实数据。'
  if (status === 'error') return '接口请求失败，请稍后重试。'
  return '实时数据来自高德地图、路径规划、交通态势与天气接口。'
}

function statusLabel(status: RealtimeStatus) {
  if (status === 'missing-config') return '配置缺失'
  if (status === 'no-trip') return '暂无行程'
  if (status === 'partial') return '部分可用'
  if (status === 'error') return '请求失败'
  return '已更新'
}

function locationStatusLabel(status: LocationStatus) {
  if (status === 'requesting') return '定位中'
  if (status === 'success') return '定位成功'
  if (status === 'denied') return '定位未授权'
  if (status === 'failed') return '定位失败'
  if (status === 'unsupported') return '浏览器不支持定位'
  return '未请求定位'
}

function locationStatusTone(status: LocationStatus): 'green' | 'blue' | 'orange' | 'red' | 'gray' {
  if (status === 'success') return 'green'
  if (status === 'requesting') return 'blue'
  if (status === 'denied') return 'orange'
  if (status === 'failed' || status === 'unsupported') return 'red'
  return 'gray'
}

function locationCoordinateLabel(location: CurrentLocation) {
  return location.coordinateSystem === 'GCJ-02' ? '高德坐标' : '浏览器坐标'
}

function formatWeather(snapshot: RealtimeSnapshot | null) {
  if (!snapshot?.weather) return '暂无实时数据'
  return `${snapshot.weather.weather} ${snapshot.weather.temperature}℃`
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '暂无'
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatRetryAfterLabel(seconds: number) {
  const normalized = Math.max(1, Math.ceil(seconds))
  if (normalized < 60) return `${normalized} 秒`

  const minutes = Math.floor(normalized / 60)
  const rest = normalized % 60
  return rest ? `${minutes} 分 ${rest} 秒` : `${minutes} 分钟`
}

function RealtimeStatusTag({ status, loading }: { status: RealtimeStatus; loading: boolean }) {
  if (loading) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-600">
        <Loader2 size={12} className="animate-spin" /> 加载中
      </span>
    )
  }

  const tone = status === 'ready' ? 'bg-emerald-50 text-emerald-600' : status === 'partial' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
  return <span className={`rounded-full px-2 py-0.5 text-xs ${tone}`}>{statusLabel(status)}</span>
}

function RealtimeSourceSnapshot({ snapshot, loading }: { snapshot: RealtimeSnapshot | null; loading: boolean }) {
  if (!snapshot) {
    return (
      <Card className="mb-5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <WifiOff size={16} />}
          </span>
          <div>
            <p className="section-eyebrow">真实数据源</p>
            <h3 className="text-base font-semibold text-slate-800">{loading ? '正在请求实时接口' : '尚未获取实时快照'}</h3>
          </div>
        </div>
        <p className="text-xs leading-5 text-slate-500">天气、路线和路况会在 Agent 返回快照后展示来源与可用状态。</p>
      </Card>
    )
  }

  const sourceRows = [
    { label: '路线规划', source: snapshot.sources.route, ready: Boolean(snapshot.route), detail: snapshot.route?.durationText ?? '暂无路线结果' },
    { label: '实时天气', source: snapshot.sources.weather, ready: Boolean(snapshot.weather), detail: snapshot.weather ? `${snapshot.weather.weather} ${snapshot.weather.temperature}℃` : '暂无天气结果' },
    { label: '交通态势', source: snapshot.sources.traffic, ready: Boolean(snapshot.traffic), detail: snapshot.traffic?.description || snapshot.traffic?.status || '暂无路况结果' },
    { label: 'AI 建议', source: snapshot.sources.ai, ready: Boolean(snapshot.recommendation), detail: snapshot.recommendation ? `${snapshot.recommendation.actions.length} 条建议` : '暂无 AI 建议' },
    { label: snapshot.unavailable.queue.label, source: snapshot.sources.queue, ready: false, detail: snapshot.unavailable.queue.message },
    { label: snapshot.unavailable.crowd.label, source: snapshot.sources.crowd, ready: false, detail: snapshot.unavailable.crowd.message },
  ]

  return (
    <Card className="mb-5 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={16} />
          </span>
          <div>
            <p className="section-eyebrow">真实数据源</p>
            <h3 className="text-base font-semibold text-slate-800">实时快照来源</h3>
          </div>
        </div>
        <Tag tone={snapshot.status === 'ready' ? 'green' : snapshot.status === 'partial' ? 'orange' : 'gray'}>{statusLabel(snapshot.status)}</Tag>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sourceRows.map((row) => (
          <div key={row.label} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800">{row.label}</span>
              <Tag tone={row.ready ? 'green' : 'gray'}>{row.ready ? '已接入' : '无结果'}</Tag>
            </div>
            <p className="truncate text-xs text-slate-500">{row.source}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{row.detail}</p>
          </div>
        ))}
      </div>
      {snapshot.warnings?.length ? (
        <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
          <span className="font-semibold">部分真实接口未返回：</span>{snapshot.warnings.slice(0, 2).join('；')}
        </div>
      ) : null}
    </Card>
  )
}

function StatusCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <Icon size={17} />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-800">{value}</p>
        </div>
      </div>
    </Card>
  )
}

function EventCard({ event, onAction }: { event: RealtimeEventItem; onAction: (event: RealtimeEventItem) => void }) {
  const meta = eventMeta[event.type]
  const Icon = meta.icon
  return (
    <Card className={`p-4 ${event.level === '高' ? 'border-rose-200' : event.level === '中' ? 'border-amber-200' : ''}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${meta.bg} ${meta.tone}`}>
          <Icon size={18} />
        </span>
        <div className="flex min-w-0 flex-wrap justify-end gap-1.5">
          <Tag tone={meta.tagTone} className="shrink-0">{event.type}</Tag>
          <Tag tone={event.level === '高' ? 'red' : event.level === '中' ? 'orange' : 'gray'} className="shrink-0">
            {event.level}风险
          </Tag>
        </div>
      </div>
      <p className="text-sm font-semibold text-slate-800">{event.title}</p>
      <p className="mt-1 line-clamp-2 text-xs text-slate-400">{event.description}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">{event.time} · {event.affectedPoi}</span>
        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200">建议：{meta.action}</span>
      </div>
      <button
        type="button"
        onClick={() => onAction(event)}
        className="mt-3 inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-slate-950 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
        aria-label={`生成${event.title}的调整方案`}
      >
        生成调整方案
      </button>
      {event.source && <p className="mt-1 text-[11px] text-slate-400">来源：{event.source}</p>}
    </Card>
  )
}

function EmptyStateCard({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <Card className="p-4">
      <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
        <Icon size={18} />
      </span>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
    </Card>
  )
}

function RealtimeServiceStateCard({ status, description, onRetry }: { status: RealtimeStatus; description: string; onRetry: () => void }) {
  const missingConfig = status === 'missing-config'
  const toneClass = missingConfig
    ? 'border-amber-100 bg-amber-50/70 text-amber-700'
    : 'border-rose-100 bg-rose-50/70 text-rose-700'
  const title = missingConfig ? '实时配置缺失' : '实时服务未连接'

  return (
    <Card className={`p-4 sm:col-span-2 xl:col-span-4 ${missingConfig ? 'border-amber-100 bg-amber-50/40' : 'border-rose-100 bg-rose-50/40'}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneClass}`}>
            <WifiOff size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">{title}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="btn-ghost min-h-9 w-full justify-center px-3 py-2 text-sm sm:w-auto"
          aria-label="重试获取实时风险事件"
        >
          <RefreshCcw size={15} />
          重试
        </button>
      </div>
    </Card>
  )
}

function NoTripStateCard({ onCreate, onSelect }: { onCreate: () => void; onSelect: () => void }) {
  return (
    <Card className="p-4 sm:col-span-2 xl:col-span-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Route size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">暂无可用行程</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">请先创建或选择包含节点的行程，再查看实时风险事件。</p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={onCreate}
            className="btn-primary min-h-9 justify-center px-3 py-2 text-sm"
            aria-label="创建包含节点的新行程"
          >
            创建行程
          </button>
          <button
            type="button"
            onClick={onSelect}
            className="btn-ghost min-h-9 justify-center px-3 py-2 text-sm"
            aria-label="选择已有行程"
          >
            选择行程
          </button>
        </div>
      </div>
    </Card>
  )
}

function UnavailableCard({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <Card className="p-4">
      <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon size={18} />
      </span>
      <div className="mb-1 flex items-center gap-2">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <Tag tone="gray">暂无实时数据</Tag>
      </div>
      <p className="text-xs leading-5 text-slate-500">{description}</p>
    </Card>
  )
}

function EventSkeleton() {
  return (
    <Card className="p-4">
      <div className="mb-3 h-9 w-9 animate-pulse rounded-lg bg-slate-100" />
      <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
      <div className="mt-2 h-3 w-full animate-pulse rounded bg-slate-100" />
      <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-slate-100" />
    </Card>
  )
}

function MetricRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
      <Icon size={16} className="shrink-0 text-brand-600" />
      <span className="text-sm text-slate-600">{label}</span>
      <span className="ml-auto text-right text-sm font-semibold text-slate-800">{value}</span>
    </div>
  )
}

function ImpactRow({ icon: Icon, tone, label, value }: { icon: LucideIcon; tone: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={16} className={tone} />
      <span className="text-sm text-slate-600">{label}</span>
      <span className="ml-auto text-sm font-semibold text-slate-800">{value}</span>
    </div>
  )
}

function RecommendationCard({ recommendation, loading }: { recommendation: RealtimeSnapshot['recommendation']; loading: boolean }) {
  const risks = recommendation?.risks ?? []
  const actions = recommendation?.actions ?? []

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white"><Sparkles size={15} /></span>
        <h3 className="text-base font-semibold text-slate-800">AI 可执行建议</h3>
        {recommendation && <Tag tone="blue">{recommendation.source}</Tag>}
      </div>
      <p className="text-sm leading-6 text-slate-600">
        {recommendation?.summary ?? (loading ? '正在读取实时接口结果。' : '暂无实时建议')}
      </p>

      <div className="mt-4 space-y-4">
        <RecommendationRiskList risks={risks} />
        <RecommendationActionList actions={actions} />
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <ImpactRow icon={AlertTriangle} tone="text-rose-500" label="结构化风险" value={`${risks.length} 项`} />
          <ImpactRow icon={TrendingUp} tone="text-emerald-500" label="建议动作" value={`${actions.length} 项`} />
          <ImpactRow icon={Info} tone="text-brand-500" label="建议来源" value={recommendation?.source ?? '暂无'} />
          <ImpactRow icon={WifiOff} tone="text-amber-500" label="无官方源字段" value="排队 / 人流" />
        </div>
      </div>
    </Card>
  )
}

function RecommendationRiskList({ risks }: { risks: RealtimeRecommendationRisk[] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Risks</p>
      {risks.length === 0 ? (
        <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">暂无实时风险分析。</div>
      ) : (
        <div className="space-y-2">
          {risks.map((risk, index) => (
            <div key={`${risk.type}-${index}`} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{risk.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{risk.reason}</p>
                </div>
                <Tag tone={risk.level === '高' ? 'red' : risk.level === '中' ? 'orange' : 'gray'}>{risk.level}</Tag>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">类型：{riskTypeLabel(risk.type)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RecommendationActionList({ actions }: { actions: RealtimeRecommendationAction[] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Actions</p>
      {actions.length === 0 ? (
        <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">暂无可展示动作。</div>
      ) : (
        <div className="space-y-2">
          {actions.map((action) => (
            <div key={action.id} className={`rounded-lg border p-3 ${action.canApply ? 'border-emerald-100 bg-emerald-50/50' : 'border-slate-100 bg-slate-50 opacity-80'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{action.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{action.description}</p>
                </div>
                <Tag tone={action.canApply ? 'green' : 'gray'}>{action.canApply ? '可执行' : '不可执行'}</Tag>
              </div>
              {!action.canApply && action.unavailableReason && (
                <p className="mt-2 text-xs leading-5 text-amber-600">{action.unavailableReason}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function riskTypeLabel(type: RealtimeRecommendationRisk['type']) {
  if (type === 'traffic') return '交通'
  if (type === 'weather') return '天气'
  if (type === 'queue') return '排队'
  if (type === 'crowd') return '人流'
  if (type === 'route') return '路线'
  return '未知'
}
