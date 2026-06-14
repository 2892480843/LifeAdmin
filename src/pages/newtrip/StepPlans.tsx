import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Crown, Info, Star } from 'lucide-react'
import { Card, Tag } from '../../components/ui'
import SmartImage from '../../components/ui/SmartImage'
import { useApp } from '../../store/AppContext'
import { createDraftRoutePlans, selectedPlanTripId } from '../../utils/tripBuilders'
import type { PlanType, RoutePlan } from '../../types'

const routeTypeFilters: { key: PlanType; label: string; desc: string; bar: string; aiReason: string }[] = [
  { key: '效率优先', label: '经典均衡路线', desc: '效率最高，覆盖核心景点', bar: 'bg-brand-600', aiReason: '路线优先覆盖城市核心地标，交通衔接紧凑，适合首次到访或时间有限的用户。' },
  { key: '体验优先', label: '文艺探索家', desc: '放慢节奏，深度体验', bar: 'bg-violet-500', aiReason: '路线保留更多街区探索和拍照停留时间，更适合慢节奏体验与内容创作。' },
  { key: '预算优先', label: '黄金探险家', desc: '性价比最优，控制预算', bar: 'bg-emerald-500', aiReason: '路线减少高门票和长距离交通支出，优先选择地铁可达与免费开放点位。' },
]

const typeTone: Record<PlanType, 'blue' | 'purple' | 'green'> = {
  效率优先: 'blue',
  体验优先: 'purple',
  预算优先: 'green',
}

export default function StepPlans({ plans }: { plans?: RoutePlan[] }) {
  const navigate = useNavigate()
  const { draft, setSelectedPlan } = useApp()
  const displayPlans = plans && plans.length > 0 ? plans : createDraftRoutePlans(draft)
  const [activeType, setActiveType] = useState<PlanType>('效率优先')
  const [selectedPlanId, setSelectedPlanId] = useState(() => displayPlans.find((plan) => plan.recommended)?.id ?? displayPlans[0]?.id ?? '')
  const visiblePlans = displayPlans.slice(0, 3)
  const selectedPlan = displayPlans.find((plan) => plan.id === selectedPlanId) ?? visiblePlans[0] ?? displayPlans[0]
  const selectedPlanMeta = selectedPlan
    ? routeTypeFilters.find((item) => item.key === selectedPlan.type) ?? routeTypeFilters[0]
    : routeTypeFilters[0]
  const detailRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (displayPlans.some((plan) => plan.id === selectedPlanId)) return
    setSelectedPlanId(displayPlans.find((plan) => plan.recommended)?.id ?? displayPlans[0]?.id ?? '')
  }, [displayPlans, selectedPlanId])

  const openPlan = (plan: RoutePlan) => {
    setSelectedPlan(plan)
    navigate(`/trip/${selectedPlanTripId(plan)}`)
  }

  const showPlanDetails = (plan: RoutePlan) => {
    setSelectedPlanId(plan.id)
    setActiveType(plan.type)
    window.requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  return (
    <div className="page-enter space-y-4">
      <div className="command-surface px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="section-eyebrow">方案对比</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">推荐方案对比</h2>
            <p className="mt-1 text-sm text-slate-500">选择一个策略，右侧会同步展示节点、预算和推荐依据。</p>
          </div>
          <div className="route-plan-type-tabs" role="tablist" aria-label="路线类型">
            {routeTypeFilters.map((filter) => {
              const active = activeType === filter.key
              return (
                <button
                  key={filter.key}
                  type="button"
                  className={`segmented-item shrink-0 ${active ? 'segmented-item-active' : ''}`}
                  onClick={() => {
                    const nextType = filter.key
                    setActiveType(nextType)
                    const next = displayPlans.find((plan) => plan.type === nextType)
                    if (next) setSelectedPlanId(next.id)
                  }}
                  role="tab"
                  aria-selected={active}
                >
                  <span>{filter.label}</span>
                  <span className="hidden text-xs font-normal text-slate-500 2xl:inline">{filter.desc}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="route-plan-workbench">
        <div className="route-plan-list">
          {visiblePlans.length === 0 && (
            <div className="col-span-full py-12 text-center">
              <p className="text-sm text-slate-500">暂无可用方案</p>
            </div>
          )}
          {visiblePlans.map((plan) => {
            const meta = routeTypeFilters.find((item) => item.key === plan.type) ?? routeTypeFilters[0]
            const selected = selectedPlanId === plan.id
            const planReason = plan.aiReason ?? meta.aiReason
            return (
              <Card key={plan.id} className={`route-plan-card-compact card-interactive overflow-hidden ${selected ? 'ring-2 ring-brand-500' : ''}`}>
                <div className={`h-[3px] ${meta.bar}`} />
                <button
                  type="button"
                  className="block w-full p-3 text-left"
                  onClick={() => showPlanDetails(plan)}
                  aria-label={`查看${plan.name}详情。推荐依据：${planReason}`}
                  aria-pressed={selected}
                >
                  <div className="flex min-w-0 gap-3">
                    <SmartImage
                      src={plan.stops[0]?.cover ?? ''}
                      alt={plan.name}
                      fallbackText={plan.name}
                      className="h-20 w-24 shrink-0 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                        {plan.recommended && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
                            <Crown size={11} aria-hidden="true" /> 推荐
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-500">
                          <Star size={12} className="fill-amber-400 text-amber-400" aria-hidden="true" />
                          {plan.satisfaction}%
                        </span>
                        <Tag tone={typeTone[plan.type]}>{plan.type}</Tag>
                      </div>
                      <h3 className="truncate text-sm font-semibold text-slate-950">{plan.name}</h3>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{plan.summary}</p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-4 gap-2 border-t border-slate-100 pt-3">
                    {[
                      { label: '天数', value: `${plan.days}天` },
                      { label: '距离', value: `${plan.distance}km` },
                      { label: '预算', value: `¥${plan.budget}` },
                      { label: '节点', value: `${plan.stops.length}个` },
                    ].map((item) => (
                      <div key={item.label} className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950">{item.value}</p>
                        <p className="text-xs text-slate-500">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </button>
                <div className="flex gap-2 border-t border-slate-100 p-3 pt-2">
                  <button
                    type="button"
                    className={`btn-ghost min-h-9 flex-1 px-3 py-1.5 text-xs ${selected ? 'border-brand-300 bg-brand-50 text-brand-700' : ''}`}
                    onClick={() => showPlanDetails(plan)}
                  >
                    <Info size={14} aria-hidden="true" /> 查看
                  </button>
                  <button type="button" onClick={() => openPlan(plan)} className="btn-primary min-h-9 flex-1 px-3 py-1.5 text-xs">
                    <CheckCircle2 size={14} aria-hidden="true" /> 选用
                  </button>
                </div>
              </Card>
            )
          })}
        </div>

        {selectedPlan && (
          <div ref={detailRef}>
            <Card className="p-4 sm:p-5 xl:sticky xl:top-24">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="section-eyebrow">方案详情</p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950">{selectedPlan.name}</h2>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{selectedPlan.summary}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Tag tone={typeTone[selectedPlan.type]}>{selectedPlan.type}</Tag>
                  <button type="button" onClick={() => openPlan(selectedPlan)} className="btn-primary min-h-9 px-3 py-1.5 text-xs">
                    <CheckCircle2 size={14} aria-hidden="true" /> 选用方案
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                {[
                  { label: '天数', value: `${selectedPlan.days}天` },
                  { label: '总时长', value: selectedPlan.totalDuration },
                  { label: '预算', value: `¥${selectedPlan.budget}` },
                  { label: '满意度', value: `${selectedPlan.satisfaction}%` },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <p className="text-xs text-slate-500">{item.label}</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="route-plan-detail-grid mt-5">
                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-800">路线节点</p>
                    <span className="text-xs text-slate-500">{selectedPlan.stops.length} 站</span>
                  </div>
                  <div className="max-h-[34rem] space-y-2 overflow-y-auto pr-1">
                    {selectedPlan.stops.map((stop, index) => (
                      <div key={`${selectedPlan.id}-${stop.poiId}-${stop.order}`} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                          {index + 1}
                        </span>
                        <SmartImage src={stop.cover} alt={stop.name} fallbackText={stop.name} className="h-11 w-14 rounded-md object-cover" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">{stop.name}</p>
                          <p className="text-xs text-slate-500">第 {stop.order} 站</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="route-plan-decision-panel">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-700">
                    <Info size={14} aria-hidden="true" /> Agent 推荐依据
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{selectedPlan.aiReason ?? selectedPlanMeta.aiReason}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {selectedPlan.tags.slice(0, 4).map((tag) => (
                      <Tag key={tag} tone="gray">{tag}</Tag>
                    ))}
                  </div>
                  <button type="button" onClick={() => openPlan(selectedPlan)} className="btn-primary mt-4 w-full py-2 text-sm">
                    <CheckCircle2 size={15} aria-hidden="true" /> 选用该方案
                  </button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
