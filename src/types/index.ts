// 智行路线 全局类型定义

export interface User {
  id: string
  name: string
  email: string
  phone: string
  city?: string
  avatar: string
  level: string
  joinedAt: string
  bio: string
}

export interface City {
  id: string
  name: string
  pinyin: string
  adcode?: string
  level?: string
  provinceCode?: string
  provinceName?: string
  country: string
  description: string
  cover: string
  poiCount: number
  hot: boolean
}

export type PoiCategory =
  | '景点'
  | '美食'
  | '文化艺术'
  | '购物'
  | '亲子游'
  | '公园自然'
  | '历史遗迹'
  | '夜生活'

export interface Review {
  id: string
  user: string
  avatar: string
  rating: number
  date: string
  text: string
  images?: string[]
  likes: number
}

export type PoiImageConfidence = 'poi-photo' | 'verified' | 'unverified' | 'pending-review'

export type DataSourceKind =
  | 'authoritative_static'
  | 'provider_snapshot'
  | 'realtime_observation'
  | 'derived_recommendation'
  | 'demo_mock'
  | 'unavailable'

export type SourceProvider = 'amap' | 'mca' | 'deepseek' | 'demo_mock' | 'unavailable' | string

export interface SourcedField<T> {
  value: T | null
  sourceProvider: SourceProvider
  sourceEndpoint: string
  sourceId: string
  fetchedAt: string
  expiresAt: string
  confidence: DataSourceKind
  stale: boolean
  unavailableReason: string | null
  rawSnapshotId: string
}

export interface ProviderSnapshot<T = unknown> {
  rawSnapshotId: string
  sourceProvider: SourceProvider
  sourceEndpoint: string
  sourceId: string
  fetchedAt: string
  expiresAt: string
  stale: boolean
  unavailableReason: string | null
  raw: T
}

export interface Poi {
  id: string
  sourceKind?: DataSourceKind
  sourceProvider?: SourceProvider
  sourceId?: string
  rawSnapshotId?: string
  name: string
  cityId: string
  category: PoiCategory
  rating: number
  reviewCount: number
  cover: string
  images: string[]
  imageConfidence?: PoiImageConfidence
  imageSource?: string
  imageVerifiedAt?: string
  imagePendingReview?: boolean
  imageReviewReason?: string
  tags: string[]
  // 地图坐标（0-100 的相对百分比，便于在 mock 地图上定位）
  x: number
  y: number
  // 真实经纬度（GCJ-02 火星坐标系，供高德地图使用）
  lng: number
  lat: number
  address: string
  openingHours: string
  ticket: string
  suggestedDuration: string
  suitableFor: string
  price: number
  distance: number
  aiReason: string
  description: string
  reviews: Review[]
}

export type PlanType = '效率优先' | '体验优先' | '预算优先'

export interface PlanStop {
  poiId: string
  name: string
  cover: string
  order: number
  category?: PoiCategory
  lng?: number
  lat?: number
  x?: number
  y?: number
  rating?: number
  cost?: number
  address?: string
  openingHours?: string
  imageConfidence?: PoiImageConfidence
  imageSource?: string
  imageVerifiedAt?: string
  imagePendingReview?: boolean
  imageReviewReason?: string
}

export interface RoutePlan {
  id: string
  type: PlanType
  name: string
  recommended: boolean
  days: number
  totalDuration: string
  budget: number
  distance: number
  satisfaction: number
  tags: string[]
  stops: PlanStop[]
  summary: string
  aiReason?: string
}

export type ActivityStatus = '已完成' | '进行中' | '待出发'

export interface ItineraryItem {
  id: string
  time: string
  poiId?: string
  name: string
  category: PoiCategory | '交通' | '住宿'
  cover: string
  activity: string
  duration: string
  transport: string
  cost: number
  status: ActivityStatus
  note?: string
  // 地图坐标
  x: number
  y: number
  // 真实经纬度（GCJ-02，供高德地图使用）
  lng: number
  lat: number
  // 节点配色（彩色编号）
  color: string
}

export interface ItineraryDay {
  day: number
  date: string
  title: string
  items: ItineraryItem[]
}

export interface Trip {
  id: string
  title: string
  cityId: string
  cover: string
  startDate: string
  endDate: string
  days: number
  travelers: number
  budget: number
  distance: number
  totalDuration: string
  status: '草稿' | '规划中' | '已完成' | '收藏'
  planType: PlanType
  itinerary: ItineraryDay[]
  notes: string[]
  checkpoints: string[]
  tips: string[]
}

export interface Weather {
  city: string
  date: string
  temp: number
  condition: string
  icon: string
  high: number
  low: number
  humidity: number
  wind: string
  airQuality: string
  forecast: { day: string; icon: string; high: number; low: number }[]
}

export type EventType = '交通拥堵' | '天气变化' | '排队提醒' | '景点拥挤'
export type EventLevel = '高' | '中' | '低'

export interface RealtimeEvent {
  id: string
  type: EventType
  level: EventLevel
  title: string
  description: string
  time: string
  affectedPoi: string
}

export interface DynamicLog {
  id: string
  time: string
  type: 'info' | 'success' | 'warning'
  title: string
  detail: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  time: string
}

export interface PreferenceProfile {
  interests: { label: string; weight: number }[]
  cuisines: { label: string; weight: number }[]
  pace: string
  partner: string
  budgetLevel: string
  rhythm: { label: string; value: number }[]
  stats: {
    totalTrips: number
    totalCities: number
    totalPois: number
    totalDays: number
  }
  tags: string[]
}

// 新建行程草稿
export interface TripDraft {
  cityId: string
  cityName: string
  days: number
  startDate: string
  endDate: string
  travelers: number
  travelType: string[]
  travellerType?: string
  style: string
  startPoint: string
  endPoint: string
  interests: string[]
  cuisines: string[]
  pace: string
  partner: string
  accessibility: boolean
  spotPreference: string
  budget: number
  activityTime: [string, string]
  transport: string[]
  walkRange: string
  diningBudget: string
  queueTolerance: string
  avoidPeak: boolean
  freeFirst: boolean
  indoorFirst: boolean
  accessibleFirst: boolean
  childFriendly: boolean
  specialNeeds: string
}
