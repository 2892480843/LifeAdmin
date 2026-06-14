import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react'
import { Card } from '../../components/ui'
import { generateRoutePlans, isAgentRequestCanceled } from '../../services/agent'
import { useApp } from '../../store/AppContext'
import { createDraftRoutePlans } from '../../utils/tripBuilders'
import type { RoutePlan } from '../../types'

const steps = [
  '分析用户偏好及风格偏好',
  '检索目的地 POI 与景区开放信息',
  '计算最优路线与交通连接方案',
  '优化路线顺序与交通衔接方式',
  '生成个性化行程方案',
]

export default function StepGenerating({ onDone }: { onDone: (plans: RoutePlan[]) => void }) {
  const { draft, loadPoisByCityId } = useApp()
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    let cancelled = false
    let plans: RoutePlan[] = []
    const controller = new AbortController()
    const interval = window.setInterval(() => {
      setCurrentStep((step) => Math.min(step + 1, steps.length - 1))
    }, 600)

    const createAlignedPlans = async () => {
      const pois = draft.cityId ? await loadPoisByCityId(draft.cityId).catch(() => []) : []
      return createDraftRoutePlans(draft, pois)
    }

    const run = async () => {
      try {
        const result = await generateRoutePlans(draft, {
          signal: controller.signal,
          timeoutMs: 15_000,
        })
        if (cancelled || controller.signal.aborted) return
        if (result.plans.length > 0) plans = result.plans
      } catch (error) {
        if (cancelled || isAgentRequestCanceled(error)) return
      }

      if (plans.length === 0) {
        plans = await createAlignedPlans()
        if (cancelled || controller.signal.aborted) return
      }

      window.setTimeout(() => {
        if (cancelled) return
        window.clearInterval(interval)
        setCurrentStep(steps.length)
        window.setTimeout(() => {
          if (!cancelled) onDone(plans)
        }, 600)
      }, steps.length * 600)
    }

    run()

    return () => {
      cancelled = true
      controller.abort()
      window.clearInterval(interval)
    }
  }, [draft, loadPoisByCityId, onDone])

  const progress = Math.min(100, Math.round((currentStep / steps.length) * 100))
  const remaining = Math.max(0, 30 - currentStep * 6)

  return (
    <Card className="page-enter overflow-hidden">
      <div className="flex min-h-[620px] flex-col items-center justify-center px-5 py-14">
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="flex h-24 w-24 animate-float-soft items-center justify-center rounded-full bg-brand-100">
              <Sparkles size={40} className="text-brand-600" aria-hidden="true" />
            </div>
            <div className="absolute inset-0 animate-ping rounded-full border-2 border-brand-200 opacity-20" />
          </div>
        </div>

        <h2 className="text-center text-xl font-semibold text-slate-950">正在为你生成最优行程...</h2>

        <div className="mx-auto mt-6 max-w-sm space-y-3">
          {steps.map((step, index) => (
            <div key={step} className={`flex items-center gap-3 transition-all duration-300 ${index <= currentStep ? 'opacity-100' : 'opacity-40'}`}>
              {index < currentStep ? (
                <CheckCircle2 className="shrink-0 text-emerald-500" size={20} aria-hidden="true" />
              ) : index === currentStep ? (
                <Loader2 className="shrink-0 animate-spin text-brand-600" size={20} aria-hidden="true" />
              ) : (
                <div className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-200" />
              )}
              <span className={`text-sm ${index < currentStep ? 'text-slate-600' : index === currentStep ? 'font-medium text-brand-700' : 'text-slate-500'}`}>
                {step}
              </span>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-8 w-full max-w-sm">
          <div className="mb-1.5 flex justify-between text-xs text-slate-500">
            <span>总体进度</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-locate-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-3 text-center text-xs text-slate-500">预计剩余 {remaining} 秒</p>
        </div>

        <p className="mx-auto mt-8 max-w-md text-center text-xs leading-5 text-slate-500">
          系统正在综合您的偏好数据，为您制定最合适的旅行路线。结果仅供参考，实际情况请以景区官方信息为准。
        </p>
      </div>
    </Card>
  )
}
