import { Sparkles } from 'lucide-react'
import { Card, Tag } from '../../components/ui'
import { useApp } from '../../store/AppContext'

const preferenceOptions = [
  { label: '自然风光', icon: '🏔️' },
  { label: '历史古迹', icon: '🏛️' },
  { label: '美食打卡', icon: '🍜' },
  { label: '网红拍照', icon: '📸' },
  { label: '购物', icon: '🛍️' },
  { label: '文艺展览', icon: '🎨' },
  { label: '亲子乐园', icon: '🎡' },
  { label: '夜生活', icon: '🌙' },
  { label: '户外运动', icon: '🚵' },
  { label: '主题公园', icon: '🎢' },
  { label: '宗教寺庙', icon: '⛩️' },
  { label: '科技体验', icon: '🤖' },
]
const cuisines = ['本帮菜', '火锅', '烧烤', '日料', '西餐', '素食', '海鲜', '小吃街']
const paceOptions = [
  { label: '轻松悠闲', desc: '每天 1-2 个景点' },
  { label: '均衡舒适', desc: '每天 3-4 个景点', recommended: true },
  { label: '紧凑丰富', desc: '每天 5+ 个景点' },
]
const companionOptions = ['有小孩', '老人同行', '宠物友好', '无障碍需求']

export default function StepPreference({ onNext, onPrev }: { onNext: () => void; onPrev: () => void }) {
  const { draft, updateDraft } = useApp()

  const toggle = (key: 'interests' | 'cuisines', value: string) =>
    updateDraft({
      [key]: draft[key].includes(value) ? draft[key].filter((item) => item !== value) : [...draft[key], value],
    } as never)

  const toggleCompanion = (value: string) => {
    if (value === '无障碍需求') {
      updateDraft({ accessibility: !draft.accessibility })
      return
    }
    updateDraft({ partner: draft.partner === value ? '' : value })
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-200/80 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="section-eyebrow">步骤 02</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">偏好设置</h2>
            <p className="mt-1 text-sm text-slate-500">用兴趣、餐饮和节奏偏好约束 AI 推荐，减少泛化路线。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Tag tone="blue">{draft.interests.length} 个兴趣</Tag>
            <Tag tone="orange">{draft.cuisines.length} 个餐饮偏好</Tag>
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="dark-command-surface shrink-0 p-5">
          <div className="flex h-full flex-col justify-between gap-8">
            <div>
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10">
                <Sparkles size={22} className="text-white" aria-hidden="true" />
              </span>
              <p className="mt-5 text-sm font-semibold text-white/70">AI 智能规划</p>
              <h3 className="mt-2 text-2xl font-semibold leading-tight text-white">个性化您的旅程</h3>
              <p className="mt-3 text-sm leading-6 text-white/60">偏好越清晰，路线越贴合你的节奏、预算和同行人群。</p>
            </div>
            <div className="space-y-3">
              {['兴趣权重识别', '餐饮偏好匹配', '节奏密度控制', '同行需求保护'].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-white/80">
                  <span className="h-2 w-2 rounded-full bg-locate-400" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-6">
          <section className="form-section">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-900">兴趣偏好</h3>
              <p className="mt-1 text-xs text-slate-500">多选后会影响 POI 类型、每日主题和路线密度。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {preferenceOptions.map((option) => {
                const active = draft.interests.includes(option.label)
                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => toggle('interests', option.label)}
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
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-900">美食偏好</h3>
              <p className="mt-1 text-xs text-slate-500">会影响餐饮节点、人均预算和午晚餐位置选择。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {cuisines.map((item) => {
                const active = draft.cuisines.includes(item)
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggle('cuisines', item)}
                    className={`chip border ${active ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600'}`}
                    aria-pressed={active}
                  >
                    {item}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="form-section">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">出行节奏</h3>
            <div className="grid gap-2 md:grid-cols-3">
              {paceOptions.map((option) => {
                const active = draft.pace === option.label
                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => updateDraft({ pace: option.label })}
                    className={`min-h-20 rounded-lg border p-3 text-left transition-colors ${
                      active ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'
                    }`}
                    aria-pressed={active}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      {option.label}
                      {option.recommended && <Tag tone="blue">推荐</Tag>}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">{option.desc}</span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="form-section">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">同行偏好</h3>
            <div className="flex flex-wrap gap-2">
              {companionOptions.map((item) => {
                const active = item === '无障碍需求' ? draft.accessibility : draft.partner === item
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleCompanion(item)}
                    className={`chip border ${active ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600'}`}
                    aria-pressed={active}
                  >
                    {item}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="form-section">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-900">特殊需求</span>
              <textarea
                value={draft.specialNeeds}
                onChange={(event) => updateDraft({ specialNeeds: event.target.value })}
                rows={3}
                className="input min-h-24 resize-none"
                placeholder="如：素食主义、轮椅可通行、避开吸烟区..."
              />
            </label>
          </section>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white/95 p-4 backdrop-blur">
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={onPrev} className="btn-ghost px-8 py-2.5" aria-label="返回基础信息">
            上一步
          </button>
          <button type="button" onClick={onNext} className="btn-primary px-8 py-2.5" aria-label="进入约束条件">
            下一步
          </button>
        </div>
      </div>
    </Card>
  )
}
