import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Heart,
  Share2,
  Plus,
  Clock,
  Ticket,
  Hourglass,
  Users,
  MapPin,
  Sparkles,
  Star,
  ThumbsUp,
  Phone,
  Navigation,
  Route,
  ShieldAlert,
  Compass,
} from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import { Card, Modal, Tag, Stars, Toast } from '../components/ui'
import { SystemPanel } from '../components/ui/RouteSystem'
import SmartImage from '../components/ui/SmartImage'
import { useApp } from '../store/AppContext'
import { canNavigateTo, openAmapNavigation } from '../utils/amapNavigation'
import { shareOrCopy } from '../utils/browserActions'
import { displayPlaceImage, hasPendingPlaceImageReview } from '../utils/poiImages'
import { canAddPoiToTrip, getPoiJoinCandidates, isPoiInTrip } from '../utils/tripMutations'
import { mobileOrDesktopPath } from '../utils/useIsMobile'
import { fetchDianpingPoiDetail, fetchDianpingQueue } from '../services/dianpingService'
import type { DianpingPoiDetailResult, DianpingQueueResult, DianpingQueueValue } from '../services/dianpingService'

export default function PoiDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addPoiToTrip, getPoiById, getPoisByCityId, isFavorite, loadPoiById, loadPoisByCityId, toggleFavorite, trips } = useApp()
  const poi = getPoiById(id ?? '')
  const [toast, setToast] = useState('')
  const [joinOpen, setJoinOpen] = useState(false)
  const [selectedTripId, setSelectedTripId] = useState('')
  const [likedReviewIds, setLikedReviewIds] = useState<string[]>([])
  const [reviewLikes, setReviewLikes] = useState<Record<string, number>>(() => ({}))
  const [loadedPoiId, setLoadedPoiId] = useState('')
  const [dianpingDetail, setDianpingDetail] = useState<DianpingPoiDetailResult | null>(null)
  const [dianpingQueue, setDianpingQueue] = useState<DianpingQueueResult | null>(null)

  useEffect(() => {
    if (!id || poi || loadedPoiId === id) return
    let cancelled = false
    loadPoiById(id).finally(() => {
      if (!cancelled) setLoadedPoiId(id)
    })
    return () => {
      cancelled = true
    }
  }, [id, loadedPoiId, loadPoiById, poi])

  useEffect(() => {
    if (poi) void loadPoisByCityId(poi.cityId)
  }, [loadPoisByCityId, poi])

  useEffect(() => {
    if (!poi) return

    const controller = new AbortController()
    const params = {
      sourceId: poi.sourceId || poi.id,
      name: poi.name,
      cityName: poi.cityId,
    }
    setDianpingDetail(null)
    setDianpingQueue(null)

    void Promise.allSettled([
      fetchDianpingPoiDetail(params, { signal: controller.signal }),
      fetchDianpingQueue(params, { signal: controller.signal }),
    ]).then(([detailResult, queueResult]) => {
      if (controller.signal.aborted) return
      setDianpingDetail(detailResult.status === 'fulfilled' ? detailResult.value : null)
      setDianpingQueue(queueResult.status === 'fulfilled' ? queueResult.value : null)
    })

    return () => controller.abort()
  }, [poi])

  const joinableTrips = useMemo(() => poi ? getPoiJoinCandidates(trips, poi) : [], [poi, trips])
  const selectedTripCanAdd = poi ? joinableTrips.some((trip) => trip.id === selectedTripId && canAddPoiToTrip(trip, poi)) : false

  useEffect(() => {
    if (!poi) return
    setSelectedTripId((current) => {
      if (current && joinableTrips.some((trip) => trip.id === current && canAddPoiToTrip(trip, poi))) return current
      return joinableTrips.find((trip) => canAddPoiToTrip(trip, poi))?.id ?? ''
    })
  }, [joinableTrips, poi])

  if (!poi) {
    return (
      <AppLayout sidebar={false}>
        <div className="p-10 text-center text-slate-500">{id && loadedPoiId !== id ? '正在加载地点详情...' : '未找到该地点'}</div>
      </AppLayout>
    )
  }

  const displayCover = displayPlaceImage(poi.cover, poi.imageConfidence)
  const displayImages = poi.images
    .map((img) => displayPlaceImage(img, poi.imageConfidence))
    .filter(Boolean)
  const imagePendingReview = hasPendingPlaceImageReview(poi.cover, poi.imageConfidence, poi.imagePendingReview)
  const faved = isFavorite(poi.id)
  const nearby = getPoisByCityId(poi.cityId).filter((p) => p.id !== poi.id).slice(0, 4)
  const navigateToPoi = () => {
    if (!canNavigateTo(poi)) {
      setToast('该地点缺少经纬度，暂时无法导航')
      return
    }
    openAmapNavigation({ to: poi, mode: 'car' })
  }

  const sharePoi = async () => {
    try {
      const result = await shareOrCopy({
        title: poi.name,
        text: `${poi.name}：${poi.address}`,
      })
      setToast(result === 'shared' ? '已打开系统分享面板' : '地点链接已复制到剪贴板')
    } catch {
      setToast('分享未完成')
    }
  }

  const joinTrip = () => {
    if (!selectedTripId) {
      setToast('请选择一个行程')
      return
    }
    const added = addPoiToTrip(selectedTripId, poi)
    setJoinOpen(false)
    const trip = trips.find((item) => item.id === selectedTripId)
    setToast(added ? `已将 ${poi.name} 加入 ${trip?.title ?? '行程'}` : `${poi.name} 已在该行程中或行程不可用`)
  }

  const markUseful = (reviewId: string) => {
    if (likedReviewIds.includes(reviewId)) {
      setToast('你已经标记过这条评价')
      return
    }
    setLikedReviewIds((ids) => [...ids, reviewId])
    setReviewLikes((likes) => ({ ...likes, [reviewId]: (likes[reviewId] ?? poi.reviews.find((r) => r.id === reviewId)?.likes ?? 0) + 1 }))
    setToast('已标记为有用')
  }

  const infoItems = [
    { icon: Clock, label: '开放时间', value: poi.openingHours },
    { icon: Ticket, label: '门票', value: poi.ticket },
    { icon: Hourglass, label: '建议游玩', value: poi.suggestedDuration },
    { icon: Users, label: '适合人群', value: poi.suitableFor },
    { icon: MapPin, label: '地址', value: poi.address },
    { icon: Phone, label: '联系电话', value: poi.sourceKind === 'demo_mock' ? '演示数据未提供可信电话' : '暂无可信电话数据' },
  ]
  const sourceLabel = poi.sourceKind === 'demo_mock'
    ? '演示数据'
    : poi.sourceProvider
      ? `来源：${poi.sourceProvider}`
      : '来源待确认'

  return (
    <AppLayout sidebar={false}>
      <div className="mx-auto w-full max-w-[1400px] px-4 pb-20 pt-4 sm:px-5 md:pb-10 lg:px-6 lg:pt-5">
        <nav aria-label="页面位置" className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-500">
         <button
           type="button"
           onClick={() => navigate(mobileOrDesktopPath('/mobile/explore', '/explore'))}
           className="rounded px-1 py-1 text-slate-500 transition-colors hover:text-brand-700"
           aria-label="返回探索页"
         >
           探索
         </button>
          <span className="text-slate-300">/</span>
          <span>景点</span>
          <span className="text-slate-300">/</span>
          <span className="max-w-[12rem] truncate text-slate-700 sm:max-w-md">{poi.name}</span>
        </nav>

        <section className="overflow-hidden rounded-card border border-slate-200 bg-white shadow-card">
          <div className="relative aspect-[4/3] overflow-hidden bg-slate-200 sm:aspect-[16/7] lg:aspect-[30/9]">
            <SmartImage src={displayCover} alt={poi.name} fallbackText={poi.name} className="h-full w-full object-cover" eager />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/35 via-transparent to-slate-950/35" />
            <button
              onClick={() => navigate(-1)}
              className="absolute left-3 top-3 flex min-h-10 items-center gap-1 rounded-lg bg-white/95 px-3 py-2 text-sm font-medium text-slate-700 shadow-card backdrop-blur hover:bg-white sm:left-5 sm:top-5"
              aria-label="返回上一页"
            >
              <ArrowLeft size={16} /> <span className="hidden sm:inline">返回</span>
            </button>
            <div className="absolute right-3 top-3 flex gap-2 sm:right-5 sm:top-5">
              <button
                onClick={() => toggleFavorite(poi.id)}
                className={`os-icon-button gap-1 bg-white/95 px-3 backdrop-blur ${faved ? 'text-risk-600' : ''}`}
                aria-label={faved ? `取消收藏${poi.name}` : `收藏${poi.name}`}
              >
                <Heart size={16} className={faved ? 'fill-current' : ''} /> <span className="hidden sm:inline">{faved ? '已收藏' : '收藏'}</span>
              </button>
              <button onClick={sharePoi} className="os-icon-button gap-1 bg-white/95 px-3 backdrop-blur" aria-label={`分享${poi.name}`}>
                <Share2 size={16} /> <span className="hidden sm:inline">分享</span>
              </button>
            </div>
            <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 sm:bottom-5 sm:left-5">
              <span className="rounded-full bg-slate-950/65 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
                1 / {Math.max(displayImages.length + 1, 1)}
              </span>
              {imagePendingReview && (
                <span className="rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-slate-600 backdrop-blur">
                  图片待确认
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_19rem] lg:p-6">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <Tag tone="blue">{poi.category}</Tag>
                {poi.tags.slice(0, 4).map((tag) => (
                  <Tag key={tag} tone="gray">{tag}</Tag>
                ))}
                <Tag tone={poi.sourceKind === 'demo_mock' ? 'orange' : 'blue'}>{sourceLabel}</Tag>
              </div>
              <h1 className="mt-3 text-2xl font-semibold leading-tight text-slate-950 sm:text-3xl">{poi.name}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <Stars rating={poi.rating} />
                  <span className="font-semibold text-slate-900">{poi.rating}</span>
                </span>
                <span>{poi.reviewCount.toLocaleString()} 条评价</span>
                <span className="hidden text-slate-300 sm:inline">|</span>
                <span className="inline-flex min-w-0 items-center gap-1.5 text-slate-600">
                  <MapPin size={15} className="shrink-0 text-brand-500" />
                  <span className="truncate">{poi.address}</span>
                </span>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <button onClick={() => setJoinOpen(true)} className="btn-primary min-h-11 py-2.5" aria-label={`将${poi.name}加入行程`}>
                <Plus size={16} /> 加入行程
              </button>
              <button onClick={navigateToPoi} className="btn-ghost min-h-11 py-2.5" aria-label={`导航前往${poi.name}`}>
                <Navigation size={16} /> 导航前往
              </button>
            </div>
          </div>

          <div className="grid border-t border-slate-100 bg-slate-50/70 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryPill icon={Clock} label="开放时间" value={shortText(poi.openingHours, 62)} />
            <SummaryPill icon={Hourglass} label="建议游玩" value={poi.suggestedDuration} />
            <SummaryPill icon={Ticket} label="门票价格" value={poi.ticket} />
            <SummaryPill icon={Users} label="适合人群" value={shortText(poi.suitableFor, 42)} />
          </div>
        </section>

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
          {/* 左主列 */}
          <div className="space-y-6">
          <SystemPanel accent="emerald" scan className="p-5">
            <div className="flex flex-col gap-4">
              <div className="flex min-w-0 gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-locate-500 text-white">
                  <Route size={19} />
                </span>
                <div className="min-w-0">
                  <p className="section-eyebrow">AI 路线匹配</p>
                  <h2 className="mt-1 text-base font-semibold text-slate-950">适合加入：城市地标 / 摄影观景 / 轻量城市漫步</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    该地点距离现有上海核心路线较近，适合放在上午开场或傍晚观景段。若当天有排队或天气波动，建议作为可替换节点保留。
                  </p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <FitMetric icon={Compass} label="动线影响" value="低" desc="适合串联核心路线" tone="text-locate-700 bg-locate-50 border-locate-100" />
                <FitMetric icon={ShieldAlert} label="客流风险" value="中" desc="节假日需错峰" tone="text-notice-700 bg-notice-50 border-notice-100" />
                <FitMetric icon={Clock} label="适合时段" value="上午 / 傍晚" desc="避开正午强光与晚高峰" tone="text-brand-700 bg-brand-50 border-brand-100" />
                <FitMetric icon={Plus} label="加入建议" value="可替换节点" desc="适合作为观景或补充点" tone="text-slate-700 bg-slate-100 border-slate-200" />
              </div>
            </div>
          </SystemPanel>

          {/* AI 推荐理由 */}
          <Card className="m-0 border-brand-200 bg-brand-50 p-4">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-600">
                <Sparkles size={20} className="text-white" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-brand-900">AI 精选推荐</p>
                <p className="mt-1 text-sm leading-5 text-brand-800/80">{poi.aiReason}</p>
              </div>
            </div>
          </Card>

          {/* 简介 */}
          <Card className="p-5">
            <h3 className="mb-2 text-base font-semibold text-slate-800">地点介绍</h3>
            <p className="text-sm leading-relaxed text-slate-600">{poi.description}</p>
          </Card>

          {displayImages.length > 0 && (
            <section className="card p-4 sm:p-5">
              <h2 className="mb-3 text-base font-semibold text-slate-950">照片墙</h2>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {displayImages.slice(0, 10).map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    className="relative aspect-square overflow-hidden rounded-lg focus-visible:ring-2 focus-visible:ring-brand-300"
                    aria-label={`查看第 ${i + 1} 张照片`}
                  >
                    <SmartImage
                      src={img}
                      alt={`${poi.name} 照片 ${i + 1}`}
                      fallbackText={poi.name}
                      className="h-full w-full object-cover transition duration-200 hover:scale-105"
                    />
                    {i === 9 && displayImages.length > 10 && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
                        <span className="text-sm font-semibold text-white">+{displayImages.length - 10}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* 用户评价 */}
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">用户评价 ({poi.reviewCount.toLocaleString()})</h3>
              <div className="flex items-center gap-1 text-sm">
                <Star size={16} className="fill-amber-400 text-amber-400" />
                <span className="font-semibold text-slate-800">{poi.rating}</span>
                <span className="text-slate-500">/ 5.0</span>
              </div>
            </div>
            <div className="mb-5 grid gap-4 rounded-lg border border-slate-100 bg-slate-50 p-4 sm:grid-cols-[120px_minmax(0,1fr)]">
              <div>
                <p className="text-4xl font-bold text-slate-950">{poi.rating}</p>
                <Stars rating={poi.rating} size={13} />
                <p className="mt-1 text-xs text-slate-500">{poi.reviewCount.toLocaleString()} 条评价</p>
              </div>
              <div className="space-y-2">
                {[5, 4, 3, 2, 1].map((score) => (
                  <div key={score} className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="w-8">{score}星</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${score === 5 ? 72 : score === 4 ? 20 : 8}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {poi.reviews.map((r) => {
                const liked = likedReviewIds.includes(r.id)
                const likes = reviewLikes[r.id] ?? r.likes
                return (
                <div key={r.id} className="flex gap-3 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                  <SmartImage src={r.avatar} alt={r.user} fallbackText={r.user} className="h-10 w-10 rounded-full object-cover" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-800">{r.user}</p>
                      <span className="text-xs text-slate-500">{r.date}</span>
                    </div>
                    <Stars rating={r.rating} size={12} />
                    <p className="mt-1 text-sm text-slate-600">{r.text}</p>
                    {r.images && (
                      <div className="mt-2 flex gap-2">
                        {r.images.map((img, i) => (
                          <div key={i} className="h-16 w-20 overflow-hidden rounded-lg">
                            <SmartImage src={img} alt="评价图" fallbackText="图" className="h-full w-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => markUseful(r.id)}
                      className={`-ml-2 mt-2 inline-flex min-h-10 min-w-10 items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs transition-colors ${
                        liked ? 'bg-brand-50 font-medium text-brand-600' : 'text-slate-500 hover:bg-slate-50 hover:text-brand-600'
                      }`}
                      aria-label={`标记${r.user}的评价有用`}
                    >
                      <ThumbsUp size={14} className={liked ? 'fill-current' : ''} /> 有用 ({likes})
                    </button>
                  </div>
                </div>
              )})}
            </div>
            <button type="button" className="btn-ghost mt-5 w-full justify-center py-2 text-sm">
              查看全部评价
            </button>
          </Card>
        </div>

          {/* 右栏 */}
          <div className="space-y-6 lg:sticky lg:top-24">
          <Card className="p-5">
            <h3 className="mb-3 text-base font-semibold text-slate-800">基本信息</h3>
            <ul className="space-y-3">
              {infoItems.map((it) => (
                <li key={it.label} className="flex items-start gap-3">
                  <it.icon size={16} className="mt-0.5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">{it.label}</p>
                    <p className="line-clamp-4 text-sm leading-5 text-slate-700" title={it.value}>{shortText(it.value, it.label === '开放时间' ? 120 : 180)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <DianpingSourcePanel detail={dianpingDetail} queue={dianpingQueue} />

          <Card className="p-5">
            <h3 className="mb-3 text-base font-semibold text-slate-800">周边推荐</h3>
            <div className="space-y-3">
              {nearby.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/poi/${p.id}`)}
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-slate-50"
                  aria-label={`查看周边推荐 ${p.name}`}
                >
                  <div className="h-14 w-16 shrink-0 overflow-hidden rounded-lg">
                    <SmartImage src={displayPlaceImage(p.cover, p.imageConfidence)} alt={p.name} fallbackText={p.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{p.name}</p>
                    <div className="mt-0.5 flex items-center gap-1">
                      <Star size={11} className="fill-amber-400 text-amber-400" />
                      <span className="text-xs text-amber-500">{p.rating}</span>
                      <span className="text-xs text-slate-500">· {p.distance} km</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>
          </div>
        </div>
      </div>
      <Modal
        open={joinOpen}
        title="加入行程"
        onClose={() => setJoinOpen(false)}
        footer={
          <>
            <button type="button" onClick={() => setJoinOpen(false)} className="btn-ghost px-4 py-2 text-sm" aria-label="取消加入行程">
              取消
            </button>
            <button
              type="button"
              onClick={joinTrip}
              disabled={!selectedTripCanAdd}
              className="btn-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              aria-label={`确认将${poi.name}加入行程`}
            >
              确认加入
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-500">选择一个同城且可编辑的行程，地点会追加到该行程最后一天末尾。</p>
          {joinableTrips.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
              暂无同城的规划中或草稿行程
            </div>
          ) : (
          <div className="space-y-2">
            {joinableTrips.map((trip) => {
              const joined = isPoiInTrip(trip, poi.id)
              const canAdd = canAddPoiToTrip(trip, poi)
              return (
                <label
                  key={trip.id}
                  className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${
                    selectedTripId === trip.id ? 'border-brand-300 bg-brand-50/60' : 'border-slate-100 hover:bg-slate-50'
                  } ${canAdd ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'}`}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="trip"
                      value={trip.id}
                      checked={selectedTripId === trip.id}
                      onChange={(e) => setSelectedTripId(e.target.value)}
                      disabled={!canAdd}
                      className="h-4 w-4 border-slate-300 text-brand-600"
                    />
                    <span>
                      <span className="block text-sm font-medium text-slate-700">{trip.title}</span>
                      <span className="text-xs text-slate-500">{trip.startDate} 至 {trip.endDate}</span>
                    </span>
                  </span>
                  {joined && <Tag tone="green">已加入</Tag>}
                </label>
              )
            })}
          </div>
          )}
        </div>
      </Modal>
      <Toast message={toast} onClose={() => setToast('')} />
      <div className="safe-area-pb fixed bottom-16 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-lg gap-3">
          <button type="button" onClick={navigateToPoi} className="btn-ghost flex-1 py-2.5" aria-label="导航前往该地点">
            <Navigation size={16} aria-hidden="true" /> 导航前往
          </button>
          <button type="button" onClick={() => setJoinOpen(true)} className="btn-primary flex-1 py-2.5" aria-label="加入行程">
            <Plus size={16} aria-hidden="true" /> 加入行程
          </button>
        </div>
      </div>
    </AppLayout>
  )
}

function SummaryPill({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Compass
  label: string
  value: string
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 border-t border-slate-100 p-4 first:border-t-0 sm:border-l sm:border-t-0 sm:odd:border-l-0 lg:border-l lg:odd:border-l lg:first:border-l-0">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand-100 bg-white text-brand-600 shadow-sm">
        <Icon size={16} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold leading-5 text-slate-800" title={value}>{value}</p>
      </div>
    </div>
  )
}

function FitMetric({
  icon: Icon,
  label,
  value,
  desc,
  tone,
}: {
  icon: typeof Compass
  label: string
  value: string
  desc: string
  tone: string
}) {
  return (
    <div className={`rounded-lg border px-3 py-3 ${tone}`}>
      <Icon size={14} />
      <p className="mt-2 text-[11px] font-medium opacity-70">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
      <p className="mt-1 text-[11px] leading-4 opacity-75">{desc}</p>
    </div>
  )
}

type DisplaySourcedField = {
  value: unknown
  sourceProvider: string
  sourceEndpoint: string
  stale: boolean
  unavailableReason: string | null
  expiresAt: string
}

function DianpingSourcePanel({
  detail,
  queue,
}: {
  detail: DianpingPoiDetailResult | null
  queue: DianpingQueueResult | null
}) {
  const fields = detail?.fields
  const queueField = queue?.fields.queue ?? fields?.queue

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="section-eyebrow">评价来源</p>
          <h3 className="text-base font-semibold text-slate-800">大众点评口碑来源</h3>
        </div>
        <Tag tone={detail?.ok ? 'green' : 'gray'}>{detail?.status ?? '读取中'}</Tag>
      </div>
      <div className="space-y-3">
        <SourcedFactRow label="评分" field={fields?.rating} valueFormatter={(value) => `评分 ${Number(value).toFixed(1)}`} />
        <SourcedFactRow label="评论数" field={fields?.commentCount} valueFormatter={(value) => `${Number(value).toLocaleString()} 条`} />
        <SourcedFactRow label="人均价" field={fields?.avgPrice} valueFormatter={(value) => `人均 ${Number(value).toLocaleString()} 元`} />
        <SourcedFactRow label="推荐菜" field={fields?.recommendedDishes} valueFormatter={formatDishList} />
        <SourcedFactRow label="排队" field={queueField} valueFormatter={formatQueueValue} />
      </div>
    </Card>
  )
}

function SourcedFactRow({
  label,
  field,
  valueFormatter,
}: {
  label: string
  field?: DisplaySourcedField | null
  valueFormatter: (value: unknown) => string
}) {
  const unavailableReason = field ? field.unavailableReason : null
  const value = field?.value == null ? (unavailableReason || '暂无可用数据') : valueFormatter(field.value)
  const state = field ? (field.stale ? '已过期' : '有效') : '未返回'
  const source = field ? `${field.sourceProvider} · ${field.sourceEndpoint}` : 'dianping · 未返回'

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <Tag tone={field?.stale ? 'orange' : field?.value == null ? 'gray' : 'green'}>{state}</Tag>
      </div>
      <p className="line-clamp-2 text-sm font-semibold text-slate-800">{value}</p>
      <p className="mt-1 truncate text-[11px] text-slate-500">{source}</p>
      {field?.expiresAt && <p className="mt-0.5 truncate text-[11px] text-slate-500">到期：{field.expiresAt}</p>}
    </div>
  )
}

function formatDishList(value: unknown) {
  return Array.isArray(value) && value.length > 0 ? value.slice(0, 3).join(' / ') : '暂无推荐菜'
}

function formatQueueValue(value: unknown) {
  const queue = value as DianpingQueueValue
  if (!queue) return '暂无排队数据'
  if (typeof queue.waitingMinutes === 'number') return `约 ${queue.waitingMinutes} 分钟`
  if (typeof queue.waitingTables === 'number') return `${queue.waitingTables} 桌等待`
  return queue.fetchedText || queue.status || '暂无排队数据'
}

function shortText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value
}
