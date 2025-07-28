import { taskQueue } from '@decelerator/core/constants'
import type { daemonWorkflow } from '@decelerator/core/workflows'
import { prisma } from '@decelerator/database'
import { RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { redirect, useFetcher, useRevalidator } from 'react-router'
import AutoSizer from 'react-virtualized-auto-sizer'
import { VariableSizeList as List } from 'react-window'
import {
  StatusCard,
  StatusCardAction,
  StatusCardContent,
  StatusCardDescription,
  StatusCardDescriptionWithNotification,
  StatusCardTitle,
} from '~/components/masto/status-card'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader } from '~/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { createAuth } from '~/lib/auth.server'
import { authClient } from '~/lib/auth-client'
import { temporal } from '~/lib/temporal.server'
import { cn } from '~/lib/utils'
import type { Route } from './+types/posts'

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

export default function HomePosts({ loaderData }: Route.ComponentProps) {
  const { statuses, groups } = loaderData
  const { data: session } = authClient.useSession()

  const revalidator = useRevalidator()
  const fetcher = useFetcher<typeof action>()

  const [sortBy, setSortBy] = useState('createdAt')

  const listRef = useRef<List>(null)
  const cardRefs = useRef<Record<string, HTMLElement | null>>({})
  const sizeRefs = useRef<Record<string, number>>({})

  const notifications = useMemo(
    () => fetcher.data?.notifications.flatMap(({ reaction, ...data }) => (reaction ? [{ ...data, reaction }] : [])) ?? [],
    [fetcher.data],
  )

  const posts = useMemo(
    () =>
      statuses
        .map(({ data }) => ({ data, count: groups.find((group) => group.statusId === data.id)?._count.statusId ?? 0 }))
        .sort((a, b) => {
          const boost = b.count - a.count
          const createdAt = new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime()
          return sortBy === 'boost' ? boost || createdAt : createdAt || boost
        }),
    [statuses, groups, sortBy],
  )

  useEffect(() => {
    if (fetcher.state === 'idle') {
      const statusId = fetcher.data?.statusId
      if (statusId) {
        const index = posts.findIndex(({ data }) => data.id === statusId)
        if (index !== -1) listRef.current?.scrollToItem(index, 'start')
      }
    }
  }, [fetcher, posts])

  const Row = ({ index }: { index: number }) => {
    const { data: status, count } = posts[index]
    useEffect(() => {
      const height = cardRefs.current[status.id]?.getBoundingClientRect().height
      if (height) {
        sizeRefs.current[index] = height
        listRef.current?.resetAfterIndex(index)
      }
    }, [index, status])

    return (
      <div
        key={status.id}
        className="pt-6 pl-6 pr-6"
        ref={(el) => {
          cardRefs.current[status.id] = el
        }}
      >
        <StatusCard
          status={status}
          domain={session?.user.domain}
          className={fetcher.data?.statusId === status.id ? 'border-foreground border-2' : ''}
        >
          <CardHeader>
            <StatusCardTitle />
            <StatusCardDescription>
              <span>{count}번 부스트됨</span>
              {fetcher.data?.statusId === status.id && <span>{fetcher.data.notifications.length}개의 반응</span>}
            </StatusCardDescription>
            <StatusCardAction>
              {fetcher.data?.statusId !== status.id && (
                <fetcher.Form method="post">
                  <input type="hidden" name="statusId" value={status.id} />
                  <Button type="submit" disabled={fetcher.state !== 'idle'}>
                    반응 보기
                  </Button>
                </fetcher.Form>
              )}
            </StatusCardAction>
          </CardHeader>
          <StatusCardContent />
        </StatusCard>

        {fetcher.data?.statusId === status.id && (
          <ul className="flex flex-col items-stretch justify-center gap-4 p-6">
            {notifications.map(({ data: notification, reaction, fromMutual }) => (
              <li key={notification.id}>
                <StatusCard
                  status={reaction.data}
                  domain={session?.user.domain}
                  className={cn(fromMutual ? '' : 'border-2 border-red-500')}
                >
                  <CardHeader>
                    <StatusCardTitle />
                    <StatusCardDescriptionWithNotification notification={notification} />
                    <StatusCardAction />
                  </CardHeader>
                  <StatusCardContent />
                </StatusCard>
              </li>
            ))}
            {fetcher.data.notifications.length === 0 && (
              <Card className="bg-muted">
                <CardContent>반응이 없습니다.</CardContent>
              </Card>
            )}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-stretch flex-auto">
      <header className="flex items-center justify-between bg-background z-20 p-6 shadow">
        <nav className="flex items-center gap-2">
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
      </header>

      <div className="flex-auto">
        <AutoSizer>
          {({ width, height }) => (
            <List ref={listRef} width={width} height={height} itemCount={posts.length} itemSize={(index) => sizeRefs.current[index] ?? 100}>
              {({ index, style }) => (
                <div key={index} style={style}>
                  <Row index={index} />
                </div>
              )}
            </List>
          )}
        </AutoSizer>
      </div>
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
