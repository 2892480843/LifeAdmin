import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Map as MapIcon,
  List,
  Navigation,
  Share2,
  Download,
  Clock,
  Wallet,
  Route as RouteIcon,
  Users,
  Calendar,
  Bus,
  Footprints,
  Train,
  Car,
  Smile,
} from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import MapCanvas from '../components/MapCanvas'
import type { MapMarker } from '../components/MapCanvas'
import { Card, Stars, Tag, Toast } from '../components/ui'
import { RoutePageHeader, StatusPill } from '../components/ui/RouteSystem'
import SmartImage from '../components/ui/SmartImage'
import { mainTrip, getCity } from '../mock'
import { useApp } from '../store/AppContext'
import { buildTripFromPlan, isSelectedPlanTrip } from '../utils/tripBuilders'
import { canNavigateTo, navigationModeFromTransport, openAmapNavigation } from '../utils/amapNavigation'
import { exportTripMarkdown, shareOrCopy } from '../utils/browserActions'
import type { ActivityStatus, ItineraryDay, ItineraryItem, Trip } from '../types'

const dayColors = ['#2563eb', '#f59e0b', '#10b981', '#8b5cf6']

const transportIcon: Record<string, typeof Bus> = {
  步行: Footprints,
  地铁: Train,
  打车: Car,
  公交: Bus,
}

const statusTone: Record<ActivityStatus, 'green' | 'blue' | 'gray'> = {
  已完成: 'green',
  进行中: 'blue',
  待出发: 'gray',
}

export default function TripDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { draft, selectedPlan, trips, updateItemStatus } = useApp()
  const selectedTrip = isSelectedPlanTrip(id, selectedPlan) && selectedPlan ? buildTripFromPlan(selectedPlan, draft) : null
  const found = trips.find((item) => item.id === (id ?? ''))
  const trip = selectedTrip ?? found ?? mainTrip
  const city = getCity(trip.cityId)
  const isPersisted = trips.some((t) => t.id === trip.id)
  const [view, setView] = useState<'map' | 'list'>('map')
  const [activeDay, setActiveDay] = useState(trip.itinerary[0].day)
  const [toast, setToast] = useState('')

  const currentDay = trip.itinerary.find((d) => d.day === activeDay)!

  let counter = 0
  const allMarkers: MapMarker[] = trip.itinerary.flatMap((day) =>
    day.items.map((it) => {
      counter += 1
      return { id: it.id, x: it.x, y: it.y, lng: it.lng, lat: it.lat, label: it.name, color: it.color, order: counter }
    }),
  )
  const routeGroups = trip.itinerary.map((day, i) => ({
    color: dayColors[i % dayColors.length],
    points: day.items.map((it) => ({ x: it.x, y: it.y, lng: it.lng, lat: it.lat })),
  }))

  const stats = [
    { icon: Calendar, label: '天数', value: `${trip.days} 天` },
    { icon: Clock, label: '总时长', value: trip.totalDuration },
    { icon: RouteIcon, label: '里程', value: `${trip.distance} km` },
    { icon: Wallet, label: '预算上限', value: `¥${trip.budget}` },
    { icon: Users, label: '人数', value: `${trip.travelers} 人` },
    ...(selectedTrip && selectedPlan ? [{ icon: Smile, label: '满意度', value: `${selectedPlan.satisfaction}%` }] : []),
  ]

  const shareTrip = async () => {
    try {
      const result = await shareOrCopy({
        title: trip.title,
        text: `${trip.title}：${city?.name ?? ''} ${trip.startDate} 至 ${trip.endDate}`,
      })
      setToast(result === 'shared' ? '已打开系统分享面板' : '链接已复制到剪贴板')
    } catch {
      setToast('分享未完成')
    }
  }

  const exportTrip = () => {
    exportTripMarkdown(trip, city?.name)
    setToast('行程已导出为 Markdown 文件')
  }

  return (
    <AppLayout sidebar={false}>
      <div className="mx-auto w-full max-w-[1280px] space-y-4 px-4 py-4 sm:px-5 lg:px-6 lg:py-6">
        <RoutePageHeader
          eyebrow="Itinerary Detail"
          title={
            <span className="flex min-w-0 items-center gap-3">
              <button onClick={() => navigate(`/trip/${trip.id}`)} className="btn-ghost min-w-10 px-2 py-2" aria-label="返回行程总览">
                <ArrowLeft size={18} />
              </button>
              <span className="min-w-0 truncate">{trip.title}</span>
            </span>
          }
          description={`${city?.name ?? ''} · ${trip.startDate} 至 ${trip.endDate} · ${trip.travelers} 人`}
          meta={
            <>
              <Tag tone={trip.planType === '体验优先' ? 'purple' : trip.planType === '预算优先' ? 'green' : 'blue'}>{trip.planType}</Tag>
              <StatusPill tone="brand">Day {activeDay}</StatusPill>
            </>
          }
          actions={
            <>
            <div className="segmented-control">
              <button
                onClick={() => setView('map')}
                className={`segmented-item ${view === 'map' ? 'segmented-item-active' : ''}`}
                aria-label="切换到地图视图"
                aria-pressed={view === 'map'}
              >
                <MapIcon size={15} /> 地图视图
              </button>
              <button
                onClick={() => setView('list')}
                className={`segmented-item ${view === 'list' ? 'segmented-item-active' : ''}`}
                aria-label="切换到列表视图"
                aria-pressed={view === 'list'}
              >
                <List size={15} /> 列表视图
              </button>
            </div>
            <button onClick={shareTrip} className="btn-ghost px-3 py-2 text-sm" aria-label="分享行程"><Share2 size={15} /> 分享</button>
            <button onClick={exportTrip} className="btn-ghost px-3 py-2 text-sm" aria-label="导出行程"><Download size={15} /> 导出</button>
            </>
          }
        />

        {/* 日期选项卡 */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {trip.itinerary.map((d, i) => (
            <button
              key={d.day}
              onClick={() => setActiveDay(d.day)}
              className={`min-h-10 shrink-0 rounded-lg border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 ${
                activeDay === d.day ? 'border-transparent text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'
              }`}
              style={activeDay === d.day ? { backgroundColor: dayColors[i % dayColors.length] } : undefined}
              aria-label={`切换到第 ${d.day} 天`}
              aria-pressed={activeDay === d.day}
            >
              Day {d.day} · {d.date.slice(5)}
            </button>
          ))}
        </div>

        {view === 'map' ? (
          <MapView
            day={currentDay}
            markers={allMarkers}
            routeGroups={routeGroups}
            stats={stats}
            onShareTrip={shareTrip}
            onExportTrip={exportTrip}
          />
        ) : (
          <ListView
            trip={trip}
            activeDay={activeDay}
            onItemStatusChange={isPersisted ? (itemId, status) => updateItemStatus(trip.id, itemId, status) : undefined}
            onNavigatePoi={(poiId) => navigate(`/poi/${poiId}`)}
            onShareTrip={shareTrip}
            onExportTrip={exportTrip}
          />
        )}
      </div>
      <Toast message={toast} onClose={() => setToast('')} />
    </AppLayout>
  )
}

function MapView({
  day,
  markers,
  routeGroups,
  stats,
  onShareTrip,
  onExportTrip,
}: {
  day: ItineraryDay
  markers: MapMarker[]
  routeGroups: { color: string; points: { x: number; y: number; lng?: number; lat?: number }[] }[]
  stats: { icon: typeof Clock; label: string; value: string }[]
  onShareTrip: () => void
  onExportTrip: () => void
}) {
  const [targetId, setTargetId] = useState(() => pickNavigationTarget(day)?.id ?? '')
  const [message, setMessage] = useState('')

  useEffect(() => {
    setTargetId(pickNavigationTarget(day)?.id ?? '')
    setMessage('')
  }, [day])

  const targetIndex = day.items.findIndex((it) => it.id === targetId)
  const targetItem = targetIndex >= 0 ? day.items[targetIndex] : pickNavigationTarget(day)
  const previousItem = targetIndex > 0 ? day.items[targetIndex - 1] : null
  const activeMarkers = markers.map((m) => ({ ...m, active: m.id === targetItem?.id }))
  const mode = navigationModeFromTransport(targetItem?.transport)
  const modeLabel = mode === 'walk' ? '步行' : mode === 'bus' ? '公交/地铁' : mode === 'ride' ? '骑行' : '驾车'

  const navigateToTarget = () => {
    if (!targetItem) {
      setMessage('请选择一个导航目标')
      return
    }
    if (!canNavigateTo(targetItem)) {
      setMessage('该地点缺少经纬度，暂时无法导航')
      return
    }

    openAmapNavigation({
      from: canNavigateTo(previousItem) ? previousItem : null,
      to: targetItem,
      mode,
    })
    setMessage(`已打开高德导航：${targetItem.name}`)
  }

  return (
    <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[320px_1fr_260px]">
      {/* 左：当日时间轴 */}
      <Card className="max-h-[560px] overflow-y-auto p-4">
        <p className="mb-3 text-sm font-semibold text-slate-800">Day {day.day} · {day.title}</p>
        <ol className="relative space-y-4 border-l border-dashed border-slate-200 pl-5">
          {day.items.map((it) => {
            const TIcon = transportIcon[it.transport] ?? Bus
            return (
              <li key={it.id} className="relative">
                <span className="absolute -left-[26px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white" style={{ backgroundColor: it.color }} />
                <button
                  onMouseEnter={() => {
                    setTargetId(it.id)
                    setMessage('')
                  }}
                  onFocus={() => {
                    setTargetId(it.id)
                    setMessage('')
                  }}
                  onClick={() => {
                    setTargetId(it.id)
                    setMessage('')
                  }}
                  className={`flex w-full gap-3 rounded-lg p-2 text-left hover:bg-slate-50 ${
                    targetItem?.id === it.id ? 'bg-brand-50 ring-1 ring-brand-100' : ''
                  }`}
                  aria-label={`选择导航目标 ${it.name}`}
                  aria-pressed={targetItem?.id === it.id}
                >
                  <span className="w-10 shrink-0 pt-1 text-xs font-medium text-slate-400">{it.time}</span>
                  <div className="h-12 w-14 shrink-0 overflow-hidden rounded-lg">
                    <SmartImage src={it.cover} alt={it.name} fallbackText={it.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700">{it.name}</p>
                    <p className="truncate text-xs text-slate-400">{it.activity}</p>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="flex items-center gap-0.5"><Clock size={10} /> {it.duration}</span>
                      <span className="flex items-center gap-0.5"><TIcon size={10} /> {it.transport}</span>
                    </div>
                  </div>
                </button>
              </li>
            )
          })}
        </ol>
      </Card>

      {/* 中：地图 */}
      <Card className="self-start overflow-hidden p-0">
        <MapCanvas markers={activeMarkers} routeGroups={routeGroups} height="clamp(360px, 60vh, 560px)" onMarkerClick={setTargetId} />
      </Card>

      {/* 右：信息 + 操作 */}
      <div className="max-h-[560px] space-y-4 overflow-y-auto">
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">行程信息</h3>
          <div className="space-y-3">
            {stats.map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <s.icon size={15} className="text-brand-600" />
                <span className="text-xs text-slate-400">{s.label}</span>
                <span className="ml-auto text-sm font-medium text-slate-700">{s.value}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">导航目标</h3>
          <select
            value={targetItem?.id ?? ''}
            onChange={(e) => {
              setTargetId(e.target.value)
              setMessage('')
            }}
            className="input mb-3"
          >
            {day.items.map((it) => (
              <option key={it.id} value={it.id}>
                {it.time} · {it.name}
              </option>
            ))}
          </select>
          <div className="mb-3 rounded-lg border border-slate-200/80 bg-slate-50/80 p-3 text-xs text-slate-500">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{targetItem?.name ?? '未选择地点'}</p>
                <p className="mt-1">
                  {previousItem ? `从 ${previousItem.name} 出发` : '从当前位置或高德默认起点出发'} · {modeLabel}
                </p>
              </div>
              {targetItem && <Tag tone={statusTone[targetItem.status]} className="shrink-0 whitespace-nowrap">{targetItem.status}</Tag>}
            </div>
            {targetItem && (
              <>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-slate-400">停留</p>
                    <p className="mt-0.5 font-semibold text-slate-700">{targetItem.duration}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">交通</p>
                    <p className="mt-0.5 font-semibold text-slate-700">{targetItem.transport}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">费用</p>
                    <p className="mt-0.5 font-semibold text-slate-700">{targetItem.cost > 0 ? `¥${targetItem.cost}` : '免费'}</p>
                  </div>
                </div>
                {targetItem.note && (
                  <p className="mt-3 rounded-lg bg-white px-3 py-2 leading-5 text-slate-600">
                    {targetItem.note}
                  </p>
                )}
              </>
            )}
          </div>
          {message && <p className="mb-3 text-xs text-brand-600">{message}</p>}
          <button onClick={navigateToTarget} className="btn-primary w-full py-2.5" aria-label="打开当前导航目标的高德导航">
            <Navigation size={16} /> 导航到此
          </button>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
            <button onClick={onShareTrip} className="btn-ghost py-2 text-sm" aria-label="分享行程"><Share2 size={15} /> 分享</button>
            <button onClick={onExportTrip} className="btn-ghost py-2 text-sm" aria-label="导出行程"><Download size={15} /> 导出</button>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">图例</h3>
          <div className="space-y-1.5 text-xs text-slate-500">
            {routeGroups.map((g, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                Day {i + 1}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function pickNavigationTarget(day: ItineraryDay): ItineraryItem | undefined {
  return day.items.find((it) => it.status === '进行中') ?? day.items.find((it) => it.status === '待出发') ?? day.items[0]
}

const statusCycle: Record<ActivityStatus, ActivityStatus> = {
  待出发: '进行中',
  进行中: '已完成',
  已完成: '待出发',
}

function ListView({
  trip,
  activeDay,
  onItemStatusChange,
  onNavigatePoi,
  onShareTrip,
  onExportTrip,
}: {
  trip: Trip
  activeDay: number
  onItemStatusChange?: (itemId: string, status: ActivityStatus) => void
  onNavigatePoi?: (poiId: string) => void
  onShareTrip?: () => void
  onExportTrip?: () => void
}) {
  const items = trip.itinerary
    .filter((day) => day.day === activeDay)
    .flatMap((day) => day.items.map((item) => ({ ...item, day: day.day })))
  const totalCost = items.reduce((sum, item) => sum + item.cost, 0)
  const transportCost = Math.round(totalCost * 0.18)
  const ticketCost = Math.max(0, totalCost - transportCost)
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">时间</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">地点</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">停留</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">预算</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">评分</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">状态</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
                <td className="px-4 py-3">
                  <span className="text-sm font-semibold text-slate-900">{item.time}</span>
                  <p className="mt-0.5 text-xs text-slate-400">Day {item.day}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                    <div>
                      <p className="font-medium text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-400">{item.transport} 前往</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">{item.duration}</td>
                <td className="px-4 py-3 text-slate-600">¥{item.cost}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Stars rating={4.7} size={11} />
                    <span className="text-xs text-slate-500">4.7</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {onItemStatusChange ? (
                    <button
                      type="button"
                      onClick={() => onItemStatusChange(item.id, statusCycle[item.status])}
                      title={`点击切换到"${statusCycle[item.status]}"`}
                      className="transition-opacity hover:opacity-70"
                      aria-label={`当前状态 ${item.status}，点击切换`}
                    >
                      <Tag tone={statusTone[item.status]}>{item.status}</Tag>
                    </button>
                  ) : (
                    <Tag tone={statusTone[item.status]}>{item.status}</Tag>
                  )}
                </td>
                <td className="px-4 py-3">
                  {item.poiId && onNavigatePoi ? (
                    <button
                      type="button"
                      onClick={() => onNavigatePoi(item.poiId!)}
                      className="text-xs text-brand-600 hover:underline"
                      aria-label={`查看 ${item.name} 详情`}
                    >
                      详情
                    </button>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sticky bottom-0 flex flex-col gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-4 text-sm lg:gap-6">
          <span className="text-slate-500">总距离 <strong className="text-slate-900">{trip.distance} km</strong></span>
          <span className="text-slate-500">总时长 <strong className="text-slate-900">{trip.totalDuration}</strong></span>
          <span className="text-slate-500">交通 <strong className="text-slate-900">¥{transportCost}</strong></span>
          <span className="text-slate-500">景点 <strong className="text-slate-900">¥{ticketCost}</strong></span>
        </div>
        <div className="flex gap-2">
          {onExportTrip && (
            <button onClick={onExportTrip} className="btn-ghost px-4 py-2 text-sm" aria-label="导出行程">
              <Download size={15} /> 导出行程
            </button>
          )}
          {onShareTrip && (
            <button onClick={onShareTrip} className="btn-primary px-4 py-2 text-sm" aria-label="分享行程">
              <Navigation size={15} /> 分享行程
            </button>
          )}
        </div>
      </div>
    </Card>
  )
}
