import { Component, lazy, Suspense } from 'react'
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
    <AppErrorBoundary>
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
    </AppErrorBoundary>
  )
}

function PageFallback() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 text-sm font-medium text-slate-500">
      页面加载中...
    </div>
  )
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center">
          <p className="text-base font-semibold text-slate-800">页面加载失败</p>
          <p className="text-sm text-slate-500">请刷新页面重试，或返回首页继续使用。</p>
          <button
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700"
            onClick={() => { window.location.href = '/' }}
          >
            返回首页
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
