import { useMemo, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bell,
  CalendarDays,
  ChevronRight,
  Compass,
  CreditCard,
  Edit3,
  Eye,
  Gauge,
  Heart,
  MapPin,
  Settings,
  Shield,
  Sparkles,
 Star,
 UtensilsCrossed,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import { Card, Tag, SectionTitle } from '../components/ui'
import { RoutePageHeader, StatusPill, SystemPanel } from '../components/ui/RouteSystem'
import SmartImage from '../components/ui/SmartImage'
import { useApp } from '../store/AppContext'
import { getCity } from '../mock'
import { derivePreferenceProfile } from '../utils/profileInsights'
import type { Poi, Trip, User } from '../types'

type DerivedProfile = ReturnType<typeof derivePreferenceProfile>
type QuickLink = { icon: LucideIcon; label: string; section: string }
type MetricTone = 'brand' | 'emerald' | 'amber' | 'rose'

const interestImagePoiNames: Record<string, string[]> = {
  '历史文化': ['故宫博物院', '秦始皇兵马俑博物馆', '豫园'],
  '城市观光': ['外滩', '陆家嘴', '西安城墙'],
  '美食探索': ['锦里古街', '王府井步行街'],
  '艺术展览': ['田子坊', '南锣鼓巷', '大慈寺'],
  '自然风光': ['颐和园', '亚龙湾', '西溪国家湿地公园'],
  '购物休闲': ['南京路步行街', '王府井步行街'],
}

const metricToneMap: Record<MetricTone, string> = {
  brand: 'border-brand-100 bg-brand-50 text-brand-700',
  emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-100 bg-amber-50 text-amber-700',
  rose: 'border-rose-100 bg-rose-50 text-rose-700',
}

// 指标卡图标配色背景（与 tone 配套，提升视觉层级）
const metricIconBgMap: Record<MetricTone, string> = {
  brand: 'from-brand-500/12 to-brand-500/4 text-brand-600',
  emerald: 'from-emerald-500/12 to-emerald-500/4 text-emerald-600',
  amber: 'from-amber-500/12 to-amber-500/4 text-amber-600',
  rose: 'from-rose-500/12 to-rose-500/4 text-rose-500',
}

function getInterestImageSrc(label: string, pois: Poi[]) {
  const names = interestImagePoiNames[label] ?? []

  for (const name of names) {
    const cover = pois.find((poi) => poi.name === name)?.cover
    if (cover) return cover
  }

  return ''
}

export default function Profile() {
  const navigate = useNavigate()
  const { user, favorites, trips, pois, draft } = useApp()

  const favPois = useMemo(() => pois.filter((x) => favorites.includes(x.id)), [favorites, pois])
  const p = useMemo(() => derivePreferenceProfile({ user, trips, favoritePois: favPois, draft }), [user, trips, favPois, draft])
  const recentTripPois = useMemo(() => getRecentTripPois(trips, pois), [trips, pois])
  const completedTrips = trips.filter((trip) => trip.status === '已完成').length
  const totalSpend = trips.reduce((sum, trip) => sum + trip.budget, 0)

  const quickLinks: QuickLink[] = [
    { icon: Users, label: '个人资料', section: 'profile' },
    { icon: Shield, label: '账户安全', section: 'security' },
    { icon: Bell, label: '通知设置', section: 'notification' },
    { icon: CreditCard, label: '会员中心', section: 'ai' },
    { icon: Settings, label: '系统设置', section: 'language' },
  ]

  return (
    <AppLayout>
      <div className="page-shell max-w-[1280px] space-y-6">
        <RoutePageHeader
          eyebrow="偏好画像"
          title="个人中心"
          description="聚合账户状态、旅行画像和近期路线资产，便于快速继续规划。"
          meta={
            <>
              <StatusPill tone="brand">{p.pace}</StatusPill>
              <StatusPill tone="amber">{p.budgetLevel}</StatusPill>
              <StatusPill tone="emerald">{p.partner}</StatusPill>
            </>
          }
        />

        <ProfileHeroCard
          user={user}
          profile={p}
          trips={trips}
          favorites={favorites.length}
          completedTrips={completedTrips}
          totalSpend={totalSpend}
          onEdit={() => navigate('/settings?section=profile')}
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-6">
            <PreferenceInsightPanel profile={p} pois={pois} />
            <RecentRouteAssets
              trips={trips}
              recentTripPois={recentTripPois}
              onOpenTrip={(tripId) => navigate(`/trip/${tripId}`)}
              onOpenPoi={(poiId) => navigate(`/poi/${poiId}`)}
            />
          </div>

          <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
            <TravelPersonaCard profile={p} />
            <FavoritePlaces favPois={favPois} onOpenPoi={(poiId) => navigate(`/poi/${poiId}`)} />
            <AccountQuickDock links={quickLinks} onNavigate={(section) => navigate(`/settings?section=${section}`)} />
          </aside>
        </div>
      </div>
    </AppLayout>
  )
}

function ProfileHeroCard({
  user,
  profile,
  trips,
  favorites,
  completedTrips,
  totalSpend,
  onEdit,
}: {
  user: User | null
  profile: DerivedProfile
  trips: Trip[]
  favorites: number
  completedTrips: number
  totalSpend: number
  onEdit: () => void
}) {
  const topInterest = profile.interests[0]?.label ?? '城市探索'

  return (
    <section className="relative overflow-hidden rounded-card border border-slate-200 bg-white shadow-card">
      <div className="relative h-36 overflow-hidden bg-gradient-to-r from-brand-700 via-brand-600 to-locate-600 sm:h-32">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.14)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-6 left-1/3 h-24 w-64 rounded-full bg-locate-300/20 blur-2xl" aria-hidden="true" />
        <div className="absolute left-5 right-5 top-5 flex items-start justify-between gap-5 text-white sm:left-44 lg:left-52">
          <div className="min-w-0 max-w-2xl">
            <p className="text-xs font-semibold uppercase text-white/70">旅行者指挥中心</p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/85">偏好同步中，下一段路线将围绕「{topInterest}」展开。</p>
          </div>
          <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur sm:inline-flex lg:px-4 lg:py-2 lg:text-sm">
            <Sparkles size={13} aria-hidden="true" />
            AI 画像就绪
          </span>
        </div>
      </div>

      <div className="grid gap-5 px-5 pb-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:px-6 lg:pb-6">
        <div className="min-w-0">
          <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <SmartImage
                src={user?.avatar ?? ''}
                alt={user?.name ?? '用户头像'}
                fallbackText={user?.name?.slice(0, 1) ?? 'U'}
                eager
                className="h-24 w-24 shrink-0 rounded-full border-4 border-white object-cover shadow-panel"
              />
              <div className="min-w-0 pt-14">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-2xl font-semibold text-slate-950">{user?.name ?? '旅行者'}</h2>
                  <Tag tone="blue">{user?.level ?? '普通用户'}</Tag>
                </div>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{user?.bio || '热爱旅行，探索世界每个角落'}</p>
              </div>
            </div>
            <button onClick={onEdit} className="btn-primary w-full px-4 py-2 text-sm sm:mt-14 sm:w-auto" aria-label="编辑个人资料">
              <Edit3 size={14} aria-hidden="true" /> 编辑资料
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <HeroMetric icon={CalendarDays} value={trips.length} label="全部行程" detail={`${profile.stats.totalDays} 天路线`} tone="brand" />
            <HeroMetric icon={Gauge} value={completedTrips} label="已完成" detail={`${profile.stats.totalCities} 个城市`} tone="emerald" />
            <HeroMetric icon={Heart} value={favorites} label="收藏地点" detail={`${profile.stats.totalPois} 个足迹`} tone="rose" />
            <HeroMetric icon={CreditCard} value={`¥${totalSpend}`} label="累计预算" detail={profile.budgetLevel} tone="amber" />
          </div>
        </div>

        <div className="self-end rounded-card border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">路线画像</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{profile.pace}</p>
            </div>
            <span className="status-dot-live" />
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <PrefRow label="出行方式" value={profile.partner} />
            <PrefRow label="预算档位" value={profile.budgetLevel} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {profile.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="chip bg-white text-slate-600 ring-1 ring-slate-200">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function PreferenceInsightPanel({ profile, pois }: { profile: DerivedProfile; pois: Poi[] }) {
  return (
    <SystemPanel accent="emerald" showAccentRail={false} className="p-5 lg:p-6">
      <SectionTitle
        title={<span className="flex items-center gap-2"><Sparkles size={17} className="text-locate-600" aria-hidden="true" /> AI 偏好洞察</span>}
        extra={<span className="text-xs text-slate-400">基于行程、收藏与偏好生成</span>}
        className="mb-4"
      />

      <div className="grid gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <div className="rounded-card border border-slate-200/80 bg-white/90 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-800">偏好雷达</h4>
            <span className="rounded-full bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-700">前 6 项</span>
          </div>
          <PreferenceRadar items={profile.interests.slice(0, 6)} />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="rounded-card border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-locate-50/60 p-4">
            <div className="flex flex-wrap gap-2">
              {profile.tags.map((tag, index) => (
                <span
                  key={tag}
                  className={`chip rounded-full px-3 py-1.5 text-sm ${
                    index < 3 ? 'bg-brand-600 text-white shadow-sm shadow-brand-500/20' : 'bg-white text-slate-600 ring-1 ring-slate-200'
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
            <p className="mt-4 text-sm leading-6 text-brand-900">{profile.insight}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {profile.interests.map((item) => {
              const interestImageSrc = getInterestImageSrc(item.label, pois)

              return (
                <div key={item.label} className="group overflow-hidden rounded-card border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-hover">
                  <div className="relative h-24">
                    <SmartImage src={interestImageSrc} alt={`${item.label}主题图片`} fallbackText={item.label} className="h-full w-full" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/55 via-slate-950/10 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
                      <span className="truncate text-sm font-semibold text-white">{item.label}</span>
                      <span className="shrink-0 rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-slate-700">{item.weight}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-100">
                    <div className="h-full rounded-r-full bg-gradient-to-r from-brand-600 to-locate-500" style={{ width: `${item.weight}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <PreferenceBlock icon={Gauge} title="出行偏好" tone="brand">
          <PrefRow label="旅行节奏" value={profile.pace} />
          <PrefRow label="出行伙伴" value={profile.partner} />
          <PrefRow label="预算水平" value={profile.budgetLevel} />
        </PreferenceBlock>
        <PreferenceBlock icon={CalendarDays} title="时间分配" tone="emerald">
          {profile.rhythm.map((item) => (
            <Bar key={item.label} label={item.label} value={item.value} tone="bg-locate-500" />
          ))}
        </PreferenceBlock>
        <PreferenceBlock icon={Compass} title="兴趣偏好" tone="brand">
          {profile.interests.slice(0, 4).map((item) => (
            <Bar key={item.label} label={item.label} value={item.weight} />
          ))}
        </PreferenceBlock>
        <PreferenceBlock icon={UtensilsCrossed} title="美食偏好" tone="amber">
          {profile.cuisines.map((item) => (
            <Bar key={item.label} label={item.label} value={item.weight} tone="bg-amber-500" />
          ))}
        </PreferenceBlock>
      </div>
    </SystemPanel>
  )
}

function RecentRouteAssets({
  trips,
  recentTripPois,
  onOpenTrip,
  onOpenPoi,
}: {
  trips: Trip[]
  recentTripPois: Poi[]
  onOpenTrip: (tripId: string) => void
  onOpenPoi: (poiId: string) => void
}) {
  return (
    <Card className="p-5 lg:p-6">
      <SectionTitle
        title={<span className="flex items-center gap-2"><MapPin size={17} className="text-brand-600" aria-hidden="true" /> 近期路线资产</span>}
        extra={<Link to="/trips" className="hidden text-sm font-medium text-brand-600 hover:text-brand-700 sm:inline-flex">查看全部</Link>}
        className="mb-4"
      />

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.1fr)_minmax(16rem,.9fr)]">
        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">最近行程</p>
            <Link to="/trips" className="text-xs font-medium text-brand-600 hover:text-brand-700">
              全部行程
            </Link>
          </div>
          {trips.length === 0 ? (
            <EmptyLink icon={CalendarDays} label="暂无行程，创建第一段智能路线" to="/new-trip" action="新建行程" />
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              {trips.slice(0, 3).map((trip) => (
                <button
                  key={trip.id}
                  onClick={() => onOpenTrip(trip.id)}
                  className="group overflow-hidden rounded-card border border-slate-200 bg-white text-left transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-hover"
                  aria-label={`查看行程 ${trip.title}`}
                >
                  <div className="relative h-28">
                    <SmartImage src={trip.cover} alt={trip.title} fallbackText={trip.title} className="h-full w-full" />
                    <Tag tone="blue" className="absolute right-2 top-2 bg-white/95">{trip.status}</Tag>
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-slate-800 group-hover:text-brand-700">{trip.title}</p>
                    <p className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                      <MapPin size={12} aria-hidden="true" />
                      {getCity(trip.cityId)?.name ?? '未知城市'} · {trip.days} 天
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0 rounded-card border border-slate-200 bg-slate-50/70 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">近期地点轨迹</p>
            <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">{recentTripPois.length} 个</span>
          </div>
          <div className="space-y-2">
            {recentTripPois.length === 0 && (
              <EmptyLink icon={Eye} label="生成行程后会自动汇总地点轨迹" to="/new-trip" action="去规划" compact />
            )}
            {recentTripPois.map((poi) => (
              <PlaceRow
                key={poi.id}
                poi={poi}
                meta={<Tag tone="gray">{poi.category}</Tag>}
                onClick={() => onOpenPoi(poi.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

function TravelPersonaCard({ profile }: { profile: DerivedProfile }) {
  return (
    <section className="relative overflow-hidden rounded-card border border-slate-800 bg-command-950 p-4 text-white shadow-command">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(96,165,250,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(45,212,191,.1)_1px,transparent_1px)] bg-[size:28px_28px] opacity-70" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase text-white/55">旅行基因</p>
          <span className="status-dot-live" />
        </div>
        <h3 className="mt-3 text-lg font-semibold">{profile.interests.slice(0, 2).map((item) => item.label).join(' + ')}</h3>
        <p className="mt-2 text-sm leading-6 text-white/65">{profile.pace} · {profile.partner} · {profile.budgetLevel}</p>
        <div className="mt-4 space-y-2">
          {profile.interests.slice(0, 3).map((item) => (
            <Bar key={item.label} label={item.label} value={item.weight} tone="bg-locate-400" dark />
          ))}
        </div>
      </div>
    </section>
  )
}

function FavoritePlaces({ favPois, onOpenPoi }: { favPois: Poi[]; onOpenPoi: (poiId: string) => void }) {
  return (
    <Card className="p-4">
      <SectionTitle
        title={<span className="flex items-center gap-2"><Heart size={16} className="text-rose-500" aria-hidden="true" /> 我的收藏</span>}
        extra={<span className="text-xs text-slate-400">{favPois.length} 个</span>}
        className="mb-3"
      />
      <div className="space-y-2">
        {favPois.length === 0 && (
          <EmptyLink icon={Heart} label="还没有收藏，去探索页发现心仪地点吧" to="/explore" action="前往探索" compact />
        )}
        {favPois.slice(0, 4).map((poi) => (
          <PlaceRow
            key={poi.id}
            poi={poi}
            meta={<span className="flex items-center gap-1 text-xs text-amber-500"><Star size={11} className="fill-amber-400" aria-hidden="true" /> {poi.rating}</span>}
            onClick={() => onOpenPoi(poi.id)}
          />
        ))}
      </div>
      {favPois.length > 4 && (
        <Link to="/explore?filter=favorites" className="mt-3 inline-flex text-sm font-medium text-brand-600 hover:text-brand-700">
          查看全部收藏
        </Link>
      )}
    </Card>
  )
}

function AccountQuickDock({ links, onNavigate }: { links: QuickLink[]; onNavigate: (section: string) => void }) {
  return (
    <Card className="p-4">
      <SectionTitle title="账户快捷入口" className="mb-3" />
      <div className="grid grid-cols-2 gap-2">
        {links.map((item) => (
          <button
            key={item.label}
            onClick={() => onNavigate(item.section)}
            className="flex min-h-20 flex-col items-start justify-between rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-brand-200 hover:bg-brand-50/50 hover:shadow-card"
            aria-label={`打开${item.label}`}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <item.icon size={17} aria-hidden="true" />
            </span>
            <span className="text-xs font-semibold text-slate-600">{item.label}</span>
          </button>
        ))}
      </div>
    </Card>
  )
}

function getRecentTripPois(trips: Trip[], pois: Poi[]) {
  const poiById = new Map(pois.map((poi) => [poi.id, poi]))
  const orderedIds = trips.flatMap((trip) =>
    trip.itinerary.flatMap((day) => day.items.map((item) => item.poiId).filter(Boolean)),
  ) as string[]

  return Array.from(new Set(orderedIds))
    .map((poiId) => poiById.get(poiId))
    .filter((poi): poi is Poi => Boolean(poi))
    .slice(0, 4)
}

function PreferenceBlock({
  icon: Icon,
  title,
  tone,
  children,
}: {
  icon: LucideIcon
  title: string
  tone: MetricTone
  children: ReactNode
}) {
  return (
    <div className="rounded-card border border-slate-200/80 bg-white/85 p-4">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg border ${metricToneMap[tone]}`}>
          <Icon size={15} aria-hidden="true" />
        </span>
        {title}
      </h4>
      <div className="space-y-2.5 text-sm">{children}</div>
    </div>
  )
}

function HeroMetric({
  icon: Icon,
  value,
  label,
  detail,
  tone,
}: {
  icon: LucideIcon
  value: number | string
  label: string
  detail: string
  tone: MetricTone
}) {
  return (
    <div className="group relative overflow-hidden rounded-card border border-slate-200 bg-white p-3 shadow-sm shadow-slate-100/80 transition duration-soft hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-hover">
      <span className={`pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-gradient-to-br ${metricIconBgMap[tone]} opacity-0 blur-xl transition duration-soft group-hover:opacity-100`} aria-hidden="true" />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xl font-semibold leading-tight text-slate-950">{value}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">{label}</p>
        </div>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${metricIconBgMap[tone]}`}>
          <Icon size={16} aria-hidden="true" />
        </span>
      </div>
      <p className="relative mt-2 truncate text-xs text-slate-400">{detail}</p>
    </div>
  )
}

function PlaceRow({
  poi,
  meta,
  onClick,
}: {
  poi: Poi
  meta?: ReactNode
  onClick: () => void
}) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-white hover:shadow-sm" aria-label={`查看地点 ${poi.name}`}>
      <SmartImage src={poi.cover} alt={poi.name} fallbackText={poi.name} className="h-12 w-14 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-800">{poi.name}</p>
        <div className="mt-1 min-h-5">{meta}</div>
      </div>
      <ChevronRight size={16} className="shrink-0 text-slate-300" aria-hidden="true" />
    </button>
  )
}

function EmptyLink({
  icon: Icon,
  label,
  to,
  action,
  compact = false,
}: {
  icon: LucideIcon
  label: string
  to: string
  action: string
  compact?: boolean
}) {
  return (
    <div className={`flex flex-col items-center rounded-lg border border-dashed border-slate-200 bg-white/70 text-center ${compact ? 'px-4 py-6' : 'px-6 py-10'}`}>
      <Icon size={compact ? 20 : 24} className="mb-2 text-slate-300" aria-hidden="true" />
      <p className="text-sm leading-5 text-slate-400">{label}</p>
      <Link to={to} className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700">
        {action}
      </Link>
    </div>
  )
}

function PrefRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-400">{label}</span>
      <span className="min-w-0 truncate font-medium text-slate-700">{value}</span>
    </div>
  )
}

function Bar({
  label,
  value,
  tone = 'bg-brand-500',
  dark = false,
}: {
  label: string
  value: number
  tone?: string
  dark?: boolean
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between gap-2 text-xs">
        <span className={dark ? 'text-white/70' : 'text-slate-600'}>{label}</span>
        <span className={dark ? 'text-white/45' : 'text-slate-400'}>{value}%</span>
      </div>
      <div className={`h-1.5 overflow-hidden rounded-full ${dark ? 'bg-white/10' : 'bg-slate-100'}`}>
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function PreferenceRadar({ items }: { items: { label: string; weight: number }[] }) {
  const size = 260
  const center = size / 2
  const radius = 86

  if (items.length === 0) {
    return <div className="flex h-64 items-center justify-center text-sm text-slate-400">暂无偏好数据</div>
  }

  const points = items
    .map((item, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / items.length
      const r = (item.weight / 100) * radius
      return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`
    })
    .join(' ')

  return (
    <div className="relative mx-auto w-full max-w-[280px]">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-auto w-full" aria-label="偏好雷达图">
        {[0.33, 0.66, 1].map((scale) => (
          <polygon
            key={scale}
            points={items
              .map((_, index) => {
                const angle = -Math.PI / 2 + (Math.PI * 2 * index) / items.length
                return `${center + Math.cos(angle) * radius * scale},${center + Math.sin(angle) * radius * scale}`
              })
              .join(' ')}
            fill="none"
            stroke="rgba(148,163,184,.35)"
            strokeWidth="1"
          />
        ))}
        {items.map((item, index) => {
          const angle = -Math.PI / 2 + (Math.PI * 2 * index) / items.length
          const x = center + Math.cos(angle) * (radius + 24)
          const y = center + Math.sin(angle) * (radius + 24)
          return (
            <g key={item.label}>
              <line x1={center} y1={center} x2={center + Math.cos(angle) * radius} y2={center + Math.sin(angle) * radius} stroke="rgba(148,163,184,.25)" />
              <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-slate-500 text-[10px]">
                {item.label.slice(0, 4)}
              </text>
            </g>
          )
        })}
        <polygon points={points} fill="rgba(37,99,235,.18)" stroke="#2563eb" strokeWidth="2" />
      </svg>
    </div>
  )
}
