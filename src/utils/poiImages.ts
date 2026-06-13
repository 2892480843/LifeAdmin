import type { PoiImageConfidence } from '../types'

const PLACEHOLDER_IMAGE_RE =
  /(?:picsum\.photos|placehold\.co|placeholder\.com|dummyimage\.com|loremflickr\.com|source\.unsplash\.com\/random)/i

export function isKnownPlaceholderImage(src: string | undefined) {
  return PLACEHOLDER_IMAGE_RE.test(String(src || ''))
}

export function isUsablePlaceImage(src: string | undefined, confidence?: PoiImageConfidence) {
  const value = String(src || '').trim()
  if (!value) return false
  if (confidence === 'pending-review' || confidence === 'unverified') return false
  if (isKnownPlaceholderImage(value)) return false
  return /^(https?:\/\/|\/|data:image\/)/i.test(value)
}

export function displayPlaceImage(src: string | undefined, confidence?: PoiImageConfidence) {
  const value = String(src || '').trim()
  return isUsablePlaceImage(value, confidence) ? value : ''
}

export function hasPendingPlaceImageReview(
  src: string | undefined,
  confidence?: PoiImageConfidence,
  pendingReview?: boolean,
) {
  return Boolean(pendingReview) || !isUsablePlaceImage(src, confidence)
}
