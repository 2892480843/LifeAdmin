import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { Bell, CalendarDays, ChevronRight, CreditCard, Gauge, Heart, MapPin, Settings, Shield, Sparkles, Star, Users } from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import SmartImage from '../components/ui/SmartImage'
import { Skeleton } from '../components/ui'
import { useApp } from '../store/AppContext'
import { getCity } from '../mock'
import { derivePreferenceProfile } from '../utils/profileInsights'
import type { Poi } from '../types'

type DerivedProfile = ReturnType<typeof derivePreferenceProfile>
type QuickLink = { icon: LucideIcon; label: string; section: string }

const quickLinks: QuickLink[] = [
  { icon: Users, label: '个人资料', section: 'profile' },
  { icon: Shield, label: '账户安全', section: 'security' },
  { icon: Bell, label: '通知设置', section: 'notification' },
  { icon: CreditCard, label: '会员中心', section: 'ai' },
  { icon: Settings, label: '系统设置', section: 'language' },
]
export default function MobileProfile() {
  const navigate = useNavigate()
  const { user, favorites, trips, pois, draft } = useApp()

  const favPois = useMemo(() => pois.filter((x) => favorites.includes(x.id)), [favorites, pois])
  const p = useMemo(() => derivePreferenceProfile({ user, trips, favoritePois: favPois, draft }), [user, trips, favPois, draft])
  const recentTripPois = useMemo(() => getRecentTripPois(trips, pois), [trips, pois])
  const completedTrips = trips.filter((trip) => trip.status === '已完成').length
  const totalSpend = trips.reduce((sum, trip) => sum + trip.budget, 0)

  return (
    <AppLayout sidebar={false}>
      <div className="mx-auto w-full max-w-md px-4 pb-8 pt-4">
        {/* 个人信息头部 */}
        <ProfileHeader user={user} profile={p} />

        {/* 数据指标 */}
        <section className="-mt-4 grid grid-cols-4 gap-2">
          <Metric icon={CalendarDays} value={trips.length} label="行程" />
          <Metric icon={Gauge} value={completedTrips} label="已完成" />
          <Metric icon={Heart} value={favorites.length} label="收藏" />
          <Metric icon={CreditCard} value={`¥${(totalSpend / 1000).toFixed(0)}k`} label="预算" />
        </section>

        {/* 偏好画像 */}
        <section className="mt-6">
          <SectionHeader title="偏好画像" to="/mobile/explore" />
          <div className="mt-3 rounded-card border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap gap-2">
              {p.tags.slice(0, 6).map((tag, i) => (
                <span key={tag} className={`chip rounded-full px-2.5 py-1 text-xs ${i < 2 ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{tag}</span>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">{p.insight}</p>
          </div>
        </section>

        {/* 兴趣偏好 */}
        <section className="mt-5">
          <SectionHeader title="兴趣偏好" to="/mobile/explore" />
          <div className="mt-3 space-y-3 rounded-card border border-slate-200 bg-white p-4">
            {p.interests.slice(0, 5).map((item) => (
              <MiniBar key={item.label} label={item.label} value={item.weight} />
            ))}
          </div>
        </section>

        {/* 我的行程 */}
        <section className="mt-5">
          <SectionHeader title="我的行程" to="/mobile/trips" />
          <div className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
            {trips.length === 0 ? (
              <EmptyInline to="/new-trip" icon={Sparkles} label="还没有行程，去创建第一个" />
            ) : (
              trips.slice(0, 5).map((trip) => (
                <Link key={trip.id} to={`/trip/${trip.id}`} className="card-interactive w-40 shrink-0 snap-start overflow-hidden rounded-card border border-slate-200 bg-white" aria-label={`查看行程：${trip.title}`}>
                  <div className="relative h-20">
                    <SmartImage src={trip.cover} alt={trip.title} fallbackText={trip.title} className="absolute inset-0 h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 to-transparent" />
                    <span className="chip absolute right-1.5 top-1.5 bg-white/90 text-[10px] text-slate-700">{trip.status}</span>
                    <p className="absolute bottom-1.5 left-2 right-2 truncate text-sm font-semibold text-white">{trip.title}</p>
                  </div>
                  <div className="flex items-center gap-1 px-2.5 py-2 text-[11px] text-slate-500">
                    <MapPin size={11} aria-hidden="true" />
                    <span className="truncate">{getCity(trip.cityId)?.name ?? '未知'} · {trip.days}天</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        {/* 我的收藏 */}
        <section className="mt-5">
          <SectionHeader title="我的收藏" to="/mobile/explore" />
          {favPois.length === 0 ? (
            <div className="mt-3 flex items-center gap-3 rounded-card border border-dashed border-slate-300 bg-slate-50/60 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-risk-50 text-risk-500">
                <Heart size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-700">还没有收藏</p>
                <p className="text-xs text-slate-500">去探索页发现心仪景点吧</p>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {favPois.slice(0, 4).map((poi) => (
                <Link key={poi.id} to={`/poi/${poi.id}`} className="card-interactive flex items-center gap-3 rounded-card border border-slate-200 bg-white p-2.5" aria-label={`查看收藏：${poi.name}`}>
                  <SmartImage src={poi.cover} alt={poi.name} fallbackText={poi.name} className="h-12 w-12 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{poi.name}</p>
                    <p className="text-[11px] text-slate-400">{poi.category}</p>
                  </div>
                  <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-amber-500">
                    <Star size={11} className="fill-amber-400" aria-hidden="true" /> {poi.rating.toFixed(1)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* 账户与设置 */}
        <section className="mt-5">
          <SectionHeader title="账户与设置" to="/settings" />
          <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-card border border-slate-200 bg-white">
            {quickLinks.map((item) => (
              <button key={item.label} onClick={() => navigate(`/settings?section=${item.section}`)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition active:bg-slate-50" aria-label={`打开${item.label}`}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <item.icon size={17} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium text-slate-700">{item.label}</span>
                <ChevronRight size={16} className="shrink-0 text-slate-300" aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>

        {/* 最近足迹 */}
        {recentTripPois.length > 0 && (
          <section className="mt-5">
            <SectionHeader title="最近足迹" to="/mobile/trips" />
            <div className="mt-3 grid grid-cols-4 gap-2">
              {recentTripPois.slice(0, 8).map((poi) => (
                <Link key={poi.id} to={`/poi/${poi.id}`} className="block overflow-hidden rounded-card border border-slate-200 bg-white" aria-label={`查看地点：${poi.name}`}>
                  <SmartImage src={poi.cover} alt={poi.name} fallbackText={poi.name} className="aspect-square w-full" />
                  <p className="truncate px-1.5 py-1 text-[11px] font-medium text-slate-600">{poi.name}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  )
}
function ProfileHeader({ user, profile }: { user: ReturnType<typeof useApp>['user']; profile: DerivedProfile }) {
  return (
    <section className="relative overflow-hidden rounded-card bg-gradient-to-br from-brand-700 via-brand-600 to-locate-600 p-5 text-white shadow-card">
      <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
      <div className="relative flex items-center gap-4">
        {user ? (
          <SmartImage src={user.avatar} alt={user.name} fallbackText={user.name?.slice(0, 1) ?? 'U'} eager className="h-[68px] w-[68px] shrink-0 rounded-full border-2 border-white/80 object-cover" />
        ) : (
          <Skeleton className="h-[68px] w-[68px] shrink-0" rounded="rounded-full" />
        )}
        <div className="min-w-0 flex-1">
          {user ? (
            <h1 className="truncate text-xl font-bold">{user.name}</h1>
          ) : (
            <Skeleton className="h-6 w-28" />
          )}
          <div className="mt-1 flex items-center gap-2">
            <span className="chip bg-white/20 text-[11px] text-white">{user?.level ?? '普通用户'}</span>
            <span className="inline-flex items-center gap-0.5 text-[11px] text-white/75">
              <Sparkles size={11} aria-hidden="true" /> {profile.pace}
            </span>
          </div>
          <p className="mt-1.5 line-clamp-1 text-[11px] text-white/70">{user?.bio || '热爱旅行，探索世界每个角落'}</p>
        </div>
      </div>
      <div className="relative mt-4 h-1 overflow-hidden rounded-full bg-white/20" aria-hidden="true">
        <div className="h-full rounded-full bg-white/60" style={{ width: '72%' }} />
      </div>
    </section>
  )
}

function Metric({ icon: Icon, value, label }: { icon: LucideIcon; value: number | string; label: string }) {
  return (
    <div className="rounded-card border border-slate-200 bg-white px-1 py-3 text-center shadow-sm">
      <Icon size={15} className="mx-auto text-brand-600" aria-hidden="true" />
      <p className="mt-1 text-base font-bold leading-none text-slate-900">{value}</p>
      <p className="mt-1 text-[11px] text-slate-400">{label}</p>
    </div>
  )
}

function SectionHeader({ title, to }: { title: string; to: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      <Link to={to} className="inline-flex items-center gap-0.5 text-xs font-medium text-brand-600" aria-label={`查看更多${title}`}>
        更多 <ChevronRight size={13} aria-hidden="true" />
      </Link>
    </div>
  )
}

function MiniBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="text-slate-400">{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-locate-500" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function EmptyInline({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  return (
    <Link to={to} className="flex w-full items-center gap-3 rounded-card border border-dashed border-slate-300 bg-slate-50/60 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0 text-sm text-slate-600">{label}</span>
    </Link>
  )
}

function getRecentTripPois(trips: ReturnType<typeof useApp>['trips'], pois: Poi[]) {
  const poiById = new Map(pois.map((poi) => [poi.id, poi]))
  const orderedIds = trips.flatMap((trip) => trip.itinerary.flatMap((day) => day.items.map((item) => item.poiId).filter(Boolean))) as string[]
  return Array.from(new Set(orderedIds)).map((poiId) => poiById.get(poiId)).filter((poi): poi is Poi => Boolean(poi)).slice(0, 8)
}
