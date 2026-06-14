import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Plus,
  Map,
  Route,
  Activity,
  User,
  Settings,
  Sparkles,
  Gauge,
  CheckCircle2,
  Crown,
  Clock3,
  ShieldCheck,
  UsersRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Modal } from '../ui'

interface NavGroup {
  title: string
  items: { label: string; path: string; icon: LucideIcon }[]
}

const groups: NavGroup[] = [
  {
    title: '规划',
    items: [
      { label: '首页概览', path: '/dashboard', icon: LayoutDashboard },
      { label: '新建行程', path: '/new-trip', icon: Plus },
      { label: '地图探索', path: '/explore', icon: Map },
    ],
  },
  {
    title: '我的旅程',
    items: [
      { label: '我的行程', path: '/trips', icon: Route },
      { label: '实时动态', path: '/realtime', icon: Activity },
    ],
  },
  {
    title: '账户',
    items: [
      { label: '个人中心', path: '/profile', icon: User },
      { label: '设置', path: '/settings', icon: Settings },
    ],
  },
]

const membershipUsage = {
  total: 12,
  remaining: 8,
}

const membershipRemainingPercent = (membershipUsage.remaining / membershipUsage.total) * 100

const membershipBenefits: { title: string; desc: string; icon: LucideIcon; tone: string }[] = [
  {
    title: '无限次 AI 行程生成',
    desc: '支持多轮重算、复制方案与按偏好继续细化。',
    icon: Sparkles,
    tone: 'bg-brand-50 text-brand-700',
  },
  {
    title: '高峰排队与拥堵预警',
    desc: '在热门景点、通勤时段和恶劣天气前给出调整建议。',
    icon: Clock3,
    tone: 'bg-notice-50 text-notice-600',
  },
  {
    title: '高级偏好画像',
    desc: '结合收藏、预算、节奏和同行人生成更稳定的推荐权重。',
    icon: ShieldCheck,
    tone: 'bg-emerald-50 text-emerald-700',
  },
  {
    title: '多人协同行程编辑',
    desc: '邀请同行人共同调整日程，减少来回确认成本。',
    icon: UsersRound,
    tone: 'bg-slate-100 text-slate-700',
  },
]

const membershipPlans = [
  {
    name: '免费版',
    price: '¥0',
    badge: '当前方案',
    quota: '每日 12 次 AI 生成',
    features: ['基础路线推荐', '收藏与行程管理', '实时页状态查看'],
    current: true,
  },
  {
    name: '智行会员',
    price: '¥29/月',
    badge: '推荐体验',
    quota: '不限次 AI 生成',
    features: ['高级偏好画像', '拥堵与排队预警', '多人协同编辑', '优先生成队列'],
    current: false,
  },
]

// 左侧导航栏（仪表盘 / 个人中心 / 设置 / 实时动态等页面使用）
export default function Sidebar() {
  const navigate = useNavigate()
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  const openAiSettings = () => {
    setUpgradeOpen(false)
    navigate('/settings?section=ai')
  }

  return (
    <aside className="sidebar-rail sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 flex-col overflow-y-auto border-r border-slate-200/80 bg-white px-3 py-5 lg:flex">
      <nav className="flex-1 space-y-6">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="px-3 pb-2 text-xs font-semibold text-slate-500">{group.title}</p>
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li key={item.label + item.path}>
                  <NavLink
                    to={item.path}
                    end={item.path === '/dashboard'}
                    className={({ isActive }) =>
                      `flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 ${
                        isActive
                          ? 'bg-brand-50 font-semibold text-brand-700'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`
                    }
                  >
                    <item.icon size={18} aria-hidden="true" />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-4 rounded-card border border-slate-200 bg-slate-50/70 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Sparkles size={18} aria-hidden="true" />
          </span>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">在线</span>
        </div>
        <p className="text-sm font-semibold text-slate-800">AI 规划额度</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">今日还可生成 {membershipUsage.remaining} 次，适合继续细化行程和偏好画像。</p>
        <div className="mt-3 flex items-center gap-2">
          <Gauge size={14} className="text-brand-600" aria-hidden="true" />
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white">
            <div className="route-progress h-full rounded-full" style={{ width: `${membershipRemainingPercent}%` }} />
          </div>
          <span className="text-[11px] font-medium text-slate-500">{membershipUsage.remaining}/{membershipUsage.total}</span>
        </div>
        <button
          type="button"
          onClick={() => setUpgradeOpen(true)}
          aria-label="查看 AI 规划会员权益"
          className="btn-ghost mt-3 w-full py-2 text-xs"
        >
          查看权益
        </button>
      </div>
      <Modal
        open={upgradeOpen}
        title="智行会员权益"
        onClose={() => setUpgradeOpen(false)}
        className="max-w-2xl"
        bodyClassName="max-h-[min(70dvh,42rem)] overflow-y-auto px-5 py-4"
        footer={
          <>
            <button type="button" onClick={() => setUpgradeOpen(false)} className="btn-ghost px-4 py-2 text-sm" aria-label="暂不升级会员">
              暂不升级
            </button>
            <button type="button" onClick={openAiSettings} className="btn-primary px-4 py-2 text-sm" aria-label="查看完整 AI 设置">
              查看完整 AI 设置
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-4 rounded-card border border-brand-100 bg-brand-50 p-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-brand-700">
                <Crown size={13} aria-hidden="true" />
                会员权益预览
              </div>
              <p className="text-base font-semibold text-slate-950">从基础规划升级到持续优化的旅行助手</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">当前弹窗不会发起真实支付；你可以先查看权益，再到 AI 设置里调整推荐强度与自动化能力。</p>
            </div>
            <div className="rounded-lg border border-white/80 bg-white p-3">
              <p className="text-xs font-medium text-slate-500">今日额度</p>
              <p className="mt-1 text-2xl font-semibold text-brand-700">{membershipUsage.remaining}</p>
              <p className="text-xs text-slate-500">剩余 / 共 {membershipUsage.total} 次</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand-600" style={{ width: `${membershipRemainingPercent}%` }} />
              </div>
            </div>
          </div>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">核心权益</h3>
              <span className="text-xs text-slate-500">覆盖规划、预警、画像与协作</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {membershipBenefits.map((benefit) => (
                <div key={benefit.title} className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-sm shadow-slate-100/80">
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${benefit.tone}`}>
                      <benefit.icon size={16} aria-hidden="true" />
                    </span>
                    <p className="min-w-0 text-sm font-semibold text-slate-800">{benefit.title}</p>
                  </div>
                  <p className="text-xs leading-5 text-slate-500">{benefit.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">套餐对比</h3>
              <span className="text-xs text-slate-500">当前方案与可升级能力</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {membershipPlans.map((plan) => (
                <div
                  key={plan.name}
                  className={`rounded-lg border p-4 ${
                    plan.current ? 'border-brand-200 bg-brand-50/60' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{plan.name}</p>
                      <p className="mt-1 text-xl font-semibold text-slate-950">{plan.price}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        plan.current ? 'bg-brand-600 text-white' : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {plan.badge}
                    </span>
                  </div>
                  <p className="mb-3 rounded-lg bg-white/75 px-3 py-2 text-xs font-medium text-slate-600">{plan.quota}</p>
                  <ul className="space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-2 text-xs leading-5 text-slate-600">
                        <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-700">说明</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              当前版本仅展示会员权益与 AI 设置入口，不会创建订单、扣费或调用支付接口。
            </p>
          </div>
        </div>
      </Modal>
    </aside>
  )
}
