import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  Baby,
  Camera,
  Compass,
  Heart,
  Landmark,
  MapPin,
  Moon,
  Palette,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Trees,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import SmartImage from '../components/ui/SmartImage'
import { Stars } from '../components/ui'
import { useApp } from '../store/AppContext'
import { displayPlaceImage } from '../utils/poiImages'
import type { Poi, PoiCategory } from '../types'

const categories: (PoiCategory | '全部')[] = [
  '全部',
  '景点',
  '美食',
  '文化艺术',
  '购物',
  '公园自然',
  '历史遗迹',
  '亲子游',
  '夜生活',
]

const categoryIcon: Record<string, LucideIcon> = {
  景点: Landmark,
  美食: UtensilsCrossed,
  文化艺术: Palette,
  购物: ShoppingBag,
  公园自然: Trees,
  历史遗迹: Camera,
  亲子游: Baby,
  夜生活: Moon,
}

type SortMode = 'recommended' | 'rating' | 'price'

export default function MobileExplore() {
  const { pois, favorites, toggleFavorite, isFavorite } = useApp()
  const [query, setQuery] = useState('')
  const [activeCat, setActiveCat] = useState<PoiCategory | '全部'>('全部')
  const [sort, setSort] = useState<SortMode>('recommended')

  const filtered = useMemo(() => {
    const kw = query.trim().toLowerCase()
    let list = pois.filter((poi) => {
      const matchCat = activeCat === '全部' || poi.category === activeCat
      const matchKw =
        !kw ||
        poi.name.toLowerCase().includes(kw) ||
        poi.tags.some((tag) => tag.toLowerCase().includes(kw)) ||
        poi.category.toLowerCase().includes(kw)
      return matchCat && matchKw
    })
    if (sort === 'rating') list = [...list].sort((a, b) => b.rating - a.rating)
    else if (sort === 'price') list = [...list].sort((a, b) => a.price - b.price)
    return list
  }, [pois, activeCat, query, sort])

  const sortLabel: Record<SortMode, string> = { recommended: '智能推荐', rating: '评分优先', price: '低价优先' }

  return (
    <AppLayout sidebar={false}>
      <div className="mx-auto w-full max-w-md px-4 pb-8 pt-4">
        {/* 标题 */}
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><span className="h-5 w-1.5 rounded-full bg-gradient-to-b from-brand-500 to-locate-500" aria-hidden="true" />探索景点</h1>
        <p className="mt-0.5 text-xs text-slate-500">发现 {pois.length} 个精选地点，收藏心仪景点</p>

        {/* 搜索栏 */}
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
          <Search size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索景点、标签或类型"
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="清除搜索" className="text-slate-300">
              <X size={15} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* 分类筛选 */}
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {categories.map((cat) => {
            const active = activeCat === cat
            return (
              <button
                key={cat}
                onClick={() => setActiveCat(cat)}
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  active ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                {cat !== '全部' && (() => { const CatIcon = categoryIcon[cat]; return <CatIcon size={13} />; })()}
                {cat}
              </button>
            )
          })}
        </div>

        {/* 排序 + 结果数 */}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-slate-500">找到 {filtered.length} 个结果</span>
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal size={13} className="text-slate-400" aria-hidden="true" />
            <div className="flex gap-1">
              {(Object.keys(sortLabel) as SortMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSort(mode)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                    sort === mode ? 'bg-brand-50 text-brand-600' : 'text-slate-400'
                  }`}
                >
                  {sortLabel[mode]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* POI 列表 */}
        {filtered.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {filtered.map((poi) => (
              <PoiCard
                key={poi.id}
                poi={poi}
                fav={isFavorite(poi.id)}
                onToggleFav={() => toggleFavorite(poi.id)}
              />
            ))}
          </div>
        ) : (
          <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-12 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-500">
              <Compass size={28} aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-700">
                {query ? '没有找到匹配的景点' : '该分类下暂无景点'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {query ? '试试其他关键词，或切换分类筛选' : '切换其他分类看看吧'}
              </p>
            </div>
            {(query || activeCat !== '全部') && (
              <button
                onClick={() => {
                  setQuery('')
                  setActiveCat('全部')
                }}
                className="btn-soft px-4 py-2 text-sm"
              >
                清空筛选
              </button>
            )}
          </div>
        )}

        {/* 收藏统计 */}
        {favorites.length > 0 && (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-locate-200 bg-locate-50/50 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-locate-100 text-locate-600">
              <Heart size={18} className="fill-locate-500 text-locate-500" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-700">已收藏 {favorites.length} 个景点</p>
              <p className="text-xs text-slate-500">在「我的」页面查看全部收藏</p>
            </div>
            <Link to="/mobile/profile" className="shrink-0 text-xs font-medium text-locate-600">
              查看
            </Link>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

function PoiCard({
  poi,
  fav,
  onToggleFav,
}: {
  poi: Poi
  fav: boolean
  onToggleFav: () => void
}) {
  return (
    <div className="touch-press overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <Link to={`/poi/${poi.id}`} className="card-interactive block" aria-label={`查看景点：${poi.name}`}>
        <div className="relative aspect-[4/3] w-full">
          <SmartImage
            src={displayPlaceImage(poi.cover, poi.imageConfidence)}
            alt={poi.name}
            fallbackText={poi.name}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <span className="chip absolute left-2 top-2 bg-white/90 text-[10px] text-slate-700">
            {poi.category}
          </span>
        </div>
        <div className="p-2.5">
          <p className="truncate text-sm font-semibold text-slate-800">{poi.name}</p>
          <div className="mt-1 flex items-center gap-1">
            <Stars rating={poi.rating} size={9} />
            <span className="text-[11px] font-semibold text-amber-500">{poi.rating.toFixed(1)}</span>
            <span className="text-[10px] text-slate-400">({poi.reviewCount})</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="flex items-center gap-0.5 text-[11px] text-slate-400">
              <MapPin size={10} aria-hidden="true" />
              <span className="truncate">{poi.distance > 0 ? `${poi.distance}km` : poi.address.slice(0, 6)}</span>
            </span>
            <span className="text-[11px] font-semibold text-brand-600">
              {poi.price > 0 ? `¥${poi.price}` : '免费'}
            </span>
          </div>
        </div>
      </Link>
      <button
        onClick={onToggleFav}
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-sm transition active:scale-90"
        aria-label={fav ? `取消收藏：${poi.name}` : `收藏：${poi.name}`}
      >
        <Heart
          size={14}
          className={fav ? 'fill-risk-500 text-risk-500' : 'text-slate-400'}
          aria-hidden="true"
        />
      </button>
    </div>
  )
}
