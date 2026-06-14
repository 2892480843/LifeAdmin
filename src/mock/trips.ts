import type { Trip } from '../types'
import { addMockDays, formatMockDate } from './dates'
import { getPoi } from './pois'

const node = (
  poiId: string,
  time: string,
  duration: string,
  transport: string,
  cost: number,
  status: Trip['itinerary'][number]['items'][number]['status'],
  color: string,
  activity: string,
  note?: string,
) => {
  const p = getPoi(poiId)!
  return {
    id: `${poiId}-${time}`,
    time,
    poiId,
    name: p.name,
    category: p.category,
    cover: p.cover,
    activity,
    duration,
    transport,
    cost,
    status,
    note,
    x: p.x,
    y: p.y,
    lng: p.lng,
    lat: p.lat,
    color,
  }
}

const mainTripStartDate = formatMockDate()
const mainTripEndDate = addMockDays(mainTripStartDate, 1)

// 主行程：上海经典两日游（贯穿总览 / 地图 / 列表 / 动态）
// budget 表示整趟行程预算上限，节点 cost 表示已规划项目的费用估算。
export const mainTrip: Trip = {
  id: 'trip-shanghai-2d',
  title: '上海经典两日游',
  cityId: 'shanghai',
  cover: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Shanghai_skyline_from_the_bund.jpg/960px-Shanghai_skyline_from_the_bund.jpg',
  startDate: mainTripStartDate,
  endDate: mainTripEndDate,
  days: 2,
  travelers: 2,
  budget: 1200,
  distance: 16.2,
  totalDuration: '约 16 小时',
  status: '规划中',
  planType: '效率优先',
  itinerary: [
    {
      day: 1,
      date: mainTripStartDate,
      title: '城市地标与海派风情',
      items: [
        node('waitan', '09:00', '1.5 小时', '步行', 0, '已完成', '#2563eb', '漫步外滩观赏万国建筑群', '建议先到外滩，上午光线适合拍照'),
        node('nanjinglu', '11:00', '1.5 小时', '步行', 120, '已完成', '#14b8a6', '南京路步行街购物逛街', '老字号众多，可顺路买伴手礼'),
        node('xiaolongbao', '12:45', '1 小时', '步行', 160, '进行中', '#f59e0b', '豫园老字号小笼午餐', '当前等位较长，可提前取号或错峰用餐'),
        node('yuyuan', '14:30', '2 小时', '打车', 80, '待出发', '#8b5cf6', '游览豫园江南古典园林', '门票 ¥40，闭馆前一小时停止入园'),
        node('lujiazui', '17:30', '2 小时', '地铁', 180, '待出发', '#ec4899', '登陆家嘴俯瞰城市天际线', '日落时段景色最佳'),
      ],
    },
    {
      day: 2,
      date: mainTripEndDate,
      title: '文艺街区与自然休闲',
      items: [
        node('wukangroad', '09:30', '1.5 小时', '地铁', 0, '待出发', '#2563eb', '武康路 CityWalk 漫步梧桐区', '清晨人少，适合拍照'),
        node('tianzifang', '11:30', '1.5 小时', '步行', 60, '待出发', '#14b8a6', '田子坊探访创意弄堂', '小店密集，注意保管随身物品'),
        node('jingansi', '14:00', '1 小时', '地铁', 50, '待出发', '#f59e0b', '静安寺祈福与建筑欣赏', '闹中取静的城市古刹'),
        node('centurypark', '16:00', '2 小时', '地铁', 10, '待出发', '#8b5cf6', '世纪公园骑行放松', '可租自行车环湖'),
      ],
    },
  ],
  notes: [
    '两日均以公共交通为主，建议办理交通卡或开通乘车码。',
    '第一天傍晚陆家嘴观景人流较多，建议提前购票。',
    '随身携带雨具，梅雨季节天气多变。',
    '预算为整趟行程预算上限，明细页中的合计费用为已规划节点估算。',
  ],
  checkpoints: ['09:00 外滩集合', '12:45 午餐补给点', '17:30 日落观景检查点'],
  tips: ['预算上限约 ¥600/人/天', '已规划节点费用约 ¥660', '全程步行约 6 公里', '推荐携带充电宝'],
}

// 其他行程（用于个人中心 / 列表）
export const trips: Trip[] = [
  mainTrip,
  {
    id: 'trip-beijing-3d',
    title: '北京历史文化三日游',
    cityId: 'beijing',
    cover: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/The_Forbidden_City_-_View_from_Coal_Hill.jpg/960px-The_Forbidden_City_-_View_from_Coal_Hill.jpg',
    startDate: '2024-04-02',
    endDate: '2024-04-04',
    days: 3,
    travelers: 3,
    budget: 2600,
    distance: 28.4,
    totalDuration: '约 24 小时',
    status: '已完成',
    planType: '体验优先',
    itinerary: [
      {
        day: 1,
        date: '2024-04-02',
        title: '中轴线经典与宫城深度',
        items: [
          node('tiananmen', '08:30', '1.5 小时', '步行', 0, '已完成', '#2563eb', '从天安门广场开启北京中轴线参观', '广场安检与预约规则以现场为准，建议预留排队时间'),
          node('gugong', '10:30', '4 小时', '步行', 60, '已完成', '#14b8a6', '故宫博物院宫殿建筑与展陈深度游览', '故宫体量较大，午间可在馆内简餐或自备补给'),
          node('wangfujing', '17:30', '2 小时', '地铁', 180, '已完成', '#f59e0b', '王府井步行街晚餐与老字号补给', '适合作为第一天高强度步行后的餐饮和购物节点'),
        ],
      },
      {
        day: 2,
        date: '2024-04-03',
        title: '皇家园林与胡同 CityWalk',
        items: [
          node('summerpalace', '09:00', '3.5 小时', '地铁', 90, '已完成', '#2563eb', '颐和园昆明湖与长廊慢游', '园区步行距离较长，可按体力选择游船或分段游览'),
          node('nanluoguxiang', '15:00', '2 小时', '地铁', 150, '已完成', '#8b5cf6', '南锣鼓巷胡同街区与文创小店漫步', '高峰期人流密集，适合错峰进入周边支巷'),
        ],
      },
      {
        day: 3,
        date: '2024-04-04',
        title: '祭祀建筑与轻量返程',
        items: [
          node('tiantan', '09:00', '2.5 小时', '地铁', 45, '已完成', '#2563eb', '天坛公园祈年殿与园区步行', '园区南北跨度较大，返程前控制步行强度'),
          node('wangfujing', '13:30', '1.5 小时', '地铁', 120, '已完成', '#10b981', '王府井返程前午餐和伴手礼采购', '靠近核心交通节点，便于结束行程'),
        ],
      },
    ],
    notes: [
      '三天均以地铁和步行为主，北京核心景区安检和预约较多，建议提前确认入园凭证。',
      '故宫与颐和园单点游览时间较长，午餐和休息点需要提前安排。',
      '历史文化类路线步行强度偏高，建议穿舒适鞋并携带身份证件。',
    ],
    checkpoints: ['08:30 天安门广场安检', '10:30 故宫入场预约', '09:00 颐和园入园', '09:00 天坛返程日节奏确认'],
    tips: ['历史文化深度路线', '建议提前预约热门景区', '三人预算上限 ¥2600', '核心城区地铁优先'],
  },
  {
    id: 'trip-chengdu-2d',
    title: '成都美食休闲两日游',
    cityId: 'chengdu',
    cover: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Chengdu_Research_Base_Eingang.jpg/960px-Chengdu_Research_Base_Eingang.jpg',
    startDate: '2024-07-20',
    endDate: '2024-07-21',
    days: 2,
    travelers: 2,
    budget: 1500,
    distance: 12.0,
    totalDuration: '约 15 小时',
    status: '已完成',
    planType: '预算优先',
    itinerary: [
      {
        day: 1,
        date: '2024-07-20',
        title: '熊猫基地与市中心慢逛',
        items: [
          node('panda-base', '08:00', '3 小时', '打车', 110, '已完成', '#2563eb', '上午前往熊猫基地，避开午后高温与人流', '园区较大，建议优先看幼年熊猫和核心展区'),
          node('dacisi', '13:30', '1 小时', '地铁', 0, '已完成', '#14b8a6', '大慈寺与太古里片区短暂停留', '适合午后休息，周边餐饮和咖啡选择多'),
          node('jinli', '18:00', '2 小时', '打车', 160, '已完成', '#f59e0b', '锦里古街小吃与夜游', '小吃摊位密集，预算优先可少量多样尝试'),
        ],
      },
      {
        day: 2,
        date: '2024-07-21',
        title: '三国文化与街区美食',
        items: [
          node('wuhouci', '10:00', '2 小时', '地铁', 50, '已完成', '#2563eb', '武侯祠三国文化和园林游览', '与锦里相邻，可按体力合并步行游览'),
          node('jinli', '12:30', '1.5 小时', '步行', 130, '已完成', '#10b981', '锦里午餐和伴手礼补给', '返程前控制用餐时间，避免影响后续交通'),
        ],
      },
    ],
    notes: [
      '成都夏季户外体感较热，熊猫基地建议上午安排。',
      '本路线以低成本交通和街区小吃为主，预算重点留给餐饮体验。',
      '锦里和武侯祠距离近，可根据体力压缩或延长停留。',
    ],
    checkpoints: ['08:00 熊猫基地入园', '18:00 锦里晚餐节点', '10:00 武侯祠文化游览'],
    tips: ['预算优先路线', '上午看熊猫体验更好', '小吃分散消费', '市中心步行友好'],
  },
  {
    id: 'trip-hangzhou-2d',
    title: '杭州西湖宋韵两日游',
    cityId: 'hangzhou',
    cover: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/West_Lake%2C_Hangzhou_2025.jpg/960px-West_Lake%2C_Hangzhou_2025.jpg',
    startDate: '2024-05-01',
    endDate: '2024-05-02',
    days: 2,
    travelers: 4,
    budget: 1800,
    distance: 18.6,
    totalDuration: '约 16 小时',
    status: '收藏',
    planType: '体验优先',
    itinerary: [
      {
        day: 1,
        date: '2024-05-01',
        title: '西湖湖景与山林古寺',
        items: [
          node('westlake', '09:00', '3 小时', '步行', 0, '待出发', '#2563eb', '西湖湖滨、断桥和苏堤分段漫游', '五一人流较多，建议避开湖滨核心高峰'),
          node('lingyinsi', '14:00', '2.5 小时', '打车', 150, '待出发', '#14b8a6', '灵隐寺与飞来峰山林文化体验', '寺院和飞来峰票务分开，现场以官方规则为准'),
          node('hefangjie', '18:30', '1.5 小时', '打车', 220, '待出发', '#f59e0b', '河坊街夜间小吃与手信采购', '街区人流密集，注意控制用餐和购物节奏'),
        ],
      },
      {
        day: 2,
        date: '2024-05-02',
        title: '湿地自然与宋韵街区',
        items: [
          node('xixi', '09:30', '3 小时', '打车', 240, '待出发', '#2563eb', '西溪湿地步行或游船慢游', '湿地受天气影响较明显，雨天优先调整到室内或短线'),
          node('hefangjie', '15:30', '1.5 小时', '地铁', 180, '待出发', '#8b5cf6', '河坊街返程前补充宋韵街区体验', '收藏路线可作为后续杭州出行模板继续调整'),
        ],
      },
    ],
    notes: [
      '杭州五一假期景区人流高，西湖与灵隐寺建议提前规划入场和交通。',
      '体验优先路线强调湖景、古寺、湿地和街区层次，可根据天气调整顺序。',
      '西溪湿地与灵隐寺距离市中心较远，打车和地铁时间需要留足。',
    ],
    checkpoints: ['09:00 西湖人流观察', '14:00 灵隐寺入场', '09:30 西溪天气确认'],
    tips: ['体验优先收藏路线', '适合复制为五一模板', '湖景与湿地结合', '预算上限 ¥1800'],
  },
]

export const getTrip = (id: string) => trips.find((t) => t.id === id)
