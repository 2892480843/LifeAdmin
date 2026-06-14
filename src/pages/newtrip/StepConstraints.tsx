import { Clock, ShieldCheck, Wallet } from 'lucide-react'
import { Card, Slider, Tag, Toggle } from '../../components/ui'
import { useApp } from '../../store/AppContext'

const budgetPresets = [
  { label: '经济 ¥500', value: 500 },
  { label: '舒适 ¥1500', value: 1500 },
  { label: '豪华 ¥3000', value: 3000 },
  { label: '不限', value: 5000 },
]
const dayDurations = [
  { label: '半天', time: ['09:00', '13:00'] as [string, string] },
  { label: '一天', time: ['09:00', '18:00'] as [string, string] },
  { label: '早出晚归', time: ['08:00', '22:00'] as [string, string] },
]
const transportOptions = [
  { label: '步行', icon: '🚶' },
  { label: '公共交通', icon: '🚌' },
  { label: '出租车', icon: '🚕' },
  { label: '自驾', icon: '🚗' },
  { label: '骑行', icon: '🚲' },
  { label: '地铁优先', icon: '🚇' },
]
const rangeOptions = ['市区核心（<10km）', '近郊（10-30km）', '周边城市（30km+）']

export default function StepConstraints({ onNext, onPrev }: { onNext: () => void; onPrev: () => void }) {
  const { draft, updateDraft } = useApp()

  const toggleTransport = (transport: string) =>
    updateDraft({
      transport: draft.transport.includes(transport)
        ? draft.transport.filter((item) => item !== transport)
        : [...draft.transport, transport],
    })

  const selectedDuration = dayDurations.find((item) => item.time[0] === draft.activityTime[0] && item.time[1] === draft.activityTime[1])?.label

  const switches = [
    { label: '避开人多场景', desc: '优先错峰，降低排队与拥挤风险', checked: draft.avoidPeak, onChange: (value: boolean) => updateDraft({ avoidPeak: value }) },
    { label: '景区需提前预约', desc: '优先提醒需要预约的景点安排', checked: draft.freeFirst, onChange: (value: boolean) => updateDraft({ freeFirst: value }) },
    { label: '可接受室内活动', desc: '天气变化时可以切换到室内备选', checked: draft.indoorFirst, onChange: (value: boolean) => updateDraft({ indoorFirst: value }) },
    { label: '无障碍通行需求', desc: '优先路线平缓、换乘更少的方案', checked: draft.accessibleFirst, onChange: (value: boolean) => updateDraft({ accessibleFirst: value }) },
    { label: '儿童友好场所', desc: '优先亲子设施完善、节奏轻松的点位', checked: draft.childFriendly, onChange: (value: boolean) => updateDraft({ childFriendly: value }) },
  ]

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-200/80 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="section-eyebrow">步骤 03</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">约束条件</h2>
            <p className="mt-1 text-sm text-slate-500">把预算、时间、交通与容忍度变成 AI 可执行的路线边界。</p>
          </div>
          <Tag tone="green">约束内优化</Tag>
        </div>
      </div>

      <div className="space-y-6 p-4 sm:p-6">
        <section className="form-section">
          <div className="mb-4 flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-900" id="budget-range-label">
              <Wallet size={17} className="text-brand-600" aria-hidden="true" /> 人均预算
            </label>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">¥{draft.budget}</span>
          </div>
          <Slider
            name="budget"
            value={draft.budget}
            min={500}
            max={5000}
            step={100}
            onChange={(value) => updateDraft({ budget: value })}
            ariaLabel="调整人均预算"
          />
          <div className="mt-1 flex justify-between text-xs text-slate-500">
            <span>¥500</span>
            <span className="text-sm font-semibold text-brand-600">当前: ¥{draft.budget}</span>
            <span>¥5000+</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {budgetPresets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => updateDraft({ budget: preset.value })}
                className={`chip border ${draft.budget === preset.value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600'}`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </section>

        <section className="form-section">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Clock size={17} className="text-brand-600" aria-hidden="true" /> 每日行程时长
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {dayDurations.map((option) => {
              const active = selectedDuration === option.label
              return (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => updateDraft({ activityTime: option.time })}
                  className={`min-h-10 rounded-lg border px-3 py-2 text-sm text-center transition-colors ${
                    active
                      ? 'border-brand-500 bg-brand-50 font-semibold text-brand-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'
                  }`}
                  aria-pressed={active}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </section>

        <section className="form-section">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">交通偏好</h3>
              <p className="text-xs text-slate-500">多选后会影响相邻 POI 的换乘策略和步行距离。</p>
            </div>
            <Tag tone="blue">{draft.transport.length} 项可用</Tag>
          </div>
          <div className="flex flex-wrap gap-2">
            {transportOptions.map((option) => {
              const active = draft.transport.includes(option.label)
              return (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => toggleTransport(option.label)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? 'border-brand-500 bg-brand-50 font-medium text-brand-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'
                  }`}
                  aria-pressed={active}
                >
                  <span aria-hidden="true">{option.icon}</span>
                  <span>{option.label}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="form-section">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">可前往景点范围</h3>
          <div className="flex flex-col gap-2 sm:flex-row">
            {rangeOptions.map((option) => {
              const active = draft.walkRange === option
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => updateDraft({ walkRange: option })}
                  className={`flex-1 rounded-lg border p-3 text-center text-sm transition-colors ${
                    active
                      ? 'border-brand-500 bg-brand-50 font-semibold text-brand-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'
                  }`}
                  aria-pressed={active}
                >
                  {option}
                </button>
              )
            })}
          </div>
        </section>

        <section className="form-section">
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck size={17} className="text-brand-600" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-slate-900">其他约束</h3>
          </div>
          <div>
            {switches.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0">
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{item.desc}</p>
                </div>
                <Toggle checked={item.checked} onChange={item.onChange} ariaLabel={`切换${item.label}`} />
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white/95 p-4 backdrop-blur">
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={onPrev} className="btn-ghost px-8 py-2.5" aria-label="返回偏好设置">
            上一步
          </button>
          <button type="button" onClick={onNext} className="btn-primary px-8 py-2.5" aria-label="开始生成行程">
            生成行程
          </button>
        </div>
      </div>
    </Card>
  )
}
