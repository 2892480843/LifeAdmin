import { NavLink } from 'react-router-dom'
import { Compass, LayoutDashboard, MapPin, Radio, User } from 'lucide-react'

const tabs = [
  { to: '/mobile', icon: LayoutDashboard, label: '首页', end: true },
  { to: '/mobile/trips', icon: MapPin, label: '行程' },
  { to: '/mobile/explore', icon: Compass, label: '探索' },
  { to: '/mobile/realtime', icon: Radio, label: '动态' },
  { to: '/mobile/profile', icon: User, label: '我的' },
]

export default function BottomNav() {
  return (
    <nav
      className="safe-area-pb fixed bottom-0 left-0 right-0 z-50 flex border-t border-slate-200 bg-white/95 backdrop-blur md:hidden"
      aria-label="底部导航"
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className="flex flex-1 flex-col items-center py-1.5"
          aria-label={tab.label}
        >
          {({ isActive }) => (
            <span className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-semibold transition-all ${
              isActive
                ? 'bg-brand-50 text-brand-600'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}>
              <tab.icon
                size={21}
                strokeWidth={isActive ? 2.5 : 1.8}
                aria-hidden="true"
              />
              <span>{tab.label}</span>
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
