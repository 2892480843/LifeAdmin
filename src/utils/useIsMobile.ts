 import { useEffect, useState } from 'react'
 
 // 移动端断点阈值，与 App.tsx 中 (max-width: 767px) 的窄屏判定保持一致
 const MOBILE_QUERY = '(max-width: 767px)'
 
 // 判断当前是否为移动端窄屏（< 768px），响应视口变化并 SSR 安全
 export function useIsMobile() {
   const [isMobile, setIsMobile] = useState(() =>
     typeof window === 'undefined' ? false : window.matchMedia(MOBILE_QUERY).matches,
   )
 
   useEffect(() => {
     const query = window.matchMedia(MOBILE_QUERY)
     const sync = () => setIsMobile(query.matches)
     sync()
     query.addEventListener('change', sync)
     return () => query.removeEventListener('change', sync)
   }, [])
 
   return isMobile
 }
 
 // 根据视口返回对应端的目标路径：移动端走 /mobile/*，桌面走原路径
 export function mobileOrDesktopPath(mobilePath: string, desktopPath: string) {
   const isMobile =
     typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
   return isMobile ? mobilePath : desktopPath
 }
