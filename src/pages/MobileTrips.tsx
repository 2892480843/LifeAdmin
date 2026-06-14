import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  Calendar,
  CheckCircle2,
  FileEdit,
  Inbox,
  MapPin,
  Plus,
  Route,
  Search,
  Star,
  Trash2,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import SmartImage from '../components/ui/SmartImage'
import { useApp } from '../store/AppContext'
import { getCity } from '../mock'
import type { Trip } from '../types'

const statusTabs: (Trip['status'] | '全部')[] = ['全部', '规划中', '草稿', '收藏', '已完成']

const statusMeta: Record<Trip['status'], { dot: string; chip: string }> = {
  规划中: { dot: 'bg-brand-500', chip: 'bg-brand-50 text-brand-600' },
  草稿: { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-600' },
  收藏: { dot: 'bg-slate-400', chip: 'bg-slate-100 text-slate-600' },
  已完成: { dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-600' },
}

const statusIcon: Record<Trip['status'], LucideIcon> = {
  规划中: Route,
  草稿: FileEdit,
  收藏: Inbox,
  已完成: CheckCircle2,
}

export default function MobileTrips() {
  const { trips, deleteTrip } = useApp()
  const [activeTab, setActiveTab] = useState<(typeof statusTabs)[number]>('全部')
  const [query, setQuery] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const kw = query.trim().toLowerCase()
    return trips.filter((trip) => {
      const matchTab = activeTab === '全部' || trip.status === activeTab
      const matchKw =
        !kw ||
        trip.title.toLowerCase().includes(kw) ||
        getCity(trip.cityId)?.name.toLowerCase().includes(kw)
      return matchTab && matchKw
    })
  }, [trips, activeTab, query])

  const counts = useMemo(() => {
    const c: Record<string, number> = { 全部: trips.length }
    for (const s of statusTabs.slice(1)) c[s] = trips.filter((t) => t.status === s).length
    return c
  }, [trips])

  return (
    <AppLayout sidebar={false}>
      <div className="mx-auto w-full max-w-md px-4 pb-8 pt-4">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><span className="h-5 w-1.5 rounded-full bg-gradient-to-b from-brand-500 to-locate-500" aria-hidden="true" />我的行程</h1>
            <p className="mt-0.5 text-xs text-slate-500">共 {trips.length} 个行程，随时查看与推进</p>
          </div>
          <Link
            to="/new-trip"
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm active:scale-95"
          >
            <Plus size={17} aria-hidden="true" /> 新建
          </Link>
        </div>

        {/* 搜索 */}
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
          <Search size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索行程名称或城市"
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="清除搜索" className="text-slate-300">
              <X size={15} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* 状态筛选 */}
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {statusTabs.map((tab) => {
            const active = activeTab === tab
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  active ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                {tab}
                <span className={`text-xs ${active ? 'text-white/70' : 'text-slate-400'}`}>
                  {counts[tab] ?? 0}
                </span>
              </button>
            )
          })}
        </div>

        {/* 行程列表 */}
        {filtered.length > 0 ? (
          <div className="mt-4 space-y-3">
            {filtered.map((trip) => {
              const meta = statusMeta[trip.status]
              const SIcon = statusIcon[trip.status]
              const city = getCity(trip.cityId)
              return (
                <div
                  key={trip.id}
                  className="touch-press overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
                >
                  <Link
                    to={`/trip/${trip.id}`}
                    className="card-interactive block"
                    aria-label={`查看行程：${trip.title}`}
                  >
                    <div className="relative h-28 w-full">
                      <SmartImage
                        src={trip.cover}
                        alt={trip.title}
                        fallbackText={trip.title}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/20 to-transparent" />
                      <span className={`chip absolute right-2.5 top-2.5 ${meta.chip}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                        {trip.status}
                      </span>
                      <div className="absolute inset-x-0 bottom-0 p-3">
                        <p className="truncate text-base font-bold text-white">{trip.title}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/80">
                          <MapPin size={11} aria-hidden="true" />
                          {city?.name ?? '未知'} · {trip.startDate} ~ {trip.endDate}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 divide-x divide-slate-100 px-1 py-2.5 text-center">
                      <Stat icon={Calendar} label="天数" value={`${trip.days}天`} />
                      <Stat icon={Users} label="人数" value={`${trip.travelers}人`} />
                      <Stat icon={Wallet} label="预算" value={`¥${(trip.budget / 1000).toFixed(0)}k`} />
                      <Stat icon={Star} label="方案" value={trip.planType} />
                    </div>
                  </Link>
                  <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2">
                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                      <SIcon size={11} aria-hidden="true" />
                      <span>{trip.totalDuration}</span>
                    </div>
                    <button
                      onClick={() => setConfirmId(trip.id)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 transition active:bg-slate-50"
                      aria-label={`删除行程：${trip.title}`}
                    >
                      <Trash2 size={13} aria-hidden="true" /> 删除
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState
            query={query}
            hasTrips={trips.length > 0}
            onReset={() => {
              setQuery('')
              setActiveTab('全部')
            }}
          />
        )}
      </div>

      {/* 删除确认 */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-6" onClick={() => setConfirmId(null)}>
          <div className="w-full max-w-xs rounded-2xl bg-white p-5 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-risk-50">
              <Trash2 size={22} className="text-risk-500" aria-hidden="true" />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-800">删除这个行程？</p>
            <p className="mt-1 text-xs text-slate-500">删除后无法恢复，行程数据将永久清除。</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setConfirmId(null)} className="btn-ghost flex-1 py-2 text-sm">
                取消
              </button>
              <button
                onClick={() => {
                  deleteTrip(confirmId)
                  setConfirmId(null)
                }}
                className="btn-danger flex-1 py-2 text-sm"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="px-1">
      <Icon size={14} className="mx-auto text-slate-400" aria-hidden="true" />
      <p className="mt-1 truncate text-xs font-semibold text-slate-700">{value}</p>
      <p className="text-[10px] text-slate-400">{label}</p>
    </div>
  )
}

function EmptyState({ query, hasTrips, onReset }: { query: string; hasTrips: boolean; onReset: () => void }) {
  const isSearching = Boolean(query)
  return (
    <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-12 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-500">
        {isSearching ? <Search size={28} aria-hidden="true" /> : <Calendar size={28} aria-hidden="true" />}
      </span>
      <div>
        <p className="text-sm font-semibold text-slate-700">
          {isSearching ? '没有找到匹配的行程' : hasTrips ? '该分类下暂无行程' : '还没有任何行程'}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {isSearching ? '试试其他关键词，或清空筛选条件' : '填写目的地与偏好，AI 一键生成专属路线'}
        </p>
      </div>
      {isSearching ? (
        <button onClick={onReset} className="btn-soft px-4 py-2 text-sm">
          清空筛选
        </button>
      ) : (
        <Link to="/new-trip" className="btn-primary px-5 py-2 text-sm">
          <Plus size={16} aria-hidden="true" /> 创建行程
        </Link>
      )}
    </div>
  )
}
