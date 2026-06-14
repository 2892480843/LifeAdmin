import { NavLink } from "react-router-dom";
import { Compass, LayoutDashboard, MapPin, Radio, User } from "lucide-react";

const tabs = [
  { to: "/mobile", icon: LayoutDashboard, label: "首页", end: true },
  { to: "/mobile/trips", icon: MapPin, label: "行程" },
  { to: "/mobile/explore", icon: Compass, label: "探索" },
  { to: "/mobile/realtime", icon: Radio, label: "动态" },
  { to: "/mobile/profile", icon: User, label: "我的" },
];

export default function BottomNav() {
  return (
    <nav
      className="glass-nav safe-area-pb fixed bottom-0 left-0 right-0 z-50 flex items-center gap-1 border-t border-slate-200/60 px-2 pb-1 pt-1.5 md:hidden"
      aria-label="底部导航"
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className="flex flex-1 justify-center"
          aria-label={tab.label}
        >
          {({ isActive }) => (
            <span
              className={`flex touch-press flex-col items-center gap-0.5 rounded-2xl px-2.5 py-1.5 text-[10px] font-semibold transition-all duration-200 ${
                isActive
                  ? "scale-105 bg-gradient-to-br from-brand-500 to-locate-500 text-white shadow-md shadow-brand-500/30"
                  : "text-slate-400 hover:text-slate-700"
              }`}
            >
              <tab.icon
                size={21}
                strokeWidth={isActive ? 2.6 : 1.8}
                aria-hidden="true"
              />
              <span>{tab.label}</span>
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
