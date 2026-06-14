import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Compass,
  LocateFixed,
  MapPinned,
  Navigation,
  Plus,
  RefreshCw,
  Route,
  Search,
  ShieldAlert,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import MapCanvas from '../components/MapCanvas'
import type { MapMarker } from '../components/MapCanvas'
import { Card, CitySelect, DatePicker, Stars, Tag } from '../components/ui'
import SmartImage from '../components/ui/SmartImage'
import { MetricTile, RouteNodeRail, StatusPill, SystemPanel } from '../components/ui/RouteSystem'
import { cities, cityOptionGroups, getCity, weather } from '../mock'
import { useApp } from '../store/AppContext'
import type { Trip } from '../types'
import { displayPlaceImage } from '../utils/poiImages'

type RoutePreviewEntry = Trip['itinerary'][number]['items'][number] & { day: number }

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, trips, pois, draft, updateDraft } = useApp()
  const [quickCity, setQuickCity] = useState(draft.cityId)
  const [quickDate, setQuickDate] = useState(draft.startDate)
  const [quickTravelers, setQuickTravelers] = useState(draft.travelers)
  const [activePoiTag, setActivePoiTag] = useState('全部')

  const activeTrips = useMemo(() => trips.filter((trip) => trip.status !== '已完成'), [trips])
  const completedTrips = useMemo(() => trips.filter((trip) => trip.status === '已完成'), [trips])
  const preferenceTagCount = draft.interests.length + draft.cuisines.length + draft.travelType.length
  const featuredTrip = activeTrips[0] ?? trips[0]
  const featuredCity = featuredTrip ? getCity(featuredTrip.cityId) : null
  const currentRouteItems =
    featuredTrip?.itinerary
      .flatMap((day) => day.items.map((item) => ({ ...item, day: day.day })))
      .slice(0, 5) ?? []
  const activeRouteItem = currentRouteItems.find((item) => item.status === '进行中') ?? currentRouteItems[0]
  const currentNodes = currentRouteItems.map((item) => ({
    id: item.id,
    time: item.time,
    label: item.name,
    meta: `${item.transport} · ${item.duration}`,
    status: `第${item.day}天 · ${item.status}`,
    color: item.color,
  }))
  const currentRouteMarkers: MapMarker[] = currentRouteItems.map((item, index) => ({
    id: item.id,
    x: item.x,
    y: item.y,
    lng: item.lng,
    lat: item.lat,
    label: item.name,
    color: item.color,
    order: index + 1,
    active: item.id === activeRouteItem?.id,
    status: item.status === '已完成' ? 'joined' : 'default',
  }))

  const recentPois = useMemo(() => {
    const base = pois.filter((poi) => poi.cityId === (quickCity || draft.cityId))
    const filtered =
      activePoiTag === '全部'
        ? base
        : base.filter((poi) => poi.category === activePoiTag || poi.tags.includes(activePoiTag))
    return filtered.slice(0, 4)
  }, [pois, draft.cityId, quickCity, activePoiTag])

  const plannedNodes = featuredTrip?.itinerary.reduce((sum, day) => sum + day.items.length, 0) ?? 0
  const activeNode = currentNodes.find((item) => item.id === activeRouteItem?.id) ?? currentNodes[0]
  const currentRouteHref = featuredTrip ? `/trip/${featuredTrip.id}` : '/new-trip'
  const routePreviewItems = currentRouteItems.slice(0, 3)

  const submitQuickPlan = (event: React.FormEvent) => {
    event.preventDefault()
    const city = cities.find((item) => item.id === quickCity) ?? cities[0]
    updateDraft({
      cityId: city.id,
      cityName: city.name,
      startPoint: city.name,
      endPoint: city.name,
      startDate: quickDate,
      travelers: Math.max(1, quickTravelers),
    })
    navigate('/new-trip')
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1440px] space-y-4 px-4 py-4 sm:px-5 lg:px-6 lg:py-5">
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="command-panel">
            <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <h1 className="text-xl font-semibold text-slate-950 sm:text-2xl">
                    你好，{user?.name || '旅行者'} 👋
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    {activeTrips.length > 0
                      ? `共 ${activeTrips.length} 个行程正在进行`
                      : '创建第一个智能行程，开始旅行规划'}
                  </p>
                </div>
                <div className="dashboard-welcome-strip">
                  <WelcomeChip value={activeTrips.length} label="今日行程数" tone="text-brand-600" />
                  <WelcomeChip value={completedTrips.length} label="已完成次数" tone="text-emerald-600" />
                  <WelcomeChip value={preferenceTagCount} label="偏好标签数" tone="text-notice-600" />
                </div>
              </div>
            </div>

            <div className="grid gap-0 2xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 p-4 sm:p-5">
                <div className="dashboard-trip-layout">
                  <div className="dashboard-trip-summary flex min-w-0 flex-col">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill tone="brand">{featuredTrip?.status || '待创建'}</StatusPill>
                      <Tag tone="teal">{featuredCity?.name || '未选择城市'}</Tag>
                    </div>
                    <h2 className="mt-3 text-xl font-semibold text-slate-950">{featuredTrip?.title || '暂无当前行程'}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {featuredTrip
                        ? `${featuredTrip.startDate} 至 ${featuredTrip.endDate} · ${featuredTrip.travelers} 人 · ${featuredTrip.days} 天`
                        : '先创建行程，系统会在这里展示可运营的路线资产。'}
                    </p>

                    <div className="dashboard-stats-grid">
                      <MiniStat icon={CalendarRange} label="日程窗口" value={`${featuredTrip?.days ?? 0} 天`} />
                      <MiniStat icon={LocateFixed} label="路线节点" value={`${plannedNodes} 个`} />
                      <MiniStat icon={Wallet} label="预算" value={`¥${featuredTrip?.budget ?? 0}`} />
                    </div>

                    <div className="mt-4 rounded-card border border-slate-200 bg-slate-50/75 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="section-eyebrow">当前节点</p>
                          <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                            {activeRouteItem?.name || '等待生成路线'}
                          </p>
                        </div>
                        <Link to={currentRouteHref} className="btn-soft min-h-9 shrink-0 px-3 py-1.5 text-xs">
                          查看 <ArrowRight size={14} aria-hidden="true" />
                        </Link>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        {activeRouteItem
                          ? `${activeRouteItem.time} · ${activeRouteItem.transport} · ${activeRouteItem.duration}`
                          : '创建行程后，这里会展示下一站、交通方式和预计耗时。'}
                      </p>
                    </div>
                  </div>

                  <div className="dashboard-featured-map">
                    <MapCanvas markers={currentRouteMarkers} showRoute height="100%" className="h-full" />
                  </div>

                  <div className="dashboard-route-preview">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="section-eyebrow">路线预览</p>
                        <h3 className="mt-1 text-sm font-semibold text-slate-950">下一段路线节奏</h3>
                      </div>
                      <Link to={currentRouteHref} className="btn-ghost min-h-9 justify-center px-3 py-1.5 text-xs">
                        编辑路线 <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    </div>

                    {routePreviewItems.length ? (
                      <div className="dashboard-route-preview-list">
                        {routePreviewItems.map((item) => (
                          <RoutePreviewItem
                            key={item.id}
                            item={item}
                            active={item.id === activeRouteItem?.id}
                            href={currentRouteHref}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">
                        创建行程后显示路线节点。
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 bg-slate-50/70 p-4 sm:p-5 2xl:border-l 2xl:border-t-0">
                <div className="dashboard-now-grid">
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="section-eyebrow">当前重点</p>
                        <h2 className="mt-1 text-base font-semibold text-slate-950">现在最该做什么</h2>
                      </div>
                      <ShieldAlert size={18} className="text-notice-600" aria-hidden="true" />
                    </div>

                    <div className="mt-3 rounded-card border border-amber-200 bg-amber-50 p-3">
                      <p className="text-sm font-semibold text-amber-900">先检查晚高峰风险</p>
                      <p className="mt-1 text-sm leading-6 text-amber-800/80">
                        {featuredCity
                          ? `${featuredCity.name}核心景区可能在高峰时段影响节点衔接，建议在实时动态页确认拥堵和排队窗口。`
                          : '热门景区可能在高峰时段出现排队和拥堵，建议提前在实时动态页确认出行窗口。'}
                      </p>
                    </div>
                  </div>

                  <div className="grid min-w-0 gap-3 md:grid-cols-3 2xl:grid-cols-1">
                    <WorkZone icon={ShieldAlert} title="风险" desc="实时动态页处理天气、拥堵、排队提醒" href="/realtime" tone="amber" />
                    <WorkZone icon={Route} title="路线节点" desc="行程详情中调整顺序、交通方式和停留时长" href={currentRouteHref} tone="brand" />
                    <WorkZone icon={MapPinned} title="推荐地点" desc="地图探索页筛选 POI 并加入路线资产" href="/explore" tone="emerald" />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-white px-4 py-2.5 sm:px-5">
              <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto] lg:items-center">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-slate-500">主操作区</p>
                  <p className="mt-0.5 text-sm text-slate-600">主操作集中在这里，减少首屏分散注意力。</p>
                </div>
                <Link to="/new-trip" className="btn-primary min-h-10 justify-center px-4 py-2">
                  <Plus size={16} aria-hidden="true" /> 新建行程
                </Link>
                <Link to="/explore" className="btn-ghost min-h-10 justify-center px-4 py-2">
                  <Search size={16} aria-hidden="true" /> 地图探索
                </Link>
                <Link to={currentRouteHref} className="btn-soft min-h-10 justify-center px-4 py-2">
                  <Route size={16} aria-hidden="true" /> 打开当前路线
                </Link>
              </div>
            </div>
          </div>

          <SystemPanel accent="slate" showAccentRail={false} className="p-4 sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="section-eyebrow">AI 建议</p>
                <h2 className="mt-1 text-base font-semibold text-slate-950">AI 下一步建议</h2>
              </div>
              <Sparkles size={18} className="text-notice-600" aria-hidden="true" />
            </div>
            <div className="space-y-3">
              <ActionItem icon={ShieldAlert} title="检查晚高峰风险" desc={`${featuredCity ? featuredCity.name + '核心景区' : '热门景区'}建议错峰，避开高峰时段。`} tone="risk" href="/realtime" />
              <ActionItem icon={Navigation} title="补齐导航目标" desc="为进行中节点确认交通方式与费用。" tone="brand" href={currentRouteHref} />
              <ActionItem icon={RefreshCw} title="同步偏好画像" desc="把最近收藏 POI 写入下一次推荐权重。" tone="locate" href="/settings?section=preference" />
            </div>
            <WeatherCard />
          </SystemPanel>
        </section>

        <form onSubmit={submitQuickPlan} className="command-surface p-3 sm:p-4" aria-label="快捷写入行程草稿">
          <p className="section-eyebrow mb-2">快速规划行程</p>
          <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr_0.8fr_auto] lg:items-end">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-500">目的地</span>
              <CitySelect
                value={quickCity}
                onChange={setQuickCity}
                groups={cityOptionGroups}
                ariaLabel="选择快捷目的地"
                icon={Compass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-500">出发日期</span>
              <DatePicker
                name="quick-start-date"
                value={quickDate}
                onChange={setQuickDate}
                ariaLabel="选择快捷出发日期"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-500">人数</span>
              <span className="field-shell">
                <Users size={16} className="text-slate-400" aria-hidden="true" />
                <input
                  type="number"
                  name="quick-travelers"
                  min={1}
                  inputMode="numeric"
                  value={quickTravelers}
                  onChange={(event) => setQuickTravelers(Number(event.target.value) || 1)}
                  className="w-full bg-transparent py-2.5 text-sm outline-none"
                />
              </span>
            </label>
            <button type="submit" className="btn-primary min-h-11 px-5 py-2.5">
              <Sparkles size={16} aria-hidden="true" /> 立即规划
            </button>
          </div>
        </form>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            <SystemPanel accent="brand" className="p-4 sm:p-5">
              <div className="mb-4">
                <p className="section-eyebrow">今日任务流</p>
                <h2 className="mt-1 text-base font-semibold text-slate-950">今日路线节点</h2>
              </div>
              {currentNodes.length ? (
                <RouteNodeRail nodes={currentNodes} activeId={activeNode?.id} />
              ) : (
                <div className="empty-state py-8">
                  <Route size={28} className="mx-auto text-slate-300" aria-hidden="true" />
                  <p className="mt-3 text-sm font-semibold text-slate-800">还没有路线节点</p>
                </div>
              )}
            </SystemPanel>

            <Card className="p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="section-eyebrow">推荐地点</p>
                  <h2 className="mt-1 text-base font-semibold text-slate-950">推荐地点资产</h2>
                </div>
                <Link to="/explore" className="btn-ghost px-3 py-2 text-sm">
                  全部探索 <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>
              <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                {['全部', '景点', '美食', '购物', '住宿'].map((tag) => {
                  const active = activePoiTag === tag
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setActivePoiTag(tag)}
                      className={`chip whitespace-nowrap ${active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                      aria-pressed={active}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {recentPois.map((poi) => (
                  <Link
                    key={poi.id}
                    to={`/poi/${poi.id}`}
                    className="card-interactive flex min-w-0 gap-3 overflow-hidden rounded-card border border-slate-200 bg-white p-3 text-left"
                  >
                    <SmartImage
                      src={displayPlaceImage(poi.cover, poi.imageConfidence)}
                      alt={poi.name}
                      fallbackText={poi.name}
                      className="h-20 w-24 shrink-0 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-950">{poi.name}</p>
                        <span className="text-xs font-semibold text-amber-500">{poi.rating.toFixed(1)}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1">
                        <Stars rating={poi.rating} size={11} />
                        <Tag tone="gray" className="ml-1">{poi.category}</Tag>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{poi.aiReason}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          </div>

          <SystemPanel accent="emerald" className="p-4 sm:p-5">
            <div className="mb-4">
              <p className="section-eyebrow">实时摘要</p>
              <h2 className="mt-1 text-base font-semibold text-slate-950">实时状态摘要</h2>
            </div>
            <div className="grid gap-3">
              <MetricTile icon={CheckCircle2} label="可执行节点" value={`${Math.max(0, plannedNodes - 1)} 个`} detail="已按当前路线排序" tone="emerald" />
              <MetricTile icon={Clock3} label="预计总时长" value={featuredTrip?.totalDuration ?? '待生成'} detail="含停留与交通估算" tone="brand" />
              <MetricTile icon={ShieldAlert} label="风险关注" value="1 个提醒" detail="高峰拥堵与排队状态" tone="amber" />
            </div>
          </SystemPanel>
        </section>
      </div>
    </AppLayout>
  )
}

function WelcomeChip({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-center">
      <p className={`text-lg font-bold leading-none ${tone}`}>{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
    </div>
  )
}

function MiniStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <Icon size={14} className="text-brand-600" aria-hidden="true" />
      <p className="mt-1 text-[11px] text-slate-500">{label}</p>
      <p className="truncate text-sm font-semibold text-slate-800">{value}</p>
    </div>
  )
}

function RoutePreviewItem({
  item,
  active,
  href,
}: {
  item: RoutePreviewEntry
  active: boolean
  href: string
}) {
  const stateClass = active
    ? 'border-brand-200 bg-brand-50/70'
    : item.status === '已完成'
      ? 'border-emerald-200 bg-emerald-50/60'
      : 'border-slate-200 bg-white'

  return (
    <Link
      to={href}
      className={`dashboard-route-step ${stateClass}`}
      aria-current={active ? 'step' : undefined}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
          <span className="truncate text-xs font-semibold text-slate-500">{item.time}</span>
        </span>
        <span className="shrink-0 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
          第{item.day}天
        </span>
      </span>
      <span className="mt-2 block truncate text-sm font-semibold text-slate-950">{item.name}</span>
      <span className="mt-1 block truncate text-xs leading-5 text-slate-500">
        {item.transport} · {item.duration}
      </span>
    </Link>
  )
}

function WorkZone({
  icon: Icon,
  title,
  desc,
  href,
  tone,
}: {
  icon: LucideIcon
  title: string
  desc: string
  href: string
  tone: 'brand' | 'emerald' | 'amber'
}) {
  const toneClass =
    tone === 'amber'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : tone === 'emerald'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-brand-50 text-brand-700 border-brand-200'

  return (
    <Link to={href} className="group flex gap-3 rounded-card border border-slate-200 bg-white p-3 transition hover:border-brand-200 hover:shadow-card">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${toneClass}`}>
        <Icon size={16} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-500">{desc}</span>
      </span>
      <ArrowRight size={15} className="mt-1 shrink-0 text-slate-300 transition group-hover:text-brand-500" aria-hidden="true" />
    </Link>
  )
}

function ActionItem({
  icon: Icon,
  title,
  desc,
  tone,
  href,
}: {
  icon: LucideIcon
  title: string
  desc: string
  tone: 'brand' | 'locate' | 'risk'
  href?: string
}) {
  const toneClass =
    tone === 'risk'
      ? 'bg-risk-50 text-risk-600 border-risk-100'
      : tone === 'locate'
        ? 'bg-locate-50 text-locate-700 border-locate-100'
        : 'bg-brand-50 text-brand-700 border-brand-100'
  const inner = (
    <>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${toneClass}`}>
        <Icon size={16} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-500">{desc}</p>
      </div>
      {href && <ArrowRight size={14} className="mt-1 shrink-0 text-slate-300" aria-hidden="true" />}
    </>
  )
  if (href) {
    return (
      <Link to={href} className="flex gap-3 rounded-card border border-slate-200 bg-white p-3 transition hover:border-brand-200 hover:shadow-card" aria-label={title}>
        {inner}
      </Link>
    )
  }
  return (
    <div className="flex gap-3 rounded-card border border-slate-200 bg-white p-3">
      {inner}
    </div>
  )
}

const weatherIconEmoji: Record<string, string> = {
  sun: '☀️',
  'cloud-sun': '⛅',
  cloud: '☁️',
  'cloud-rain': '🌧️',
  'cloud-lightning': '⛈️',
  snow: '❄️',
  wind: '💨',
  fog: '🌫️',
}

function WeatherCard() {
  const icon = weatherIconEmoji[weather.icon] ?? '🌤️'
  const forecastDays = weather.forecast.slice(0, 4)
  return (
    <div className="card mt-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="section-eyebrow">当前天气</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">{weather.city} · {weather.temp}°C</p>
          <p className="text-sm text-slate-500">{weather.condition}</p>
        </div>
        <div className="text-right">
          <div className="text-4xl leading-none" aria-hidden="true">{icon}</div>
          <p className="mt-1 text-xs text-slate-500">{weather.high}° / {weather.low}°</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 border-t border-slate-100 pt-3">
        {forecastDays.map((day) => (
          <div key={day.day} className="text-center">
            <p className="text-xs text-slate-500">{day.day}</p>
            <p className="my-1 text-lg leading-none" aria-hidden="true">{weatherIconEmoji[day.icon] ?? '⛅'}</p>
            <p className="text-xs font-semibold text-slate-600">{day.high}°</p>
          </div>
        ))}
      </div>
    </div>
  )
}
