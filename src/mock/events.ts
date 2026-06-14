import type { RealtimeEvent, DynamicLog, ChatMessage } from '../types'

// 风险事件数据：用于动态提醒，不代表实时监测结果。
export const realtimeEvents: RealtimeEvent[] = [
  {
    id: 'evt-1',
    type: '交通拥堵',
    level: '高',
    title: '延安高架路段拥堵',
    description: '前往陆家嘴途经路段出现严重拥堵，估算延误 25 分钟，建议改乘地铁 2 号线。',
    time: '14:20',
    affectedPoi: '陆家嘴',
  },
  {
    id: 'evt-2',
    type: '天气变化',
    level: '中',
    title: '傍晚阵雨提醒',
    description: '17:00 后外滩区域可能有短时阵雨，建议携带雨具或调整为室内行程。',
    time: '13:50',
    affectedPoi: '外滩',
  },
  {
    id: 'evt-3',
    type: '排队提醒',
    level: '中',
    title: '豫园小笼餐饮排队',
    description: '南翔馒头店（豫园店）等位约 45 分钟，建议先线上取号或调整用餐时间。',
    time: '12:30',
    affectedPoi: '南翔馒头店（豫园店）',
  },
  {
    id: 'evt-4',
    type: '景点拥挤',
    level: '低',
    title: '豫园客流上升',
    description: '豫园客流达到承载量的 70%，整体仍可顺畅游览。',
    time: '11:10',
    affectedPoi: '豫园',
  },
]

// 行程动态更新时间线
export const dynamicLogs: DynamicLog[] = [
  {
    id: 'log-1',
    time: '14:22',
    type: 'warning',
    title: '检测到交通拥堵',
    detail: '前往陆家嘴的驾车路线拥堵，系统已生成绕行与换乘建议。',
  },
  {
    id: 'log-2',
    time: '13:05',
    type: 'success',
    title: '行程顺利推进',
    detail: '南京路步行街行程已完成，进度符合预期。',
  },
  {
    id: 'log-3',
    time: '12:30',
    type: 'info',
    title: '智能提醒',
    detail: '已为南翔馒头店（豫园店）线上取号，预计入座时间为 12:45。',
  },
  {
    id: 'log-4',
    time: '09:05',
    type: 'success',
    title: '行程已开始',
    detail: '外滩行程顺利开启，祝你旅途愉快！',
  },
]

// 智行助手默认对话
export const assistantMessages: ChatMessage[] = [
  {
    id: 'msg-1',
    role: 'assistant',
    text: '你好，我是智行助手。你可以问我关于当前行程的问题，比如「下一站怎么走」「附近有什么好吃的」。',
    time: '14:20',
  },
  {
    id: 'msg-2',
    role: 'user',
    text: '去陆家嘴堵车了，有没有更快的方式？',
    time: '14:23',
  },
  {
    id: 'msg-3',
    role: 'assistant',
    text: '建议你改乘地铁 2 号线，从南京东路站到陆家嘴站仅需 8 分钟，可节省约 17 分钟。需要我帮你更新行程吗？',
    time: '14:23',
  },
]
