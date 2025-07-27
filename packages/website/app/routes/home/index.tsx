import { taskQueue } from '@decelerator/core/constants'
import type { daemonWorkflow } from '@decelerator/core/workflows'
import { prisma } from '@decelerator/database'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { redirect, useFetcher, useRevalidator } from 'react-router'
import sanitize from 'sanitize-html'
import { Avatar, AvatarImage } from '~/components/ui/avatar'
import { Button } from '~/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { createAuth } from '~/lib/auth.server'
import { temporal } from '~/lib/temporal.server'
import { getAbbreviatedTime, getFullTime } from '~/lib/utils'
import type { Route } from './+types/index'

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await createAuth()
  const session = await auth.api.getSession(request)
  if (!session) return redirect('/')

  await temporal.workflow.start<typeof daemonWorkflow>('daemonWorkflow', {
    taskQueue,
    workflowId: `daemon-${session.user.domain}`,
    workflowIdConflictPolicy: 'USE_EXISTING',
    args: [{ domain: session.user.domain }],
  })

  const groups = await prisma.reblogNotification.groupBy({
    by: ['statusId'],
    where: { userId: session.user.mastodonId, domain: session.user.domain, reactionId: { not: null } },
    _count: { statusId: true },
    orderBy: { _count: { statusId: 'desc' } },
  })

  const statuses = await prisma.statusIndex.findMany({
    where: { statusId: { in: groups.map((group) => group.statusId) } },
    select: { data: true },
  })

  return { statuses, groups }
}

export default function HomeIndex({ loaderData }: Route.ComponentProps) {
  const { statuses, groups } = loaderData

  const revalidator = useRevalidator()
  const fetcher = useFetcher<typeof action>()

  const [sortBy, setSortBy] = useState('createdAt')
  const cardRefs = useRef<Record<string, HTMLElement | null>>({})

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.statusId) {
      cardRefs.current[fetcher.data.statusId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [fetcher])

  return (
    <div className="flex flex-col items-stretch">
      <nav className="flex items-center justify-start gap-2 sticky top-0 bg-background z-20 p-6 shadow">
        <Button onClick={() => revalidator.revalidate()} disabled={revalidator.state !== 'idle'}>
          <RefreshCw />
          <span>새로고침</span>
        </Button>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="정렬" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt">최신순</SelectItem>
            <SelectItem value="boost">인기순</SelectItem>
          </SelectContent>
        </Select>
      </nav>

      <ul className="w-full flex flex-col items-stretch justify-center gap-6 p-6">
        {statuses
          .map(({ data }) => ({ data, count: groups.find((group) => group.statusId === data.id)?._count.statusId ?? 0 }))
          .sort((a, b) => {
            const boost = b.count - a.count
            const createdAt = new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime()
            return sortBy === 'boost' ? boost || createdAt : createdAt || boost
          })
          .map(({ data: status, count }) => (
            <li
              key={status.id}
              ref={(el) => {
                cardRefs.current[status.id] = el
              }}
              className="scroll-mt-28"
            >
              <Card className={fetcher.data?.statusId === status.id ? 'sticky top-27 z-10 border-foreground border-2' : ''}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Avatar>
                      <AvatarImage src={status.account.avatar} alt={status.account.displayName} />
                    </Avatar>
                    {status.account.displayName}
                  </CardTitle>

                  <CardDescription>
                    {getAbbreviatedTime(new Date(status.createdAt))} 작성함 · {count}번 부스트됨
                    {fetcher.data?.statusId === status.id && ` · ${fetcher.data.notifications.length}개의 반응`}
                  </CardDescription>
                  <CardAction className="flex items-center gap-2">
                    {status.url && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (!status.url) return
                          open(status.url, '_blank', 'noopener,noreferrer')
                        }}
                      >
                        <ExternalLink />
                      </Button>
                    )}
                    {fetcher.data?.statusId !== status.id && (
                      <fetcher.Form method="post">
                        <input type="hidden" name="statusId" value={status.id} />
                        <Button type="submit" disabled={fetcher.state !== 'idle'}>
                          반응 보기
                        </Button>
                      </fetcher.Form>
                    )}
                  </CardAction>
                </CardHeader>
                <CardContent>
                  {/** biome-ignore lint/security/noDangerouslySetInnerHtml: safe */}
                  <p dangerouslySetInnerHTML={{ __html: sanitize(status.content) }} />
                </CardContent>
              </Card>

              {fetcher.data?.statusId === status.id && (
                <ul className="flex flex-col items-stretch justify-center gap-4 p-6">
                  {fetcher.data.notifications.map(({ data: notification, reaction }) => (
                    <li key={notification.id}>
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Avatar>
                              <AvatarImage src={notification.account.avatar} alt={notification.account.displayName} />
                            </Avatar>
                            {notification.account.displayName}
                          </CardTitle>
                          <CardDescription>
                            {getAbbreviatedTime(new Date(notification.createdAt))} 부스트함
                            {reaction && ` · ${getFullTime(new Date(notification.createdAt), new Date(reaction.createdAt))} 작성함`}
                          </CardDescription>
                          {reaction?.data.url && (
                            <CardAction>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  if (!reaction.data.url) return
                                  open(reaction.data.url, '_blank', 'noopener,noreferrer')
                                }}
                              >
                                <ExternalLink />
                              </Button>
                            </CardAction>
                          )}
                        </CardHeader>
                        <CardContent className="flex flex-col gap-6">
                          {reaction && (
                            <p
                              /** biome-ignore lint/security/noDangerouslySetInnerHtml: safe */
                              dangerouslySetInnerHTML={{ __html: sanitize(reaction.data.reblog?.content || reaction.data.content) }}
                            />
                          )}
                        </CardContent>
                      </Card>
                    </li>
                  ))}
                  {fetcher.data.notifications.length === 0 && (
                    <Card className="bg-muted">
                      <CardContent>반응이 없습니다.</CardContent>
                    </Card>
                  )}
                </ul>
              )}
            </li>
          ))}
      </ul>
    </div>
  )
}

export async function action({ request }: Route.ActionArgs) {
  const auth = await createAuth()
  const session = await auth.api.getSession(request)
  if (!session) return null

  const formData = await request.formData()
  const statusId = formData.get('statusId')?.toString()
  if (typeof statusId !== 'string') return null

  const notifications = await prisma.reblogNotification.findMany({
    where: { userId: session.user.mastodonId, domain: session.user.domain, statusId, reactionId: { not: null } },
    orderBy: { createdAt: 'asc' },
    include: { reaction: true },
  })

  return {
    statusId,
    notifications: notifications.filter(
      (n) => n.reaction && n.reaction.createdAt.getTime() - n.createdAt.getTime() < 1000 * 60 * 2, // 2분 이내에 작성된 반응만 필터링
    ),
  }
}
