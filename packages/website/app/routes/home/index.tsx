import { prisma } from '@decelerator/database'
import { Home, Repeat2 } from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, redirect, useRevalidator } from 'react-router'
import { MobileSidebarTrigger } from '~/components/nav/mobile-sidebar-trigger'
import { Avatar, AvatarImage } from '~/components/ui/avatar'
import { Badge } from '~/components/ui/badge'
import { Card, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { useFlush } from '~/hooks/use-flush'
import { useIsMobile } from '~/hooks/use-mobile'
import { createAuth } from '~/lib/auth.server'
import { authClient } from '~/lib/auth-client'
import { boostMap } from '~/lib/masto'
import { cn } from '~/lib/utils'
import pkg from '../../../../../package.json'
import type { Route } from './+types'

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await createAuth()
  const session = await auth.api.getSession(request)
  if (!session) return redirect('/')

  const app = await prisma.app.findUnique({ where: { domain: session.user.domain } })
  if (!app) return redirect('/')

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { _count: { select: { notifications: true } } },
  })
  if (!user) return redirect('/')

  const { domain, mastodonId: userId } = user
  const [timelineCount, postsCount] = await Promise.all([
    prisma.userReaction.count({
      where: { domain, status: { accountId: userId } },
    }),
    prisma.statusIndex.count({
      where: { domain, accountId: userId, referenced: { some: {} } },
    }),
  ])

  return { software: app.software, notificationCount: user._count.notifications, timelineCount, postsCount }
}

export default function HomeIndex({ loaderData }: Route.ComponentProps) {
  const { software, notificationCount, timelineCount, postsCount } = loaderData

  const isMobile = useIsMobile()
  const { current, flush } = useFlush()
  const revalidator = useRevalidator()
  const { data: session } = authClient.useSession()

  useEffect(() => {
    if (current.length > 0 && revalidator.state === 'idle') {
      flush()
      revalidator.revalidate()
    }
  }, [current, flush, revalidator])

  return (
    <div className="flex flex-col items-stretch flex-auto" suppressHydrationWarning>
      <header className="flex items-center justify-between bg-background z-20 p-6 shadow">
        <nav className="flex items-center gap-2">
          <MobileSidebarTrigger />
          <span className="font-bold">{pkg.displayName}</span>
        </nav>
      </header>
      {session && (
        <article className="flex flex-col items-center p-6 shadow gap-6 flex-1">
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
          {notificationCount === 0 && (
            <div className="flex flex-col justify-center items-center gap-2">
              <Repeat2 className="size-6 animate-spin" />
              <span className="text-balance break-keep text-center">
                방금 처음 로그인하셨나요?
                <br />
                데이터를 가져오는 데 조금 시간이 걸릴 수 있습니다!
              </span>
            </div>
          )}
          <div className="w-full text-center break-keep text-balance">
            <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
              <NavLink to="/home/timeline" className="flex-auto">
                <Card className="h-full relative">
                  <Badge className="absolute top-2 right-2">반응 {timelineCount.toLocaleString()}개</Badge>
                  <CardHeader>
                    <CardTitle>
                      <div className="flex flex-col items-center gap-2">
                        <Home className="inline" />
                        반응 타임라인
                      </div>
                    </CardTitle>
                    <CardDescription className="mt-1">모든 반응을 시간순으로 확인할 수 있습니다.</CardDescription>
                  </CardHeader>
                </Card>
              </NavLink>
              <NavLink to="/home/posts" className="flex-auto">
                <Card className="h-full relative">
                  <Badge className="absolute top-2 right-2">게시글 {postsCount.toLocaleString()}개</Badge>
                  <CardHeader>
                    <CardTitle>
                      <div className="flex flex-col items-center gap-2">
                        <Repeat2 className="inline" />
                        {boostMap[software]}된 게시글
                      </div>
                    </CardTitle>
                    <CardDescription className="mt-1">{boostMap[software]}된 게시글의 반응을 각각 확인할 수 있습니다.</CardDescription>
                  </CardHeader>
                </Card>
              </NavLink>
            </div>
          </div>
        </article>
      )}
      <footer className="p-6 bg-muted text-sm text-muted-foreground text-center flex flex-row items-center justify-center gap-4">
        <a href={pkg.author.url} target="_blank" rel="noopener" className="underline underline-offset-4 hover:text-primary">
          &copy; {new Date().getFullYear()} {pkg.author.name}
        </a>
        <a href={pkg.repository.url} target="_blank" rel="noopener" className="underline underline-offset-4 hover:text-primary">
          레포지토리
        </a>
      </footer>
    </div>
  )
}
