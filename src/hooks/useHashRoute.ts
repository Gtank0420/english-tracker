import { useEffect, useState } from 'react'

/** "#/menu/m3" → ["menu", "m3"]。GitHub Pages で再読み込みしても壊れないよう hash で画面を切り替える */
function parse(): string[] {
  return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
}

export function useHashRoute(): string[] {
  const [route, setRoute] = useState(parse)
  useEffect(() => {
    const onChange = () => setRoute(parse())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export function navigate(path: string) {
  location.hash = `#/${path}`
}

/** 履歴を増やさずに画面を切り替える */
export function replaceRoute(path: string) {
  history.replaceState(history.state, '', `#/${path}`)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}
