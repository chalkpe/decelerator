import { prisma } from '@decelerator/database'
import { RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { redirect, useFetcher, useRevalidator } from 'react-router'
import AutoSizer from 'react-virtualized-auto-sizer'
import { VariableSizeList as List } from 'react-window'
import { type MutualMode, MutualSelect } from '~/components/masto/mutual-select'
import {
  StatusCard,
  StatusCardAction,
  StatusCardContent,
  StatusCardDescription,
  StatusCardDescriptionWithNotification,
  StatusCardTitle,
} from '~/components/masto/status-card'
import { TimeoutSelect } from '~/components/masto/timeout-select'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader } from '~/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { createAuth } from '~/lib/auth.server'
import { authClient } from '~/lib/auth-client'
import type { Route } from './+types/posts'

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await createAuth()
  const session = await auth.api.getSession(request)
  if (!session) return redirect('/')

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
  const [timeout, setTimeout] = useState(1000 * 60 * 2)
  const [mutualMode, setMutualMode] = useState<MutualMode>('mutual')

  const listRef = useRef<List>(null)
  const cardsRef = useRef<Record<string, HTMLElement | null>>({})
  const sizesRef = useRef<Record<string, number>>({})

  const notifications = useMemo(
    () =>
      fetcher.data?.notifications
        .flatMap(({ reaction, ...data }) => (reaction ? [{ ...data, reaction }] : []))
        .filter(
          ({ reaction, createdAt, fromMutual }) =>
            reaction.createdAt.getTime() - createdAt.getTime() <= timeout &&
            (mutualMode === 'all' || (mutualMode === 'foreigner' && !fromMutual) || (mutualMode === 'mutual' && fromMutual)),
        ) ?? [],
    [fetcher.data, mutualMode, timeout],
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
      const height = cardsRef.current[status.id]?.getBoundingClientRect().height
      if (height) {
        sizesRef.current[index] = height
        listRef.current?.resetAfterIndex(index)
      }
    }, [index, status])

    return (
      <div
        key={status.id}
        className="pt-6 pl-6 pr-6"
        ref={(el) => {
          cardsRef.current[status.id] = el
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
              {fetcher.data?.statusId === status.id && <span>{notifications.length}개의 반응</span>}
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
            {notifications.map(({ data: notification, reaction }) => (
              <li key={notification.id}>
                <StatusCard status={reaction.data} domain={session?.user.domain}>
                  <CardHeader>
                    <StatusCardTitle />
                    <StatusCardDescriptionWithNotification notification={notification} />
                    <StatusCardAction />
                  </CardHeader>
                  <StatusCardContent />
                </StatusCard>
              </li>
            ))}
            {notifications.length === 0 && (
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
          <MutualSelect mutualMode={mutualMode} setMutualMode={setMutualMode} />
          <TimeoutSelect timeout={timeout} setTimeout={setTimeout} />
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger>
              <SelectValue placeholder="정렬" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">최신순</SelectItem>
              <SelectItem value="boost">인기순</SelectItem>
            </SelectContent>
          </Select>
        </nav>
        <Button onClick={() => revalidator.revalidate()} disabled={revalidator.state !== 'idle'}>
          <RefreshCw />
          <span>새로고침</span>
        </Button>
      </header>
      <div className="flex-auto">
        <AutoSizer>
          {({ width, height }) => (
            <List ref={listRef} width={width} height={height} itemCount={posts.length} itemSize={(index) => sizesRef.current[index] ?? 100}>
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
    notifications: notifications.flatMap(({ reaction, ...data }) => (reaction ? [{ ...data, reaction }] : [])),
  }
}
