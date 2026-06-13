import { useCallback, useMemo, useState } from 'react'
import {
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Compass,
  MapPin,
  Route,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import AppLayout from '../../components/layout/AppLayout'
import { Tag } from '../../components/ui'
import { MetricTile, RoutePageHeader, StatusPill, SystemPanel } from '../../components/ui/RouteSystem'
import { useApp } from '../../store/AppContext'
import StepBasic from './StepBasic'
import StepConstraints from './StepConstraints'
import StepGenerating from './StepGenerating'
import StepIndicator from './StepIndicator'
import StepPlans from './StepPlans'
import StepPreference from './StepPreference'
import type { RoutePlan, TripDraft } from '../../types'

const stepLabels = ['基础信息', '偏好设置', '约束条件', '生成行程']

export default function NewTrip() {
  const { draft } = useApp()
  const [step, setStep] = useState(0)
  const [plans, setPlans] = useState<RoutePlan[]>([])

  const handleDone = useCallback((nextPlans: RoutePlan[]) => {
    setPlans(nextPlans)
    setStep(4)
  }, [])

  const activeStepLabel = step < 4 ? stepLabels[step] : '方案对比'
  const completeness = useMemo(() => {
    const items = [
      Boolean(draft.cityName),
      draft.travelType.length > 0,
      draft.interests.length > 0,
      draft.transport.length > 0,
      draft.budget > 0,
    ]
    return Math.round((items.filter(Boolean).length / items.length) * 100)
  }, [draft])

  return (
    <AppLayout>
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 py-4 sm:px-5 lg:px-6 lg:py-5">
        <RoutePageHeader
          eyebrow="Trip Builder"
          title="新建智能路线"
          description="每一步只处理当前必要信息，生成前再统一读取偏好、预算和约束。"
          meta={
            <>
              <StatusPill tone="brand">{activeStepLabel}</StatusPill>
              <StatusPill tone={completeness >= 80 ? 'emerald' : 'amber'}>草稿完整度 {completeness}%</StatusPill>
            </>
          }
        />

        <div className="sticky top-[7.25rem] z-20 lg:top-[4.5rem]">
          <StepIndicator current={Math.min(step, 3)} />
        </div>

        <MobileDraftSummary draft={draft} completeness={completeness} />

        <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 transition duration-panel">
            {step === 0 && <StepBasic onNext={() => setStep(1)} />}
            {step === 1 && <StepPreference onNext={() => setStep(2)} onPrev={() => setStep(0)} />}
            {step === 2 && <StepConstraints onNext={() => setStep(3)} onPrev={() => setStep(1)} />}
            {step === 3 && <StepGenerating onDone={handleDone} />}
            {step === 4 && <StepPlans plans={plans} />}
          </div>

          <aside className="hidden space-y-4 2xl:sticky 2xl:top-24 2xl:block 2xl:self-start">
            <DraftSummaryPanel draft={draft} step={step} />
            <PlanningSignals draft={draft} />
          </aside>
        </div>
      </div>
    </AppLayout>
  )
}

function MobileDraftSummary({
  draft,
  completeness,
}: {
  draft: TripDraft
  completeness: number
}) {
  return (
    <details className="command-surface group 2xl:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-slate-400">Draft Summary</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-900">
            {draft.cityName || '未设置旅行城市'} · {draft.days} 天 · ¥{draft.budget}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusPill tone={completeness >= 80 ? 'emerald' : 'amber'}>{completeness}%</StatusPill>
          <ChevronDown size={16} className="text-slate-400 transition group-open:rotate-180" aria-hidden="true" />
        </div>
      </summary>
      <div className="border-t border-slate-200 px-4 py-3">
        <DraftSummaryContent draft={draft} compact />
      </div>
    </details>
  )
}

function DraftSummaryPanel({ draft, step }: { draft: TripDraft; step: number }) {
  return (
    <SystemPanel accent={step === 4 ? 'emerald' : 'brand'} showAccentRail={false} className="p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="section-eyebrow">Draft Summary</p>
          <h2 className="mt-1 text-base font-semibold text-slate-950">行程草稿摘要</h2>
        </div>
        <Sparkles size={18} className="text-brand-600" aria-hidden="true" />
      </div>
      <DraftSummaryContent draft={draft} />
    </SystemPanel>
  )
}

function DraftSummaryContent({
  draft,
  compact = false,
}: {
  draft: TripDraft
  compact?: boolean
}) {
  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div className={compact ? 'grid gap-2 sm:grid-cols-2' : 'grid gap-3'}>
        <MetricTile icon={MapPin} label="旅行城市" value={draft.cityName || '未设置'} detail={`${draft.startPoint} → ${draft.endPoint}`} tone="brand" />
        <MetricTile icon={CalendarRange} label="日期" value={`${draft.days} 天`} detail={`${draft.startDate} 至 ${draft.endDate}`} tone="emerald" />
        <MetricTile icon={Users} label="同行" value={`${draft.travelers} 人`} detail={draft.partner || '未指定同伴'} tone="slate" />
        <MetricTile icon={Wallet} label="人均预算" value={`¥${draft.budget}`} detail={draft.diningBudget || '餐饮预算待定'} tone="amber" />
      </div>

      <div className="rounded-card border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Route size={16} className="text-brand-600" aria-hidden="true" /> 预计生成策略
        </div>
        <div className="flex flex-wrap gap-2">
          <Tag tone="blue">{draft.style}</Tag>
          <Tag tone="teal">{draft.pace}</Tag>
          <Tag tone={draft.avoidPeak ? 'green' : 'gray'}>{draft.avoidPeak ? '错峰优先' : '常规节奏'}</Tag>
          <Tag tone={draft.accessibility || draft.accessibleFirst ? 'green' : 'gray'}>
            {draft.accessibility || draft.accessibleFirst ? '无障碍优先' : '常规动线'}
          </Tag>
        </div>
      </div>
    </div>
  )
}

function PlanningSignals({ draft }: { draft: TripDraft }) {
  return (
    <SystemPanel accent="amber" className="p-4 sm:p-5">
      <div className="mb-4">
        <p className="section-eyebrow">Planning Signals</p>
        <h2 className="mt-1 text-base font-semibold text-slate-950">AI 会重点读取</h2>
      </div>
      <div className="space-y-3">
        <Signal icon={Compass} label="兴趣权重" value={draft.interests.length ? draft.interests.join(' / ') : '待选择'} />
        <Signal icon={Clock3} label="活动时间" value={`${draft.activityTime[0]} - ${draft.activityTime[1]}`} />
        <Signal icon={CheckCircle2} label="交通方式" value={draft.transport.length ? draft.transport.join(' / ') : '待选择'} />
      </div>
    </SystemPanel>
  )
}

function Signal({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex gap-3 rounded-card border border-slate-200 bg-white p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        <Icon size={16} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">{value}</p>
      </div>
    </div>
  )
}
