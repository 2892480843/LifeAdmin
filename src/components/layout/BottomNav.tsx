import { NavLink } from 'react-router-dom'
import { Compass, LayoutDashboard, MapPin, Radio, User } from 'lucide-react'

const tabs = [
  { to: '/dashboard', icon: LayoutDashboard, label: '首页' },
  { to: '/trips', icon: MapPin, label: '行程' },
  { to: '/explore', icon: Compass, label: '探索' },
  { to: '/realtime', icon: Radio, label: '动态' },
  { to: '/profile', icon: User, label: '我的' },
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
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold transition-colors ${
              isActive ? 'text-brand-600' : 'text-slate-400 hover:text-slate-700'
            }`
          }
          aria-label={tab.label}
        >
          {({ isActive }) => (
            <>
              <tab.icon
                size={22}
                strokeWidth={isActive ? 2.5 : 2}
                className={isActive ? 'text-brand-600' : ''}
                aria-hidden="true"
              />
              <span>{tab.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
