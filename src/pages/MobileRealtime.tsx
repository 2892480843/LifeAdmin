import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  Bot,
  CheckCircle2,
  Clock,
  CloudRain,
  Footprints,
  Hourglass,
  MapPin,
  Radio,
  Sparkles,
  TrafficCone,
  Users,
} from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import { useApp } from '../store/AppContext'
import { realtimeEvents, dynamicLogs } from '../mock'
import type { EventType, RealtimeEvent } from '../types'

const eventTypeMeta: Record<EventType, { icon: LucideIcon; bg: string; iconColor: string; action: string }> = {
  交通拥堵: { icon: TrafficCone, bg: 'bg-rose-50', iconColor: 'text-rose-600', action: '改乘地铁或绕行' },
  天气变化: { icon: CloudRain, bg: 'bg-brand-50', iconColor: 'text-brand-600', action: '准备室内备选' },
  排队提醒: { icon: Hourglass, bg: 'bg-amber-50', iconColor: 'text-amber-600', action: '错峰或预约' },
  景点拥挤: { icon: Users, bg: 'bg-amber-50', iconColor: 'text-amber-600', action: '延后抵达' },
}

const levelMeta: Record<RealtimeEvent['level'], { dot: string; chip: string }> = {
  高: { dot: 'bg-risk-500', chip: 'bg-risk-50 text-risk-600' },
  中: { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-600' },
  低: { dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-600' },
}

const logTone = { info: 'bg-brand-500', success: 'bg-emerald-500', warning: 'bg-amber-500' }

export default function MobileRealtime() {
  const { trips } = useApp()
  const activeTrip = useMemo(
    () => trips.find((trip) => trip.status === '规划中') ?? trips[0] ?? null,
    [trips],
  )
  const activeDay = useMemo(() => {
    if (!activeTrip) return null
    return activeTrip.itinerary.find((day) => day.items.some((item) => item.status === '进行中')) ?? activeTrip.itinerary[0] ?? null
  }, [activeTrip])

  const nextStop = useMemo(() => {
    const items = activeDay?.items ?? []
    return items.find((item) => item.status === '进行中') ?? items[0] ?? null
  }, [activeDay])

  const completedCount = activeDay?.items.filter((item) => item.status === '已完成').length ?? 0
  const totalItems = activeDay?.items.length ?? 0
  const progressPct = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0

  const highCount = realtimeEvents.filter((e) => e.level === '高').length
  const midCount = realtimeEvents.filter((e) => e.level === '中').length
  const lowCount = realtimeEvents.filter((e) => e.level === '低').length

  return (
    <AppLayout sidebar={false}>
      <div className="mx-auto w-full max-w-md px-4 pb-8 pt-4">
        {/* 标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">实时动态</h1>
            <p className="mt-0.5 text-xs text-slate-500">AI 持续监测行程风险，实时推送提醒</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            监测中
          </span>
        </div>

        {/* 进行中行程卡片 */}
        {activeTrip && activeDay ? (
          <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="bg-gradient-to-br from-brand-600 to-locate-600 px-4 py-3 text-white">
              <div className="flex items-center justify-between">
                <p className="truncate text-sm font-bold">{activeTrip.title}</p>
                <span className="shrink-0 text-[11px] text-white/70">{activeDay.title}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-white/70" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-white/75">
                <span>已完成 {completedCount}/{totalItems} 个行程节点</span>
                <span>{progressPct}%</span>
              </div>
            </div>
            {nextStop && (
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Footprints size={16} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-slate-400">下一站</p>
                  <p className="truncate text-sm font-semibold text-slate-800">{nextStop.name}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-medium text-slate-600">{nextStop.time}</p>
                  <p className="text-[10px] text-slate-400">{nextStop.transport}</p>
                </div>
              </div>
            )}
          </section>
        ) : (
          <Link to="/new-trip" className="mt-4 flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Sparkles size={18} aria-hidden="true" />
            </span>
            <span className="min-w-0 text-sm text-slate-600">还没有进行中的行程，去创建第一个</span>
          </Link>
        )}

        {/* 风险概览 */}
        <section className="mt-4 grid grid-cols-3 gap-2">
          <RiskStat level="高" count={highCount} />
          <RiskStat level="中" count={midCount} />
          <RiskStat level="低" count={lowCount} />
        </section>

        {/* 事件列表 */}
        <section className="mt-5">
          <h2 className="text-base font-bold text-slate-900">风险提醒</h2>
          <p className="mt-0.5 text-xs text-slate-500">系统监测到的实时风险事件与建议</p>
          {realtimeEvents.length > 0 ? (
            <div className="mt-3 space-y-2.5">
              {realtimeEvents.map((evt) => {
                const meta = eventTypeMeta[evt.type]
                const lvl = levelMeta[evt.level]
                const EIcon = meta.icon
                return (
                  <div key={evt.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-start gap-3 p-3.5">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.bg} ${meta.iconColor}`}>
                        <EIcon size={18} aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`chip ${lvl.chip}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${lvl.dot}`} />
                            {evt.type}
                          </span>
                          <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-400">
                            <Clock size={10} aria-hidden="true" /> {evt.time}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm font-semibold text-slate-800">{evt.title}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{evt.description}</p>
                        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
                          <MapPin size={10} aria-hidden="true" />
                          <span className="truncate">关联地点：{evt.affectedPoi}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-3.5 py-2">
                      <Sparkles size={12} className="shrink-0 text-brand-500" aria-hidden="true" />
                      <span className="text-[11px] font-medium text-slate-600">AI 建议：{meta.action}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/50 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-700">暂无风险提醒</p>
                <p className="text-xs text-slate-500">行程进展顺利，系统持续监测中</p>
              </div>
            </div>
          )}
        </section>

        {/* 动态日志 */}
        <section className="mt-6">
          <h2 className="text-base font-bold text-slate-900">行程动态</h2>
          <p className="mt-0.5 text-xs text-slate-500">系统自动记录的行程推进节点</p>
          {dynamicLogs.length > 0 && (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="space-y-3">
                {dynamicLogs.map((log, idx) => (
                  <div key={log.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className={`h-2.5 w-2.5 rounded-full ${logTone[log.type]}`} />
                      {idx < dynamicLogs.length - 1 && <span className="mt-0.5 w-px flex-1 bg-slate-200" />}
                    </div>
                    <div className="min-w-0 flex-1 pb-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-700">{log.title}</p>
                        <span className="shrink-0 text-[10px] text-slate-400">{log.time}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-5 text-slate-500">{log.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* AI 助手入口 */}
        <Link to="/realtime" className="mt-6 flex items-center gap-3 rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50 to-locate-50 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
            <Bot size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-700">智行助手</p>
            <p className="text-xs text-slate-500">问路、调整行程、获取建议</p>
          </div>
          <Radio size={16} className="shrink-0 text-brand-500" aria-hidden="true" />
        </Link>
      </div>
    </AppLayout>
  )
}

function RiskStat({ level, count }: { level: RealtimeEvent['level']; count: number }) {
  const lvl = levelMeta[level]
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm">
      <span className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full ${lvl.chip}`}>
        <span className={`h-2.5 w-2.5 rounded-full ${lvl.dot}`} />
      </span>
      <p className="mt-1.5 text-lg font-bold leading-none text-slate-900">{count}</p>
      <p className="mt-0.5 text-[11px] text-slate-400">{level}级风险</p>
    </div>
  )
}
