import type { City } from '../types'
import cityDataRaw from '../data/china-prefecture-cities.json'
import provinceDataRaw from '../data/china-provinces.json'
import progressDataRaw from '../../data/poi-collection-progress.json'

type CityLevel = 'municipality' | 'prefecture-city' | 'prefecture' | 'autonomous-prefecture' | 'league'

interface CityMeta {
  id: string
  name: string
  officialName: string
  pinyin: string
  adcode: string
  level: CityLevel
}

interface CityDataSource {
  name: string
  url: string
  scope: string
  retrievedAt: string
}

interface CityData {
  source: CityDataSource
  cities: CityMeta[]
}

interface ProvinceMeta {
  code: string
  name: string
}

interface CollectionProgress {
  cities?: Record<string, { collectedCount?: number }>
}

const cityData = cityDataRaw as CityData
const provinces = provinceDataRaw as ProvinceMeta[]
const progressData = progressDataRaw as CollectionProgress
const provinceByCode = new Map(provinces.map((province) => [province.code, province]))
const progressByCity = new Map(Object.entries(progressData.cities ?? {}))

const countLocalPois = (cityId: string) => progressByCity.get(cityId)?.collectedCount ?? 0
const getProvince = (adcode: string) => provinceByCode.get(adcode.slice(0, 2))
const cityCovers: Partial<Record<string, string>> = {
  shanghai: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Shanghai_skyline_from_the_bund.jpg/960px-Shanghai_skyline_from_the_bund.jpg',
  beijing: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/The_Forbidden_City_-_View_from_Coal_Hill.jpg/960px-The_Forbidden_City_-_View_from_Coal_Hill.jpg',
  hangzhou: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/West_Lake%2C_Hangzhou_2025.jpg/960px-West_Lake%2C_Hangzhou_2025.jpg',
  chengdu: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Chengdu_Research_Base_Eingang.jpg/960px-Chengdu_Research_Base_Eingang.jpg',
  xian: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/51714-Terracota-Army.jpg/960px-51714-Terracota-Army.jpg',
  sanya: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Yalong_Bay_01.jpg/960px-Yalong_Bay_01.jpg',
}

const featuredCityDetails: Partial<Record<string, Pick<City, 'description' | 'cover' | 'hot'>>> = {
  shanghai: {
    description: '摩登都市与海派文化交融，外滩、豫园、迪士尼一站式畅游。',
    cover: cityCovers.shanghai ?? '',
    hot: true,
  },
  beijing: {
    description: '千年古都，故宫长城承载厚重历史，胡同里藏着烟火人间。',
    cover: cityCovers.beijing ?? '',
    hot: true,
  },
  hangzhou: {
    description: '上有天堂下有苏杭，西湖烟雨与宋韵文化令人流连。',
    cover: cityCovers.hangzhou ?? '',
    hot: true,
  },
  chengdu: {
    description: '慢生活之都，火锅、熊猫与茶馆构成巴适的成都味道。',
    cover: cityCovers.chengdu ?? '',
    hot: true,
  },
  xian: {
    description: '十三朝古都，兵马俑与大唐不夜城带你穿越历史长河。',
    cover: cityCovers.xian ?? '',
    hot: false,
  },
  sanya: {
    description: '热带滨海度假胜地，碧海蓝天与海岛活动尽享惬意时光。',
    cover: cityCovers.sanya ?? '',
    hot: false,
  },
}

const featuredCityOrder = ['shanghai', 'beijing', 'hangzhou', 'chengdu', 'xian', 'sanya']
const featuredRank = new Map(featuredCityOrder.map((id, index) => [id, index]))
const sourceRank = new Map(cityData.cities.map((city, index) => [city.id, index]))
const cityLevelLabels: Record<CityLevel, string> = {
  municipality: '直辖市',
  'prefecture-city': '地级市',
  prefecture: '地区',
  'autonomous-prefecture': '自治州',
  league: '盟',
}
const municipalityCityIds = new Set(['beijing', 'shanghai', 'tianjin', 'chongqing'])
const capitalCityIds = new Set([
  'shijiazhuang',
  'taiyuan',
  'hohhot',
  'shenyang',
  'changchun',
  'haerbin',
  'nanjing',
  'hangzhou',
  'hefei',
  'fuzhou',
  'nanchang',
  'jinan',
  'zhengzhou',
  'wuhan',
  'changsha',
  'guangzhou',
  'nanning',
  'haikou',
  'chengdu',
  'guiyang',
  'kunming',
  'lhasa',
  'xian',
  'lanzhou',
  'xining',
  'yinchuan',
  'urumqi',
])
const keyCityIds = new Set([
  'shenzhen',
  'suzhou',
  'ningbo',
  'qingdao',
  'xiamen',
  'dalian',
  'foshan',
  'dongguan',
  'wuxi',
  'wenzhou',
  'quanzhou',
  'zhuhai',
  'sanya',
  'luoyang',
  'yantai',
  'changzhou',
  'nantong',
  'xuzhou',
  'jiaxing',
  'shaoxing',
  'taizhou-331000',
])

// 城市数据：基础行政区划来自民政部官方 2024 县以上行政区划代码，poiCount 表示当前 POI 数量。
const baseCities: Omit<City, 'poiCount'>[] = [...cityData.cities]
  .sort((left, right) => {
    const leftFeatured = featuredRank.has(left.id)
    const rightFeatured = featuredRank.has(right.id)
    if (leftFeatured !== rightFeatured) return leftFeatured ? -1 : 1
    if (leftFeatured && rightFeatured) {
      return (featuredRank.get(left.id) ?? 0) - (featuredRank.get(right.id) ?? 0)
    }
    return (sourceRank.get(left.id) ?? 0) - (sourceRank.get(right.id) ?? 0)
  })
  .map((city) => {
    const featured = featuredCityDetails[city.id]
    return {
      id: city.id,
      name: city.name,
      pinyin: city.pinyin,
      adcode: city.adcode,
      level: city.level,
      provinceCode: city.adcode.slice(0, 2),
      provinceName: getProvince(city.adcode)?.name,
      country: '中国',
      description:
        featured?.description ??
        `${city.name}为${cityLevelLabels[city.level]}，来源于${cityData.source.name}，可用于城市选择、路线规划与 POI 探索。`,
      cover: featured?.cover ?? '',
      hot: featured?.hot ?? false,
    }
  })

export const citySource = cityData.source

export const cities: City[] = baseCities.map((city) => ({
  ...city,
  poiCount: countLocalPois(city.id),
}))

export const cityOptionGroups = [
  {
    label: '直辖市',
    cities: cities.filter((city) => municipalityCityIds.has(city.id)),
  },
  {
    label: '省会 / 自治区首府',
    cities: cities.filter((city) => capitalCityIds.has(city.id)),
  },
  {
    label: '重点城市',
    cities: cities.filter((city) => keyCityIds.has(city.id)),
  },
  {
    label: '其他地级行政区',
    cities: cities.filter(
      (city) =>
        !municipalityCityIds.has(city.id) &&
        !capitalCityIds.has(city.id) &&
        !keyCityIds.has(city.id),
    ),
  },
].filter((group) => group.cities.length > 0)

export const getCity = (id: string) => cities.find((c) => c.id === id)
