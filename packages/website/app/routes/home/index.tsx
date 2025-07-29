import { ExternalLink, Home, Repeat2, ThumbsUp } from 'lucide-react'
import { NavLink, redirect } from 'react-router'
import { Avatar, AvatarImage } from '~/components/ui/avatar'
import { Button } from '~/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { useFlush } from '~/hooks/use-flush'
import { createAuth } from '~/lib/auth.server'
import { authClient } from '~/lib/auth-client'
import pkg from '../../../../../package.json'
import type { Route } from './+types'

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await createAuth()
  const session = await auth.api.getSession(request)
  if (!session) return redirect('/')
}

export default function HomeIndex() {
  const { data: session } = authClient.useSession()
  const { current } = useFlush()

  return (
    <div className="flex flex-col items-stretch flex-auto">
      <header className="flex items-center justify-between bg-background z-20 p-6 shadow">
        <nav className="flex items-center gap-2">
          <span className="text-2xl font-bold">{pkg.displayName}</span>
        </nav>
        <nav className="flex items-center gap-2">
          <Button onClick={() => window.open('https://github.com/chalkpe/decelerator', '_blank')}>
            <ExternalLink />
            레포지토리
          </Button>
        </nav>
      </header>
      {session && (
        <article className="flex flex-col items-center p-6 shadow gap-4">
          <div className="flex items-center gap-2">
            <Avatar className="size-12">
              <AvatarImage src={session.user.image ?? ''} alt={session.user.name} />
            </Avatar>
            <div>
              <div className="text-lg font-semibold">{session.user.name}</div>
              <div className="text-sm text-muted-foreground">
                @{session.user.username}@{session.user.domain}
              </div>
            </div>
          </div>
          <div className="w-full text-center break-keep text-balance">
            <div className="flex flex-row flex-wrap items-stretch justify-center gap-3">
              <NavLink to="/home/timeline" className="flex-auto">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      <Home className="inline" /> 반응 타임라인
                    </CardTitle>
                    <CardDescription>모든 반응을 시간순으로 확인할 수 있습니다.</CardDescription>
                  </CardHeader>
                </Card>
              </NavLink>
              <NavLink to="/home/posts" className="flex-auto">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      <Repeat2 className="inline" /> 부스트된 게시글
                    </CardTitle>
                    <CardDescription>부스트된 게시글의 반응을 각각 확인할 수 있습니다.</CardDescription>
                  </CardHeader>
                </Card>
              </NavLink>
            </div>
          </div>
          <div className="flex justify-center items-center gap-2">
            {current.length > 0 ? <ThumbsUp className="inline size-6" /> : <Repeat2 className="inline size-6 animate-spin" />}
            {current.length > 0
              ? `새 데이터가 ${current.length}건 있습니다!`
              : '처음 로그인하셨다면 데이터를 가져오는 데 시간이 걸릴 수 있습니다!'}
          </div>
        </article>
      )}
    </div>
  )
}
