import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useApp } from './store/AppContext'
import type { ReactNode } from 'react'

const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const NewTrip = lazy(() => import('./pages/newtrip/NewTrip'))
const Explore = lazy(() => import('./pages/Explore'))
const PoiDetail = lazy(() => import('./pages/PoiDetail'))
const Trips = lazy(() => import('./pages/Trips'))
const TripOverview = lazy(() => import('./pages/TripOverview'))
const TripDetail = lazy(() => import('./pages/TripDetail'))
const Realtime = lazy(() => import('./pages/Realtime'))
const Profile = lazy(() => import('./pages/Profile'))
const Settings = lazy(() => import('./pages/Settings'))

// 登录守卫
function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthed } = useApp()
  if (!isAuthed) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const { isAuthed } = useApp()

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={isAuthed ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/" element={<Navigate to={isAuthed ? '/dashboard' : '/login'} replace />} />

        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/new-trip" element={<RequireAuth><NewTrip /></RequireAuth>} />
        <Route path="/explore" element={<RequireAuth><Explore /></RequireAuth>} />
        <Route path="/poi/:id" element={<RequireAuth><PoiDetail /></RequireAuth>} />
        <Route path="/trips" element={<RequireAuth><Trips /></RequireAuth>} />
        <Route path="/trips/:id" element={<RequireAuth><TripOverview /></RequireAuth>} />
        <Route path="/trip/:id" element={<RequireAuth><TripOverview /></RequireAuth>} />
        <Route path="/trip/:id/detail" element={<RequireAuth><TripDetail /></RequireAuth>} />
        <Route path="/realtime" element={<RequireAuth><Realtime /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

function PageFallback() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 text-sm font-medium text-slate-500">
      页面加载中...
    </div>
  )
}
