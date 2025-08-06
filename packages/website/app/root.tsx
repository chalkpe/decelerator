import './app.css'

import { useAtomValue } from 'jotai'
import { useEffect, useMemo, useState } from 'react'
import { isRouteErrorResponse, Links, NavLink, Outlet, Scripts, ScrollRestoration } from 'react-router'
import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils'
import { themeAtom } from '~/stores/appearance'
import pkg from '../../../package.json'
import type { Route } from './+types/root'

export const links: Route.LinksFunction = () => [
  { rel: 'manifest', href: '/manifest.json' },
  { rel: 'icon', href: '/favicon.png' },
  { rel: 'apple-touch-icon', href: '/favicon.png' },
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
  { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@500;700&display=swap' },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const theme = useAtomValue(themeAtom)
  const [prefersDark, setPrefersDark] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')

    setPrefersDark(query.matches)
    const handleChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches)

    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  const dark = useMemo(() => theme === 'dark' || (theme === 'system' && prefersDark), [theme, prefersDark])

  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        <title>{pkg.displayName}</title>
        <meta name="description" content={pkg.description} />
        <meta name="fediverse:creator" content="@chalk@chalk.moe" />

        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        <meta name="twitter:image:src" content={`${import.meta.env.VITE_REDIRECT_URL}/card.png`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pkg.displayName} />
        <meta name="twitter:description" content={pkg.description} />

        <meta property="og:image" content={`${import.meta.env.VITE_REDIRECT_URL}/card.png`} />
        <meta property="og:image:alt" content={pkg.displayName} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={pkg.displayName} />
        <meta property="og:site_name" content={pkg.displayName} />
        <meta property="og:url" content={import.meta.env.VITE_REDIRECT_URL} />
        <meta property="og:description" content={pkg.description} />

        <Links />
      </head>
      <body className={cn({ dark })}>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Outlet />
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = '에러가 발생했어요.'
  let details = '알 수 없는 에러가 발생했습니다.'
  let stack: string | undefined

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : '에러'
    details = error.status === 404 ? '요청한 페이지를 찾을 수 없습니다.' : error.statusText || details
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message
    stack = error.stack
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}

      <NavLink to="/">
        <Button size="lg" className="mt-4">
          홈으로 돌아가기
        </Button>
      </NavLink>
    </main>
  )
}
