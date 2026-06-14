import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, ChevronLeft, ChevronRight, MapPin, Search, type LucideIcon } from 'lucide-react'
import type { City } from '../../types'

export interface CityOptionGroup {
  label: string
  cities: City[]
}

interface CustomCityOption {
  value: string
  label: string
}

interface ProvinceOption {
  code: string
  name: string
  cities: City[]
  poiCount: number
}

interface CitySelectProps {
  value: string
  groups: CityOptionGroup[]
  onChange: (cityId: string) => void
  ariaLabel: string
  icon?: LucideIcon
  placeholder?: string
  showPinyin?: boolean
  showPoiCount?: boolean
  customOption?: CustomCityOption
  className?: string
}

export default function CitySelect({
  value,
  groups,
  onChange,
  ariaLabel,
  icon: Icon = MapPin,
  placeholder = '选择城市',
  showPinyin = true,
  showPoiCount = false,
  customOption,
  className = '',
}: CitySelectProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeProvince, setActiveProvince] = useState('')
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})

  const allCities = useMemo(() => {
    const seen = new Set<string>()
    return groups.flatMap((group) => group.cities).filter((city) => {
      if (seen.has(city.id)) return false
      seen.add(city.id)
      return true
    })
  }, [groups])
  const provinceOptions = useMemo(() => groupCitiesByProvince(allCities), [allCities])
  const selectedCity = allCities.find((city) => city.id === value)
  const customSelected = customOption && value === customOption.value
  const selectedLabel = customSelected ? customOption.label : selectedCity?.name ?? placeholder
  const selectedMeta = selectedCity && showPinyin
    ? [selectedCity.provinceName, selectedCity.pinyin].filter(Boolean).join(' · ')
    : ''
  const normalizedQuery = normalizeSearchText(query)
  const selectedProvince = activeProvince
    ? provinceOptions.find((province) => province.name === activeProvince)
    : undefined
  const selectedCityProvince = selectedCity?.provinceName ?? ''

  const visibleProvinceCities = useMemo(() => {
    if (!selectedProvince) return []
    if (!normalizedQuery) return selectedProvince.cities
    return selectedProvince.cities.filter((city) => cityMatchesQuery(city, normalizedQuery))
  }, [normalizedQuery, selectedProvince])

  const searchCityGroups = useMemo(() => {
    if (!normalizedQuery || activeProvince) return []
    return groupCitiesByProvince(allCities.filter((city) => cityMatchesQuery(city, normalizedQuery)))
  }, [activeProvince, allCities, normalizedQuery])

  const showProvinceList = !activeProvince && !normalizedQuery
  const visibleCityGroups = activeProvince
    ? [{ label: activeProvince, cities: visibleProvinceCities }]
    : searchCityGroups.map((province) => ({ label: province.name, cities: province.cities }))

  const showCustomOption =
    customOption &&
    !activeProvince &&
    (!query.trim() || normalizeSearchText(customOption.label).includes(normalizeSearchText(query)))
  const emptyResults = showProvinceList
    ? provinceOptions.length === 0
    : visibleCityGroups.every((group) => group.cities.length === 0)

  useEffect(() => {
    if (!open) return

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) return

      const gap = 8
      const spaceBelow = window.innerHeight - rect.bottom - 12
      const spaceAbove = rect.top - 12
      const openAbove = spaceBelow < 260 && spaceAbove > spaceBelow
      const available = Math.max(180, openAbove ? spaceAbove : spaceBelow)
      const maxHeight = Math.min(640, available)
      const menuWidth = Math.max(rect.width, 300)
      const rawLeft = Math.min(rect.left, window.innerWidth - menuWidth - 12)
      const top = openAbove ? Math.max(12, rect.top - maxHeight - gap) : rect.bottom + gap

      setMenuStyle({
        left: Math.max(12, rawLeft),
        top,
        width: menuWidth,
        maxHeight,
      })
    }

    updatePosition()
    searchRef.current?.focus()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  useEffect(() => {
    if (open) return
    setQuery('')
    setActiveProvince('')
  }, [open])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const chooseCity = (cityId: string) => {
    onChange(cityId)
    setOpen(false)
    setQuery('')
    setActiveProvince('')
  }

  const chooseProvince = (provinceName: string) => {
    setActiveProvince(provinceName)
    setQuery('')
    window.requestAnimationFrame(() => searchRef.current?.focus())
  }

  const backToProvinces = () => {
    setActiveProvince('')
    setQuery('')
    window.requestAnimationFrame(() => searchRef.current?.focus())
  }

  const menu = open && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={menuRef}
          style={menuStyle}
          role="dialog"
          aria-label={ariaLabel}
          className="fixed z-[80] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-panel"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              setOpen(false)
              buttonRef.current?.focus()
            }
          }}
        >
          <div className="border-b border-slate-100 p-3.5">
            <div className="mb-3.5 flex min-h-7 items-center justify-between gap-3 px-0.5">
              {activeProvince ? (
                <button
                  type="button"
                  onClick={backToProvinces}
                  className="flex min-w-0 items-center gap-1.5 rounded-md py-1 pr-2 text-sm font-semibold text-slate-600 transition-colors hover:text-brand-700"
                  aria-label="返回省份列表"
                >
                  <ChevronLeft size={14} className="shrink-0" aria-hidden="true" />
                  <span className="truncate">选择省份</span>
                </button>
              ) : (
                <span className="truncate text-sm font-semibold text-slate-700">选择省份 / 直辖市</span>
              )}
              <span className="shrink-0 text-sm text-slate-500">
                {activeProvince
                  ? `${visibleProvinceCities.length} 个城市`
                  : normalizedQuery
                    ? `${searchCityGroups.reduce((sum, group) => sum + group.cities.length, 0)} 个结果`
                    : `${provinceOptions.length} 项`}
              </span>
            </div>
            <label className="flex min-h-12 items-center gap-2.5 rounded-xl border border-brand-100 bg-white px-3 text-base text-slate-600 shadow-sm transition-colors focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-100">
              <Search size={19} className="shrink-0 text-slate-400" aria-hidden="true" />
              <input
                ref={searchRef}
                type="search"
                name="city-search"
                autoComplete="off"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={activeProvince ? `搜索${activeProvince}城市或拼音` : '搜索省份、城市或拼音'}
                className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400"
                aria-label={activeProvince ? `搜索${activeProvince}城市` : '搜索省份或城市'}
              />
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pb-2">
            {showCustomOption && (
              <CityOptionButton
                label={customOption.label}
                meta="自定义目的地"
                active={value === customOption.value}
                onClick={() => chooseCity(customOption.value)}
              />
            )}

            {showProvinceList ? (
              provinceOptions.map((province) => (
                <ProvinceOptionButton
                  key={province.code}
                  province={province}
                  active={!customSelected && selectedCityProvince === province.name}
                  onClick={() => chooseProvince(province.name)}
                />
              ))
            ) : (
              visibleCityGroups.map((group) => (
                <section key={group.label}>
                  <div className="sticky top-0 z-10 bg-slate-50/95 px-3 py-1.5 text-[11px] font-semibold text-slate-500">
                    {group.label}
                  </div>
                  {group.cities.map((city) => (
                    <CityOptionButton
                      key={city.id}
                      label={city.name}
                      meta={getCityMeta(city, showPoiCount, !activeProvince)}
                      active={value === city.id}
                      onClick={() => chooseCity(city.id)}
                    />
                  ))}
                </section>
              ))
            )}

            {!showCustomOption && emptyResults && (
              <p className="px-4 py-8 text-center text-sm text-slate-500">未找到匹配城市</p>
            )}
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setOpen(true)
          }
        }}
        className={`field-shell min-h-11 w-full text-left transition-colors focus-within:ring-brand-200 hover:border-brand-200 ${className}`}
      >
        <Icon size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-800">{selectedLabel}</span>
          {selectedMeta && <span className="block truncate text-[11px] text-slate-500">{selectedMeta}</span>}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {menu}
    </>
  )
}

function CityOptionButton({
  label,
  meta,
  active,
  onClick,
}: {
  label: string
  meta: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex min-h-[68px] w-full min-w-0 items-center gap-3 px-5 py-3 text-left transition-colors ${
        active ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-50'
      }`}
    >
      <span className="min-w-0 flex-1">
       <span className="block truncate text-base font-semibold">{label}</span>
        <span className="mt-0.5 block truncate text-sm text-slate-500">{meta}</span>
      </span>
      {active && <Check size={15} className="shrink-0 text-brand-600" aria-hidden="true" />}
    </button>
  )
}

function ProvinceOptionButton({
  province,
  active,
  onClick,
}: {
  province: ProvinceOption
  active: boolean
  onClick: () => void
}) {
  const meta = `${province.cities.length} 个城市${
    province.poiCount > 0 ? ` · ${province.poiCount} 个地点` : ''
  }`

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex min-h-[68px] w-full min-w-0 items-center gap-3 px-5 py-3 text-left transition-colors ${
        active ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-50'
      }`}
    >
      <span className="min-w-0 flex-1">
       <span className="block truncate text-base font-semibold">{province.name}</span>
        <span className="mt-0.5 block truncate text-sm text-slate-500">{meta}</span>
      </span>
      {active ? (
        <Check size={15} className="shrink-0 text-brand-600" aria-hidden="true" />
      ) : (
        <ChevronRight size={18} className="shrink-0 text-slate-300" aria-hidden="true" />
      )}
    </button>
  )
}

function groupCitiesByProvince(cities: City[]): ProvinceOption[] {
  const provinceByKey = new Map<string, ProvinceOption>()

  for (const city of cities) {
    const code = city.provinceCode ?? city.adcode?.slice(0, 2) ?? getProvinceName(city)
    const name = getProvinceName(city)
    const province = provinceByKey.get(code) ?? {
      code,
      name,
      cities: [],
      poiCount: 0,
    }

    province.cities.push(city)
    province.poiCount += city.poiCount
    provinceByKey.set(code, province)
  }

  return [...provinceByKey.values()].sort((left, right) => left.code.localeCompare(right.code, 'zh-CN'))
}

function getCityMeta(city: City, showPoiCount: boolean, includeProvince: boolean) {
  return [
    includeProvince ? city.provinceName : '',
    city.pinyin,
    showPoiCount ? `${city.poiCount} 个地点` : '',
  ].filter(Boolean).join(' · ')
}

function cityMatchesQuery(city: City, normalizedQuery: string) {
  return normalizeSearchText(`${city.name} ${city.pinyin} ${city.provinceName ?? ''}`).includes(normalizedQuery)
}

function getProvinceName(city: City) {
  return city.provinceName ?? '其他'
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/\s+/g, '')
}
