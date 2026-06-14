import type { RoutePlan } from '../types'
import { getPoi } from './pois'

const stop = (poiId: string, order: number) => {
  const p = getPoi(poiId)!
  return { poiId, name: p.name, cover: p.cover, order }
}

// 三套推荐路线方案：效率 / 体验 / 预算优先
export const routePlans: RoutePlan[] = [
  {
    id: 'plan-efficient',
    type: '效率优先',
    name: '经典精华两日游',
    recommended: true,
    days: 2,
    totalDuration: '约 16.2 小时',
    budget: 980,
    distance: 16.2,
    satisfaction: 96,
    tags: ['地标必打卡', '动线最优', '少走回头路'],
    summary:
      '以最紧凑的动线串联外滩、豫园、陆家嘴等核心地标，两天高效逛遍上海精华，适合时间有限又想一网打尽的旅行者。',
    stops: [
      stop('waitan', 1),
      stop('nanjinglu', 2),
      stop('yuyuan', 3),
      stop('xiaolongbao', 4),
      stop('lujiazui', 5),
      stop('jingansi', 6),
    ],
  },
  {
    id: 'plan-experience',
    type: '体验优先',
    name: '文艺漫生活路线',
    recommended: false,
    days: 2,
    totalDuration: '约 14.5 小时',
    budget: 1180,
    distance: 12.5,
    satisfaction: 94,
    tags: ['深度体验', 'CityWalk', '出片率高'],
    summary:
      '放慢脚步深入梧桐区与创意街区，武康路、田子坊、外滩源串联起上海最有腔调的一面，适合追求质感与氛围的你。',
    stops: [
      stop('wukangroad', 1),
      stop('tianzifang', 2),
      stop('waitan', 3),
      stop('thebund-bar', 4),
      stop('lujiazui', 5),
    ],
  },
  {
    id: 'plan-budget',
    type: '预算优先',
    name: '美食探索亲民线',
    recommended: false,
    days: 2,
    totalDuration: '约 15.2 小时',
    budget: 520,
    distance: 14.3,
    satisfaction: 90,
    tags: ['高性价比', '免费景点多', '本地小吃'],
    summary:
      '以免费地标搭配平价小吃，外滩、南京路、世纪公园皆零门票或低门票，把预算留给地道美食，省心又省钱。',
    stops: [
      stop('waitan', 1),
      stop('nanjinglu', 2),
      stop('xiaolongbao', 3),
      stop('yuyuan', 4),
      stop('centurypark', 5),
    ],
  },
]

export const getPlan = (id: string) => routePlans.find((p) => p.id === id)
