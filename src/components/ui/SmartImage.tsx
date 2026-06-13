import { useEffect, useRef, useState } from 'react'

interface SmartImageProps {
  src: string
  alt: string
  className?: string
  // 加载失败时显示的占位文字（通常为名称首字）
  fallbackText?: string
  // 首屏关键图片可主动 eager，其余默认 lazy
  eager?: boolean
  loading?: 'lazy' | 'eager'
}

// 图片组件：加载中显示骨架占位，加载失败时回退为品牌渐变占位块，避免白块与破图
export default function SmartImage({
  src,
  alt,
  className,
  fallbackText,
  eager = false,
  loading = 'lazy',
}: SmartImageProps) {
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(!src)

  useEffect(() => {
    setLoaded(false)
    setError(!src)
  }, [src])

  useEffect(() => {
    if (!src || error) return

    const image = imageRef.current
    if (!image?.complete) return

    if (image.naturalWidth > 0) {
      setLoaded(true)
      setError(false)
    } else {
      setLoaded(false)
      setError(true)
    }
  }, [src, error])

  const handleLoad = () => {
    setLoaded(true)
    setError(false)
  }

  const imageLoading = eager ? 'eager' : loading
  const isLoading = !loaded && !error

  return (
    <span
      className={`relative block overflow-hidden bg-slate-100 ${className ?? ''}`}
      aria-busy={isLoading}
      aria-label={error ? alt : undefined}
    >
      {(isLoading || error) && (
        <span
          className={`absolute inset-0 flex items-center justify-center ${
            error
              ? 'bg-gradient-to-br from-brand-400 to-brand-600 text-white'
              : 'animate-pulse bg-gradient-to-br from-slate-100 via-slate-50 to-brand-50 text-slate-300'
          }`}
        >
          <span className="px-2 text-center text-sm font-semibold opacity-90">{fallbackText ?? alt.slice(0, 2)}</span>
        </span>
      )}
      {src && !error && (
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          loading={imageLoading}
          decoding={eager ? 'sync' : 'async'}
          onLoad={handleLoad}
          onError={() => {
            setLoaded(false)
            setError(true)
          }}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </span>
  )
}
