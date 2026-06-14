import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Cloud,
  Clock,
  Compass,
  Droplets,
  Footprints,
  Heart,
  MapPin,
  Navigation,
  Plus,
  Radio,
  ShieldAlert,
  Snowflake,
  Sparkles,
  Sun,
  Ticket,
  TrendingUp,
  Users,
  Wind,
} from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import SmartImage from '../components/ui/SmartImage'
import { Skeleton, Stars } from '../components/ui'
import { realtimeEvents, weather } from '../mock'
import { useApp } from '../store/AppContext'
import type { EventType, Poi } from '../types'
import { displayPlaceImage } from '../utils/poiImages'

const weatherIconMap: Record<string, LucideIcon> = {
  sun: Sun,
  'cloud-sun': CloudSun,
  cloud: Cloud,
  'cloud-rain': CloudRain,
  'cloud-lightning': CloudLightning,
  snow: Snowflake,
  wind: Wind,
  fog: CloudFog,
}

const eventTypeIcon: Record<EventType, LucideIcon> = {
  交通拥堵: Navigation,
  天气变化: CloudRain,
  排队提醒: Clock,
  景点拥挤: Users,
}

const eventLevelTone: Record<string, { dot: string; chip: string }> = {
  高: { dot: 'bg-risk-500', chip: 'bg-risk-50 text-risk-600' },
  中: { dot: 'bg-notice-500', chip: 'bg-notice-50 text-notice-600' },
  低: { dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-600' },
}

export default function MobileHome() {
  const { user, trips, pois, favorites } = useApp()

  const activeTrip = useMemo(
    () => trips.find((trip) => trip.status !== '已完成') ?? trips[0],
    [trips],
  )
  const nextStop = useMemo(() => {
    if (!activeTrip) return null
    const items = activeTrip.itinerary.flatMap((day) => day.items)
    return items.find((item) => item.status === '进行中') ?? items[0] ?? null
  }, [activeTrip])

  const recommendedPois = useMemo(() => pois.slice(0, 8), [pois])
  const favoritePois = useMemo(
    () => favorites.map((id) => pois.find((poi) => poi.id === id)).filter(Boolean) as Poi[],
    [favorites, pois],
  )
  const topAlert = realtimeEvents[0]

  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 6) return '夜深了'
    if (hour < 11) return '早上好'
    if (hour < 14) return '中午好'
    if (hour < 18) return '下午好'
    return '晚上好'
  })()

  const WeatherIcon = weatherIconMap[weather.icon] ?? CloudSun

  return (
    <AppLayout sidebar={false}>
      <div className="mx-auto w-full max-w-md px-4 pb-8 pt-4">
        {/* Hero: greeting + weather */}
        <section
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-600 to-locate-600 p-5 text-white shadow-card"
          aria-label="今日概览"
        >
          <div className="hero-glow -right-10 -top-12 h-40 w-40 bg-locate-300/50" aria-hidden="true" />
          <div className="hero-glow -bottom-16 left-10 h-36 w-36 bg-brand-300/40" aria-hidden="true" />

          <div className="relative flex items-start justify-between gap-3">
            <Link to="/mobile/profile" className="flex min-w-0 items-center gap-3" aria-label="查看个人中心">
              {user ? (
                <SmartImage src={user.avatar} alt={user.name} fallbackText={user.name?.slice(0, 1) ?? 'U'} className="h-12 w-12 shrink-0 rounded-full border-2 border-white/70 object-cover" />
              ) : (
                <Skeleton className="h-12 w-12 shrink-0" rounded="rounded-full" />
              )}
              <div className="min-w-0">
                <p className="text-sm text-white/80">{greeting}，</p>
                <h1 className="mt-0.5 truncate text-xl font-bold">{user?.name || '旅行者'}</h1>
                <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-white/75">
                  {activeTrip
                    ? `${activeTrip.title} · ${activeTrip.startDate} 启程`
                    : '还没有行程，去创建第一个智能路线吧'}
                </p>
              </div>
            </Link>
            <div className="shrink-0 text-right">
              <WeatherIcon size={32} strokeWidth={1.8} className="ml-auto text-white/90" aria-hidden="true" />
              <p className="mt-1 text-2xl font-bold leading-none">{weather.temp}°</p>
            </div>
          </div>

          <div className="relative mt-3 flex items-center gap-4 border-t border-white/20 pt-2.5 text-xs text-white/85">
            <span className="inline-flex items-center gap-1">
              <MapPin size={13} aria-hidden="true" /> {weather.city}
            </span>
            <span className="inline-flex items-center gap-1">
              <Droplets size={13} aria-hidden="true" /> {weather.humidity}%
            </span>
            <span className="inline-flex items-center gap-1">
              <Wind size={13} aria-hidden="true" /> {weather.airQuality}
            </span>
          </div>
        </section>

        {/* Quick actions */}
        <section className="mt-5" aria-label="快捷入口">
          <div className="grid grid-cols-4 gap-3">
            <QuickAction icon={Sparkles} label="新建行程" to="/new-trip" gradient="from-brand-500 to-brand-600" />
            <QuickAction icon={Compass} label="地图探索" to="/mobile/explore" gradient="from-emerald-500 to-locate-500" />
            <QuickAction icon={Radio} label="实时动态" to="/mobile/realtime" gradient="from-amber-500 to-notice-500" />
            <QuickAction icon={Ticket} label="我的行程" to="/mobile/trips" gradient="from-locate-500 to-locate-600" />
          </div>
        </section>

        {/* Active trip */}
        <section className="mt-6">
          <SectionHeader title="进行中的行程" to="/mobile/trips" />
          {activeTrip ? (
            <Link
              to={`/trip/${activeTrip.id}`}
              className="m-card-press mt-3 block"
              aria-label={`查看行程：${activeTrip.title}`}
            >
              <div className="relative h-32 w-full">
                <SmartImage
                  src={displayPlaceImage(activeTrip.cover)}
                  alt={activeTrip.title}
                  fallbackText={activeTrip.title}
                  eager
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <span className="chip bg-brand-600/90 text-white">{activeTrip.status}</span>
                    <p className="mt-1.5 truncate text-base font-bold text-white">{activeTrip.title}</p>
                    <p className="text-xs text-white/80">
                      {activeTrip.startDate} ~ {activeTrip.endDate} · {activeTrip.days} 天
                    </p>
                  </div>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/90 text-brand-600">
                    <ArrowRight size={16} aria-hidden="true" />
                  </span>
                </div>
              </div>
              {nextStop && (
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <Footprints size={16} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-slate-400">下一站</p>
                    <p className="truncate text-sm font-semibold text-slate-800">{nextStop.name}</p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-500">
                    {nextStop.time} · {nextStop.transport}
                  </span>
                </div>
              )}
            </Link>
          ) : (
            <Link
              to="/new-trip"
              className="touch-press mt-3 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-8 text-center"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <Plus size={22} aria-hidden="true" />
              </span>
              <p className="text-sm font-semibold text-slate-700">创建第一个智能行程</p>
              <p className="text-xs text-slate-500">填写目的地与偏好，AI 一键生成路线</p>
            </Link>
          )}
        </section>

        {/* Top alert */}
        {topAlert && (
          <section className="mt-6">
            <Link
              to="/mobile/realtime"
              className="touch-press flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3"
              aria-label={`查看提醒：${topAlert.title}`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                <ShieldAlert size={16} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`chip ${eventLevelTone[topAlert.level].chip}`}>{topAlert.type}</span>
                  <span className="text-[11px] text-amber-700/70">{topAlert.time}</span>
                </div>
                <p className="mt-1.5 truncate text-sm font-semibold text-slate-800">{topAlert.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500">{topAlert.description}</p>
              </div>
            </Link>
          </section>
        )}

        {/* Recommended POIs */}
        {recommendedPois.length > 0 && (
          <section className="mt-6">
            <SectionHeader title="为你推荐" to="/mobile/explore" />
            <div className="no-scrollbar -mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
              {recommendedPois.map((poi) => (
                <Link
                  key={poi.id}
                  to={`/poi/${poi.id}`}
                  className="touch-press w-36 shrink-0 snap-start overflow-hidden rounded-2xl border border-slate-200/80 bg-white"
                  aria-label={`查看景点：${poi.name}`}
                >
                  <SmartImage
                    src={displayPlaceImage(poi.cover, poi.imageConfidence)}
                    alt={poi.name}
                    fallbackText={poi.name}
                    className="h-24 w-full"
                  />
                  <div className="p-2.5">
                    <p className="truncate text-sm font-semibold text-slate-800">{poi.name}</p>
                    <div className="mt-1 flex items-center gap-1">
                      <Stars rating={poi.rating} size={10} />
                      <span className="text-[11px] font-semibold text-amber-500">{poi.rating.toFixed(1)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-400">
                      <MapPin size={11} aria-hidden="true" />
                      <span className="truncate">{poi.address.slice(0, 8)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Realtime feed */}
        <section className="mt-6">
          <SectionHeader title="实时动态" to="/mobile/realtime" />
          <div className="mt-3 space-y-2">
            {realtimeEvents.slice(0, 3).map((evt) => {
              const EventIcon = eventTypeIcon[evt.type] ?? Radio
              const tone = eventLevelTone[evt.level]
              return (
                <Link
                  key={evt.id}
                  to="/mobile/realtime"
                  className="touch-press flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3"
                  aria-label={`查看：${evt.title}`}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} aria-hidden="true" />
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
                    <EventIcon size={15} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{evt.title}</p>
                    <p className="truncate text-[11px] text-slate-400">
                      {evt.affectedPoi} · {evt.time}
                    </p>
                  </div>
                  <span className={`chip shrink-0 ${tone.chip}`}>{evt.level}</span>
                </Link>
              )
            })}
          </div>
        </section>

        {/* Favorites */}
        <section className="mt-6">
          <SectionHeader title="我的收藏" to="/mobile/explore" />
          {favoritePois.length > 0 ? (
            <div className="no-scrollbar -mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
              {favoritePois.map((poi) => (
                <Link
                  key={poi.id}
                  to={`/poi/${poi.id}`}
                  className="touch-press flex w-44 shrink-0 snap-start items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3"
                  aria-label={`查看收藏：${poi.name}`}
                >
                  <SmartImage
                    src={displayPlaceImage(poi.cover, poi.imageConfidence)}
                    alt={poi.name}
                    fallbackText={poi.name}
                    className="h-14 w-14 shrink-0 rounded-xl"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{poi.name}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{poi.category}</p>
                    <span className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-semibold text-amber-500">
                      <TrendingUp size={11} aria-hidden="true" /> {poi.rating.toFixed(1)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-risk-50 text-risk-500">
                <Heart size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-700">还没有收藏</p>
                <p className="text-xs text-slate-500">在探索页收藏感兴趣的景点，这里会快速直达。</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  )
}

function QuickAction({
  icon: Icon,
  label,
  to,
  gradient,
}: {
  icon: LucideIcon
  label: string
  to: string
  gradient: string
}) {
  return (
    <Link
      to={to}
      className="touch-press flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white px-1 py-3.5 shadow-sm"
      aria-label={label}
    >
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm ${gradient}`}>
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="text-xs font-medium text-slate-600">{label}</span>
    </Link>
  )
}

function SectionHeader({ title, to }: { title: string; to: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
        <span className="h-4 w-1 rounded-full bg-gradient-to-b from-brand-500 to-locate-500" aria-hidden="true" />
        {title}
      </h2>
      <Link
        to={to}
        className="inline-flex items-center gap-0.5 text-xs font-medium text-brand-600"
        aria-label={`查看更多${title}`}
      >
        更多 <ArrowRight size={13} aria-hidden="true" />
      </Link>
    </div>
  )
}
