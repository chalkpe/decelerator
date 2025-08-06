import { createAuth } from '~/lib/auth.server'
import pkg from '../../../../../../../../package.json'
import type { Route } from './+types/domain'

export async function loader({ request }: Route.LoaderArgs) {
  // 미스키 서버에서 앱 정보를 가져갈 수 있도록 기본값 홈페이지 리턴
  if (!new URL(request.url).searchParams.has('code')) return

  const auth = await createAuth()
  return await auth.handler(request)
}

// 체리픽 서버는 name 및 logo 프로퍼티가 없으면 오류 발생함
export default function MisskeyIntrodution({ params }: Route.ComponentProps) {
  const href = `/api/auth/oauth2/callback/${params.domain}`
  return (
    <>
      <link rel="redirect_uri" href={href} />
      <div className="h-app">
        <img className="u-logo" src="/favicon.png" alt={pkg.displayName} />
        <a href={href} className="u-url p-name">
          {pkg.displayName}
        </a>
      </div>
    </>
  )
}

export async function action({ request }: Route.ActionArgs) {
  const auth = await createAuth()
  return await auth.handler(request)
}
