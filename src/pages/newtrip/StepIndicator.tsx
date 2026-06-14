import { Check } from 'lucide-react'

const steps = ['基础信息', '偏好设置', '约束条件', '生成行程']

// 新建行程步骤条
export default function StepIndicator({ current }: { current: number }) {
  return (
    <div className="command-surface overflow-x-auto px-3 py-3" aria-label="新建行程步骤进度">
      <div className="flex min-w-max items-center justify-center sm:min-w-0">
        {steps.map((label, i) => {
          const done = i < current
          const active = i === current
          return (
            <div key={label} className="flex items-center">
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-sm font-semibold shadow-sm transition-colors ${
                    done
                      ? 'bg-brand-600 text-white'
                    : active
                      ? 'node-pulse bg-brand-600 text-white ring-4 ring-brand-100'
                      : 'border-slate-300 bg-white text-slate-400'
                  }`}
                  aria-current={active ? 'step' : undefined}
                >
                  {done ? <Check size={16} aria-hidden="true" /> : i + 1}
                </span>
                <span
                  className={`hidden text-sm font-medium sm:inline ${
                    active ? 'text-brand-700' : done ? 'text-slate-800' : 'text-slate-400'
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`mx-2 h-px w-8 sm:mx-4 sm:w-12 lg:w-20 ${done ? 'bg-gradient-to-r from-brand-500 to-locate-500' : 'bg-slate-200'}`}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
