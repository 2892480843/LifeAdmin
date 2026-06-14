import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BookmarkPlus,
  Clock,
  Wallet,
  Route as RouteIcon,
  Users,
  Calendar,
  Share2,
  Download,
  Navigation,
  Edit3,
  StickyNote,
  CheckSquare,
  Info,
  Map as MapIcon,
  Smile,
} from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import MapCanvas from '../components/MapCanvas'
import type { MapMarker } from '../components/MapCanvas'
import { Card, Tag, Toast } from '../components/ui'
import { CheckpointStrip, MetricTile, RoutePageHeader, StatusPill, SystemPanel } from '../components/ui/RouteSystem'
import { mainTrip, getCity } from '../mock'
import { useApp } from '../store/AppContext'
import { buildTripFromPlan, isSelectedPlanTrip } from '../utils/tripBuilders'
import { exportTripMarkdown, shareOrCopy } from '../utils/browserActions'

const dayColors = ['#2563eb', '#f59e0b']

export default function TripOverview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { draft, selectedPlan, trips, addTrip, setSelectedPlan } = useApp()
  const selectedTrip = isSelectedPlanTrip(id, selectedPlan) && selectedPlan ? buildTripFromPlan(selectedPlan, draft) : null
  const found = trips.find((item) => item.id === (id ?? ''))
  const trip = selectedTrip ?? found ?? mainTrip
  const city = getCity(trip.cityId)
  const [toast, setToast] = useState('')
  const [activeNodeId, setActiveNodeId] = useState('')
  const [activeDay, setActiveDay] = useState(trip.itinerary[0]?.day ?? 1)
  const [checkedCps, setCheckedCps] = useState<Set<number>>(new Set())
  const isUnsaved = !!selectedTrip && !trips.some((t) => t.id === selectedTrip.id)

  const toggleCheckpoint = (index: number) =>
    setCheckedCps((prev) => {
      const next = new Set(prev)
      next.has(index) ? next.delete(index) : next.add(index)
      return next
    })

  const saveTrip = () => {
    addTrip(trip)
    setSelectedPlan(null)
    setToast('行程已保存到我的行程列表')
  }

  // 地图标记按天连续编号着色
  let counter = 0
  const numbered: MapMarker[] = trip.itinerary.flatMap((day) =>
    day.items.map((it) => {
      counter += 1
      return {
        id: it.id,
        x: it.x,
        y: it.y,
        lng: it.lng,
        lat: it.lat,
        label: it.name,
        color: it.color,
        order: counter,
        active: it.id === activeNodeId || day.day === activeDay,
      }
    }),
  )

  const routeGroups = trip.itinerary.map((day, i) => ({
    color: dayColors[i % dayColors.length],
    points: day.items.map((it) => ({ x: it.x, y: it.y, lng: it.lng, lat: it.lat })),
  }))

  const stats = [
    { icon: Calendar, label: '行程天数', value: `${trip.days} 天` },
    { icon: Clock, label: '总时长', value: trip.totalDuration },
    { icon: Wallet, label: '预算上限', value: `¥${trip.budget}` },
    { icon: RouteIcon, label: '总里程', value: `${trip.distance} km` },
    { icon: Users, label: '出行人数', value: `${trip.travelers} 人` },
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
      <div className="mx-auto w-full max-w-[1280px] space-y-5 px-4 py-4 sm:px-5 lg:px-6 lg:py-6">
        <RoutePageHeader
          eyebrow="路线总览"
          title={
            <span className="flex min-w-0 items-center gap-3">
              <button onClick={() => navigate(-1)} className="btn-ghost min-w-10 px-2 py-2" aria-label="返回上一页">
                <ArrowLeft size={18} />
              </button>
              <span className="min-w-0 truncate">{trip.title}</span>
            </span>
          }
          description={`${city?.name ?? ''} · ${trip.startDate} 至 ${trip.endDate}`}
          meta={
            <>
              <Tag tone="blue">{trip.planType}</Tag>
              <StatusPill tone="brand">{trip.itinerary.reduce((sum, day) => sum + day.items.length, 0)} 个节点</StatusPill>
            </>
          }
          actions={
            <>
              {isUnsaved && (
                <button onClick={saveTrip} className="btn-primary px-3 py-2 text-sm" aria-label="保存到我的行程">
                  <BookmarkPlus size={15} /> 保存行程
                </button>
              )}
              <button onClick={shareTrip} className="btn-ghost px-3 py-2 text-sm" aria-label="分享行程">
                <Share2 size={15} /> 分享
              </button>
              <button onClick={exportTrip} className="btn-ghost px-3 py-2 text-sm" aria-label="导出行程">
                <Download size={15} /> 导出
              </button>
              {!isUnsaved && (
                <button onClick={() => navigate(`/trip/${trip.id}/detail`)} className="btn-soft px-3 py-2 text-sm" aria-label="编辑行程">
                  <Edit3 size={15} /> 编辑行程
                </button>
              )}
            </>
          }
        />

        <SystemPanel accent="brand" showAccentRail={false} className="p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-6">
            {stats.map((s) => (
              <MetricTile key={s.label} icon={s.icon} label={s.label} value={s.value} />
            ))}
          </div>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">关键检查点</p>
              <span className="text-xs text-slate-500">{trip.checkpoints.length} 个触发点</span>
            </div>
            <CheckpointStrip items={trip.checkpoints} />
          </div>
        </SystemPanel>

        {isUnsaved && (
          <div className="flex items-center justify-between gap-4 rounded-card border border-brand-200 bg-brand-50 px-4 py-3">
            <p className="text-sm text-brand-800">
              <span className="font-semibold">该行程尚未保存</span>——刷新页面或离开后将会丢失，点击「保存行程」加入你的行程列表。
            </p>
            <button onClick={saveTrip} className="btn-primary shrink-0 px-4 py-2 text-sm" aria-label="保存行程到列表">
              <BookmarkPlus size={15} /> 保存行程
            </button>
          </div>
        )}

        {selectedTrip && selectedPlan && (
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Tag tone={selectedPlan.type === '体验优先' ? 'purple' : selectedPlan.type === '预算优先' ? 'green' : 'blue'}>
                {selectedPlan.type}
              </Tag>
              <span className="text-sm font-semibold text-slate-800">{selectedPlan.name}</span>
              <span className="text-sm text-amber-500">满意度 {selectedPlan.satisfaction}%</span>
            </div>
            <p className="mt-2 text-sm text-slate-500">{selectedPlan.summary}</p>
            <p className="mt-2 text-xs text-slate-500">{selectedPlan.stops.map((stop) => stop.name).join(' → ')}</p>
          </Card>
        )}

        <div className="grid min-w-0 overflow-hidden rounded-card border border-slate-200 bg-white shadow-card lg:h-[calc(100vh-12rem)] lg:grid-cols-[340px_minmax(0,1fr)_300px]">
          {/* 左：每日安排 */}
          <div className="min-h-0 overflow-y-auto border-r border-slate-200 bg-white">
            <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-3 py-2">
              <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(3.5rem, 1fr))' }}>
                {trip.itinerary.map((day) => (
                  <button
                    key={day.day}
                    type="button"
                    onClick={() => setActiveDay(day.day)}
                    className={`min-h-10 min-w-0 rounded-lg border px-2 py-2 text-center text-sm font-medium transition-colors ${
                      activeDay === day.day
                        ? 'border-brand-600 bg-brand-50 text-brand-700 shadow-sm'
                        : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                    aria-pressed={activeDay === day.day}
                  >
                    第 {day.day} 天
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-4 p-4">
              {trip.itinerary
                .filter((day) => day.day === activeDay)
                .map((day, di) => (
                  <Card key={day.day} className="p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ backgroundColor: dayColors[di % dayColors.length] }}>
                        {day.day}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">第 {day.day} 天 · {day.title}</p>
                        <p className="text-xs text-slate-500">{day.date}</p>
                      </div>
                    </div>
                    <ol className="relative space-y-3 border-l border-dashed border-slate-200 pl-4">
                      {day.items.map((it) => (
                        <li key={it.id} className="relative">
                          <span className="absolute -left-[22px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white text-[8px] font-bold text-white" style={{ backgroundColor: it.color }} />
                          <button
                            onMouseEnter={() => setActiveNodeId(it.id)}
                            onFocus={() => setActiveNodeId(it.id)}
                            onClick={() => {
                              setActiveNodeId(it.id)
                              if (it.poiId) navigate(`/poi/${it.poiId}`)
                            }}
                            className="flex w-full items-start gap-2 rounded-lg p-1.5 text-left hover:bg-slate-50"
                            aria-label={`查看行程节点 ${it.name}`}
                          >
                            <span className="text-xs font-medium text-slate-500">{it.time}</span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-slate-700">{it.name}</p>
                              <p className="truncate text-xs text-slate-500">{it.activity}</p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ol>
                  </Card>
                ))}
            </div>
          </div>

          {/* 中：地图 */}
          <Card className="self-stretch overflow-hidden rounded-none border-0 p-0 shadow-none">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
              <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700"><MapIcon size={15} /> 路线地图</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {trip.itinerary.map((d, i) => (
                  <span key={d.day} className="flex items-center gap-1 text-slate-500">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dayColors[i % dayColors.length] }} /> 第 {d.day} 天
                  </span>
                ))}
              </div>
            </div>
            <MapCanvas markers={numbered} routeGroups={routeGroups} height="clamp(360px, 58vh, 520px)" onMarkerClick={setActiveNodeId} />
          </Card>

          {/* 右：备注/检查点/实用信息 */}
          <div className="space-y-4 overflow-y-auto border-t border-slate-200 bg-slate-50/60 p-4 lg:border-l lg:border-t-0">
            <Card className="p-4">
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800"><StickyNote size={15} className="text-amber-500" /> 行程备注</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                {trip.notes.map((n, i) => (
                  <li key={i} className="flex gap-2"><span className="text-amber-400">•</span>{n}</li>
                ))}
              </ul>
            </Card>
            <Card className="p-4">
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800"><CheckSquare size={15} className="text-emerald-500" /> 检查点</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                {trip.checkpoints.map((c, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`cp-${i}`}
                      checked={checkedCps.has(i)}
                      onChange={() => toggleCheckpoint(i)}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 accent-brand-600"
                      aria-label={`标记检查点：${c}`}
                    />
                    <label
                      htmlFor={`cp-${i}`}
                      className={`cursor-pointer select-none ${checkedCps.has(i) ? 'text-slate-500 line-through' : ''}`}
                    >
                      {c}
                    </label>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-4">
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800"><Info size={15} className="text-brand-600" /> 实用信息</h3>
              <div className="flex flex-wrap gap-1.5">
                {trip.tips.map((t) => (
                  <Tag key={t} tone="blue">{t}</Tag>
                ))}
              </div>
            </Card>

            <div className="space-y-2">
              <button onClick={() => navigate(`/trip/${trip.id}/detail`)} className="btn-primary w-full py-2.5" aria-label="开始导航并进入行程详情">
                <Navigation size={16} /> 开始导航
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={exportTrip} className="btn-ghost py-2 text-sm" aria-label="导出行程"><Download size={14} /> 导出行程</button>
                <button onClick={shareTrip} className="btn-ghost py-2 text-sm" aria-label="分享行程"><Share2 size={14} /> 分享行程</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Toast message={toast} onClose={() => setToast('')} />
    </AppLayout>
  )
}
