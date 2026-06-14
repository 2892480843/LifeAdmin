import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock3,
  FileEdit,
  Inbox,
  MapPin,
  Plus,
  Route,
  Search,
  Trash2,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import { Card, ConfirmDialog, Toast } from '../components/ui'
import SmartImage from '../components/ui/SmartImage'
import { MetricTile, RoutePageHeader, StatusPill, SystemPanel } from '../components/ui/RouteSystem'
import { getCity } from '../mock'
import { useApp } from '../store/AppContext'
import type { Trip } from '../types'

const tabs: (Trip['status'] | '全部')[] = ['全部', '规划中', '草稿', '收藏', '已完成']

const statusMeta: Record<Trip['status'], { tone: 'brand' | 'emerald' | 'amber' | 'slate'; icon: typeof Route; action: string; desc: string }> = {
  规划中: { tone: 'brand', icon: Route, action: '继续推进', desc: '已生成路线，可继续导航与调整' },
  草稿: { tone: 'amber', icon: FileEdit, action: '继续编辑', desc: '缺少完整行程，可补齐输入约束' },
  收藏: { tone: 'slate', icon: Inbox, action: '转为计划', desc: '已收藏资产，可作为下一次出行模板' },
  已完成: { tone: 'emerald', icon: CheckCircle2, action: '复盘查看', desc: '历史行程，可导出或复用' },
}

export default function Trips() {
  const navigate = useNavigate()
  const { trips, deleteTrip, updateTripStatus } = useApp()
  const [tab, setTab] = useState<(typeof tabs)[number]>('全部')
  const [query, setQuery] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const searchScopedTrips = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return trips

    return trips.filter((trip) => {
      const city = getCity(trip.cityId)
      return (
        trip.title.toLowerCase().includes(keyword) ||
        trip.planType.toLowerCase().includes(keyword) ||
        city?.name.toLowerCase().includes(keyword)
      )
    })
  }, [query, trips])

  const counts = useMemo(
    () => ({
      全部: searchScopedTrips.length,
      规划中: searchScopedTrips.filter((trip) => trip.status === '规划中').length,
      草稿: searchScopedTrips.filter((trip) => trip.status === '草稿').length,
      收藏: searchScopedTrips.filter((trip) => trip.status === '收藏').length,
      已完成: searchScopedTrips.filter((trip) => trip.status === '已完成').length,
    }),
    [searchScopedTrips],
  )

  const list = useMemo(() => {
    return searchScopedTrips.filter((trip) => {
      const hitTab = tab === '全部' || trip.status === tab
      return hitTab
    })
  }, [searchScopedTrips, tab])

  return (
    <AppLayout>
      <div className="page-shell max-w-[1280px]">
        <RoutePageHeader
          eyebrow="行程工作台"
          title="行程资产管理台"
          description="统一管理规划中、草稿、收藏和已完成路线。"
          meta={
            <>
              <StatusPill tone="brand">规划中 {counts.规划中}</StatusPill>
              <StatusPill tone="amber">草稿 {counts.草稿}</StatusPill>
              <StatusPill tone="slate">收藏 {counts.收藏}</StatusPill>
              <StatusPill tone="emerald">已完成 {counts.已完成}</StatusPill>
            </>
          }
          actions={
            <button
              type="button"
              onClick={() => navigate('/new-trip')}
              className="btn-primary w-full px-5 py-2.5 sm:w-auto"
              aria-label="新建行程"
            >
              <Plus size={16} /> 新建行程
            </button>
          }
        />

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(['规划中', '草稿', '收藏', '已完成'] as Trip['status'][]).map((status) => {
            const meta = statusMeta[status]
            return (
              <button
                key={status}
                type="button"
                onClick={() => setTab(status)}
                className={`min-h-24 rounded-card border bg-white p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 ${
                  tab === status ? 'border-brand-300 ring-2 ring-brand-100' : 'border-slate-200 hover:border-brand-200'
                }`}
                aria-label={`筛选${status}行程`}
                aria-pressed={tab === status}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${tab === status ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <meta.icon size={18} />
                  </span>
                  <StatusPill tone={meta.tone}>{status}</StatusPill>
                </div>
                <p className="mt-3 text-2xl font-semibold text-slate-950">{counts[status]}</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">{meta.desc}</p>
              </button>
            )
          })}
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0 space-y-4">
            <Card className="p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div
                  role="search"
                  aria-label="行程搜索"
                  className="group flex min-h-12 w-full min-w-0 items-center gap-2 rounded-card border border-slate-200/80 bg-slate-50/80 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_24px_rgba(15,23,42,0.04)] transition duration-[180ms] hover:border-brand-200 hover:bg-white focus-within:border-brand-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-brand-100/70 lg:w-[430px]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-slate-400 shadow-sm ring-1 ring-slate-200/80 transition duration-[180ms] group-focus-within:bg-brand-50 group-focus-within:text-brand-600 group-focus-within:ring-brand-100">
                    <Search size={17} aria-hidden="true" />
                  </span>
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="h-9 min-w-0 flex-1 bg-transparent px-0 text-sm font-medium text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-search-cancel-button]:appearance-none"
                    placeholder="搜索行程、城市或方案类型"
                    aria-label="搜索行程"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      aria-label="清空行程搜索"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition duration-[180ms] hover:bg-slate-100 hover:text-slate-700 active:scale-[0.96]"
                    >
                      <X size={15} aria-hidden="true" />
                    </button>
                  )}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
                  {tabs.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setTab(item)}
                      className={`shrink-0 rounded-lg border px-3.5 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 ${
                        tab === item
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-slate-900'
                      }`}
                      aria-label={`切换到${item}行程`}
                      aria-pressed={tab === item}
                    >
                      {item} <span className={tab === item ? 'text-white/75' : 'text-slate-400'}>{counts[item]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            {list.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-slate-200 py-20 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                  <MapPin size={28} className="text-slate-300" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-slate-600">暂无行程</h3>
                <p className="mt-1 text-sm text-slate-400">还没有创建任何行程，去规划你的第一次出发吧</p>
                <Link to="/new-trip" className="btn-primary mt-5 px-6 py-2.5 text-sm">
                  <Plus size={16} /> 新建行程
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {list.map((trip) => (
                  <TripAssetRow
                    key={trip.id}
                    trip={trip}
                    onOpen={() => navigate(`/trip/${trip.id}`)}
                    onDetail={() => navigate(`/trip/${trip.id}/detail`)}
                    onDelete={() => setDeleteId(trip.id)}
                    onStatusChange={(status) => {
                      updateTripStatus(trip.id, status)
                      setToast(`行程状态已更新为「${status}」`)
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          <SystemPanel
            accent={tab === '已完成' ? 'emerald' : tab === '草稿' ? 'amber' : 'brand'}
            showAccentRail={false}
            className="p-4 sm:p-5 xl:sticky xl:top-24 xl:self-start"
          >
            <div className="mb-4">
              <p className="section-eyebrow">资产概况</p>
              <h2 className="mt-1 text-base font-semibold text-slate-950">资产态势</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">当前筛选：{tab} · 匹配 {list.length} 条记录</p>
            </div>
            <div className="grid gap-3">
              <MetricTile icon={Route} label="总资产" value={counts.全部} tone="brand" />
              <MetricTile icon={FileEdit} label="待补齐" value={counts.草稿} tone="amber" />
              <MetricTile icon={CheckCircle2} label="可复盘" value={counts.已完成} tone="emerald" />
            </div>
            <div className="mt-4 rounded-card border border-slate-200/80 bg-slate-50/70 p-3">
              <p className="text-sm font-semibold text-slate-800">处理建议</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {tab === '草稿'
                  ? '优先补齐目的地、交通和预算约束，再进入方案生成。'
                  : tab === '收藏'
                    ? '收藏路线适合作为模板，可复制到新建行程继续调整。'
                    : tab === '已完成'
                      ? '已完成行程适合复盘、导出或复用为下一次计划。'
                      : '规划中行程优先查看时间轴和实时动态，确保当天节点可执行。'}
              </p>
            </div>
          </SystemPanel>
        </div>
      </div>
      <ConfirmDialog
        open={deleteId !== null}
        title="删除行程"
        message={`确定要删除「${trips.find((t) => t.id === deleteId)?.title ?? '该行程'}」吗？此操作不可撤销。`}
        confirmText="删除"
        danger
        onConfirm={() => {
          if (deleteId) {
            deleteTrip(deleteId)
            setToast('行程已删除')
          }
          setDeleteId(null)
        }}
        onCancel={() => setDeleteId(null)}
      />
      <Toast message={toast} onClose={() => setToast('')} />
    </AppLayout>
  )
}

const tripStatusOptions: Trip['status'][] = ['规划中', '草稿', '收藏', '已完成']

function TripAssetRow({
  trip,
  onOpen,
  onDetail,
  onDelete,
  onStatusChange,
}: {
  trip: Trip
  onOpen: () => void
  onDetail: () => void
  onDelete: () => void
  onStatusChange: (status: Trip['status']) => void
}) {
  const city = getCity(trip.cityId)
  const plannedNodes = trip.itinerary.reduce((sum, day) => sum + day.items.length, 0)
  const meta = statusMeta[trip.status]
  const Icon = meta.icon

  return (
    <article className="card overflow-hidden transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-hover active:translate-y-0">
      <div className="grid gap-0 lg:grid-cols-[220px_minmax(0,1fr)_180px]">
        <button type="button" onClick={onOpen} className="group relative block h-44 w-full overflow-hidden text-left lg:h-full" aria-label={`打开行程 ${trip.title}`}>
          <SmartImage src={trip.cover} alt={trip.title} fallbackText={trip.title} className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-command-950/72 via-command-950/12 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-3 text-white">
            <div className="flex items-center gap-1.5 text-sm">
              <MapPin size={14} /> {city?.name ?? trip.cityId}
            </div>
          </div>
        </button>

        <div className="min-w-0 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-base font-semibold text-slate-950">{trip.title}</h2>
                <StatusPill tone={meta.tone}>{trip.status}</StatusPill>
              </div>
              <p className="mt-1 text-xs text-slate-500">{trip.startDate} 至 {trip.endDate}</p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Icon size={17} />
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <TripMeta icon={Calendar} label="天数" value={`${trip.days} 天`} />
            <TripMeta icon={Users} label="人数" value={`${trip.travelers} 人`} />
            <TripMeta icon={Route} label="里程" value={`${trip.distance} km`} />
            <TripMeta icon={Wallet} label="预算" value={`¥${trip.budget}`} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Clock3 size={13} /> {trip.totalDuration}
            </span>
            <span>{plannedNodes || '草稿'} 个节点</span>
            <StatusPill tone={trip.planType === '预算优先' ? 'emerald' : trip.planType === '体验优先' ? 'amber' : 'brand'}>
              {trip.planType}
            </StatusPill>
          </div>
        </div>

        <div className="flex flex-col justify-between border-t border-slate-100 p-4 lg:border-l lg:border-t-0">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-400">下一步操作</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{meta.action}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{meta.desc}</p>
          </div>
          <div className="mt-4 grid gap-2">
            <button type="button" onClick={onOpen} className="btn-primary px-3 py-2 text-sm" aria-label={`查看${trip.title}总览`}>
              查看总览
            </button>
            <button type="button" onClick={onDetail} className="btn-ghost px-3 py-2 text-sm" aria-label={`进入${trip.title}详情`}>
              {trip.status === '草稿' ? '继续编辑' : '时间轴'} <ArrowRight size={14} />
            </button>
            <div className="flex gap-1.5">
              <select
                value={trip.status}
                onChange={(e) => onStatusChange(e.target.value as Trip['status'])}
                className="min-h-9 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 focus:border-brand-400 focus:outline-none"
                aria-label={`更改 ${trip.title} 状态`}
              >
                {tripStatusOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={onDelete}
                className="flex min-h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500"
                aria-label={`删除行程 ${trip.title}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

function TripMeta({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 px-3 py-2">
      <p className="flex items-center gap-1 text-slate-500">
        <Icon size={12} /> {label}
      </p>
      <p className="mt-0.5 font-semibold text-slate-800">{value}</p>
    </div>
  )
}
