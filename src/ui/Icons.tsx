// 線画のアイコン。currentColor で塗る
import type { ReactNode } from 'react'
import type { MaterialType } from '../plan/types'

function Svg({ size = 24, children, label }: { size?: number; children: ReactNode; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      {children}
    </svg>
  )
}

export const CheckIcon = () => (
  <Svg size={22}>
    <path d="M5 12.5l4.5 4.5L19 7.5" strokeWidth={3} />
  </Svg>
)
export const ChevronIcon = () => (
  <Svg size={20}>
    <path d="M9 6l6 6-6 6" />
  </Svg>
)
export const CloseIcon = () => (
  <Svg>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
)
export const BackIcon = () => (
  <Svg size={20}>
    <path d="M15 6l-6 6 6 6" />
  </Svg>
)
export const ExternalIcon = () => (
  <Svg size={16}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
  </Svg>
)
export const CopyIcon = () => (
  <Svg size={18}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" />
  </Svg>
)

// ---- タブ ----
export const TodayIcon = () => (
  <Svg>
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M4 10h16M8 3v4M16 3v4M9 15l2 2 4-4" />
  </Svg>
)
export const RecordIcon = () => (
  <Svg>
    <path d="M12 21v-7M12 14c-4 0-6-2.5-6-5.5S8.5 3 12 3s6 2.5 6 5.5S16 14 12 14z" />
    <path d="M12 10l-2.5-2M12 12l3-3" />
  </Svg>
)
export const MenuIcon = () => (
  <Svg>
    <path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3V4z" />
    <path d="M5 17a3 3 0 013-3h11M9 8h6" />
  </Svg>
)
export const PlanIcon = () => (
  <Svg>
    <path d="M3 7h18M3 12h18M3 17h18" />
    <circle cx="9" cy="7" r="1.5" fill="currentColor" />
    <circle cx="15" cy="12" r="1.5" fill="currentColor" />
  </Svg>
)
export const SettingsIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
  </Svg>
)

// ---- 教材の種類 ----
const materialPaths: Record<MaterialType, ReactNode> = {
  book: <path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1V5zM12 6v14" />,
  app: (
    <>
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M11 18h2" />
    </>
  ),
  podcast: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0012 0M12 17v4M9 21h6" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="M16 10l5-3v10l-5-3" />
    </>
  ),
  youtube: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="4" />
      <path d="M10 9l5 3-5 3V9z" />
    </>
  ),
  website: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z" />
    </>
  ),
  ai: (
    <>
      <path d="M4 5h16v11H9l-5 4V5z" />
      <path d="M12 8l.8 1.7 1.7.8-1.7.8L12 13l-.8-1.7-1.7-.8 1.7-.8L12 8z" />
    </>
  ),
  lesson: (
    <>
      <circle cx="8" cy="8" r="3" />
      <circle cx="16" cy="8" r="3" />
      <path d="M3 20c0-3 2.2-5 5-5s5 2 5 5M11 20c0-3 2.2-5 5-5s5 2 5 5" />
    </>
  ),
}

const materialLabels: Record<MaterialType, string> = {
  book: '本',
  app: 'アプリ',
  podcast: 'ポッドキャスト',
  video: '動画',
  youtube: 'YouTube',
  website: 'Webサイト',
  ai: 'AI',
  lesson: 'レッスン',
}

export function MaterialIcon({ type }: { type: MaterialType }) {
  return <Svg label={materialLabels[type]}>{materialPaths[type] ?? materialPaths.website}</Svg>
}

export function materialTypeLabel(type: MaterialType): string {
  return materialLabels[type] ?? type
}
