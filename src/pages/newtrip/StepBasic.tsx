import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowRight, Calendar, Flag, MapPin, Navigation, Route, Users } from 'lucide-react'
import { Card, ChipSelect, CitySelect, Tag } from '../../components/ui'
import { useApp } from '../../store/AppContext'
import { addMockDays, cities, cityOptionGroups } from '../../mock'

const CUSTOM_CITY_OPTION = '__custom-city__'
const travelTypes = ['城市观光', '美食游', '亲子游', '文化游', '休闲度假', '购物', '自然风光', '历史人文']
const styles = ['经典热门', '小众深度', '轻松悠闲', '紧凑高效']
const dayOptions = [
  { label: '1天', value: 1 },
  { label: '2天', value: 2 },
  { label: '3天', value: 3 },
  { label: '4天', value: 4 },
  { label: '4天以上', value: 5 },
]
const travellerOptions = ['个人/独旅', '情侣出行', '亲子游', '商务出行', '团队游', '老年游']
const travellerIcons: Record<string, string> = {
  '个人/独旅': '🎒',
  情侣出行: '💑',
  亲子游: '👨‍👩‍👧',
  商务出行: '💼',
  团队游: '👥',
  老年游: '👴',
}

export default function StepBasic({ onNext }: { onNext: () => void }) {
  const { draft, updateDraft } = useApp()
  const selectedCity = cities.find((city) => city.id === draft.cityId)
  const hasCustomCity = draft.cityName !== (selectedCity?.name ?? '')
  const customCityLabel = draft.cityName.trim() || '自定义目的地'

  const selectCity = (cityId: string) => {
    if (cityId === CUSTOM_CITY_OPTION) return
    const city = cities.find((item) => item.id === cityId)
    if (!city) return
    updateDraft({ cityId: city.id, cityName: city.name, startPoint: city.name, endPoint: city.name })
  }

  const updateCustomCityName = (cityName: string) => {
    updateDraft({
      cityName,
      ...(draft.startPoint === draft.cityName ? { startPoint: cityName } : {}),
      ...(draft.endPoint === draft.cityName ? { endPoint: cityName } : {}),
    })
  }

  const toggleType = (type: string) =>
    updateDraft({
      travelType: draft.travelType.includes(type)
        ? draft.travelType.filter((item) => item !== type)
        : [...draft.travelType, type],
    })

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-200/80 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="section-eyebrow">步骤 01</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">基础信息</h2>
            <p className="mt-1 text-sm text-slate-500">当前只需要确认旅行城市、日期、人数和行程任务，其他偏好留到下一步。</p>
          </div>
          <Tag tone="blue">草稿自动保存</Tag>
        </div>
      </div>

      <div className="space-y-6 p-4 sm:p-6">
        <section className="form-section bg-slate-50/70">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <MapPin size={17} aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">旅行城市</h3>
              <p className="text-xs text-slate-500">支持热门城市，也支持继续使用指挥台输入的自定义目的地。</p>
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-[1fr_0.8fr]">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">城市 / 地区</span>
              <CitySelect
                value={hasCustomCity ? CUSTOM_CITY_OPTION : draft.cityId}
                onChange={selectCity}
                groups={cityOptionGroups}
                ariaLabel="选择目的地城市"
                icon={MapPin}
                customOption={hasCustomCity ? { value: CUSTOM_CITY_OPTION, label: customCityLabel } : undefined}
              />
            </label>
            {hasCustomCity && (
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">自定义目的地名称</span>
                <input
                  type="text"
                  name="custom-destination"
                  autoComplete="address-level2"
                  value={draft.cityName}
                  onChange={(event) => updateCustomCityName(event.target.value)}
                  className="input"
                  placeholder="输入自定义目的地"
                />
              </label>
            )}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="form-section">
            <div className="mb-3 flex items-center gap-2">
              <Route size={17} className="text-brand-600" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-slate-900">行程天数</h3>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {dayOptions.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => updateDraft({ days: option.value, endDate: addMockDays(draft.startDate, option.value - 1) })}
                  className={`min-h-10 rounded-lg border px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 ${
                    draft.days === option.value
                      ? 'border-brand-500 bg-brand-50 font-semibold text-brand-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'
                  }`}
                  aria-label={`设置行程为${option.label}`}
                  aria-pressed={draft.days === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-section grid gap-4 sm:grid-cols-3">
            <Field label="出发日期" icon={Calendar}>
              <input
                type="date"
                name="start-date"
                value={draft.startDate}
                onChange={(event) => updateDraft({ startDate: event.target.value, endDate: addMockDays(event.target.value, draft.days - 1) })}
                className="w-full bg-transparent py-2.5 text-sm outline-none"
              />
            </Field>
            <Field label="返回日期" icon={Calendar}>
              <input
                type="date"
                name="end-date"
                value={draft.endDate}
                onChange={(event) => updateDraft({ endDate: event.target.value })}
                className="w-full bg-transparent py-2.5 text-sm outline-none"
              />
            </Field>
            <Field label="出行人数" icon={Users}>
              <input
                type="number"
                name="travelers"
                min={1}
                inputMode="numeric"
                value={draft.travelers}
                onChange={(event) => updateDraft({ travelers: normalizeTravelers(event.target.value) })}
                className="w-full bg-transparent py-2.5 text-sm outline-none"
              />
            </Field>
          </div>
        </section>

        <section className="form-section">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">出行类型</h3>
              <p className="text-xs text-slate-500">用于决定推荐节奏、餐饮与交通舒适度。</p>
            </div>
            <Tag tone="gray">{draft.travellerType || '未选择'}</Tag>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {travellerOptions.map((option) => {
              const active = draft.travellerType === option
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => updateDraft({ travellerType: option })}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 ${
                    active
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'
                  }`}
                  aria-pressed={active}
                >
                  <span className="text-2xl" aria-hidden="true">{travellerIcons[option]}</span>
                  <span className="text-xs font-medium leading-tight">{option}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="form-section">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">旅行任务</h3>
              <p className="text-xs text-slate-500">可多选，AI 会用它决定 POI 类型和时间分配。</p>
            </div>
            <Tag tone="gray">{draft.travelType.length} 项已选</Tag>
          </div>
          <ChipSelect options={travelTypes} value={draft.travelType} onToggle={toggleType} />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="form-section">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">行程风格</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {styles.map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => updateDraft({ style })}
                  className={`min-h-11 rounded-lg border px-4 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 ${
                    draft.style === style
                      ? 'border-brand-500 bg-brand-50 font-medium text-brand-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'
                  }`}
                  aria-label={`选择行程风格${style}`}
                  aria-pressed={draft.style === style}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          <div className="form-section">
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <Field label="起点" icon={Navigation}>
                <input
                  type="text"
                  name="start-point"
                  autoComplete="street-address"
                  value={draft.startPoint}
                  onChange={(event) => updateDraft({ startPoint: event.target.value })}
                  className="w-full bg-transparent py-2.5 text-sm outline-none"
                  placeholder="起点"
                />
              </Field>
              <ArrowRight size={16} className="mb-3 text-slate-400" aria-hidden="true" />
              <Field label="结束地" icon={Flag}>
                <input
                  type="text"
                  name="end-point"
                  autoComplete="street-address"
                  value={draft.endPoint}
                  onChange={(event) => updateDraft({ endPoint: event.target.value })}
                  className="w-full bg-transparent py-2.5 text-sm outline-none"
                  placeholder="结束地"
                />
              </Field>
            </div>
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white/95 p-4 backdrop-blur">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">下一步将配置兴趣、美食、同行和节奏偏好。</p>
          <button type="button" onClick={onNext} className="btn-primary px-8 py-2.5" aria-label="进入偏好设置">
            下一步
          </button>
        </div>
      </div>
    </Card>
  )
}

function Field({ label, icon: Icon, children }: { label: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <span className="field-shell">
        <Icon size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
        {children}
      </span>
    </label>
  )
}

function normalizeTravelers(value: number | string) {
  const next = Number(value)
  return Number.isFinite(next) && next >= 1 ? Math.floor(next) : 1
}
