import { useCallback, useState } from 'react'

type Theme = 'light' | 'dark'
const KEY = 'loupe-theme'

function currentTheme(): Theme {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
    ? 'dark'
    : 'light'
}

// Theme is applied to <html> before paint by an inline script (index.html); this hook just
// reads + flips it, persists the choice, and keeps the mobile theme-color meta in sync.
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(currentTheme)

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      document.documentElement.classList.toggle('dark', next === 'dark')
      try {
        localStorage.setItem(KEY, next)
      } catch {
        // ignore storage failures (private mode, etc.)
      }
      // read the now-applied --color-bg so the meta tag tracks the theme token, not a copy of it
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim()
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', bg || (next === 'dark' ? '#15141a' : '#fbfaf7'))
      return next
    })
  }, [])

  return { theme, toggle }
}
