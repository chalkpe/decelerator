import { prisma } from '@decelerator/database'
import { RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { redirect, useRevalidator } from 'react-router'
import AutoSizer from 'react-virtualized-auto-sizer'
import { VariableSizeList as List } from 'react-window'
import { type MutualMode, MutualSelect } from '~/components/masto/mutual-select'
import {
  StatusCard,
  StatusCardAction,
  StatusCardContent,
  StatusCardDescription,
  StatusCardDescriptionWithTimeout,
  StatusCardTitle,
} from '~/components/masto/status-card'
import { TimeoutSelect } from '~/components/masto/timeout-select'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader } from '~/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { useFlush } from '~/hooks/use-flush'
import { createAuth } from '~/lib/auth.server'
import { cn } from '~/lib/utils'
import type { Route } from './+types/posts'

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await createAuth()
  const session = await auth.api.getSession(request)
  if (!session) return redirect('/')

  const { domain, mastodonId: userId } = session.user
  const statuses = await prisma.statusIndex.findMany({
    where: { domain, accountId: userId, referenced: { some: {} } },
    orderBy: { createdAt: 'desc' },
    take: 40,
    include: {
      notifications: true,
      referenced: { include: { reaction: true } },
    },
  })

  return { statuses }
}

export default function HomePosts({ loaderData }: Route.ComponentProps) {
  const { statuses } = loaderData

  const revalidator = useRevalidator()
  const { prev, current, flush } = useFlush()

  const [sortBy, setSortBy] = useState('createdAt')
  const [timeout, setTimeout] = useState(1000 * 60 * 2)
  const [mutualMode, setMutualMode] = useState<MutualMode>('mutual')

  const listRef = useRef<List>(null)
  const cardsRef = useRef<Record<string, HTMLElement | null>>({})
  const sizesRef = useRef<Record<string, number>>({})

  const posts = useMemo(
    () =>
      statuses.sort((a, b) => {
        const boost = b.referenced.length - a.referenced.length
        const createdAt = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        return sortBy === 'boost' ? boost || createdAt : createdAt || boost
      }),
    [statuses, sortBy],
  )

  // useEffect(() => {
  //   if (fetcher.state === 'idle') {
  //     const statusId = fetcher.data?.statusId
  //     if (statusId) {
  //       const index = posts.findIndex(({ data }) => data.id === statusId)
  //       if (index !== -1) listRef.current?.scrollToItem(index, 'start')
  //     }
  //   }
  // }, [fetcher, posts])

  const Row = ({ index }: { index: number }) => {
    const status = posts[index]

    const referenced = status.referenced.filter(
      ({ createdAt, reactedAt, fromMutual }) =>
        reactedAt.getTime() - createdAt.getTime() <= timeout &&
        (mutualMode === 'all' || (mutualMode === 'foreigner' && !fromMutual) || (mutualMode === 'mutual' && fromMutual)),
    )

    useEffect(() => {
      const height = cardsRef.current[status.statusId]?.getBoundingClientRect().height
      if (height) {
        sizesRef.current[index] = height
        listRef.current?.resetAfterIndex(index)
      }
    }, [index, status])

    return (
      <div
        key={status.statusId}
        className="pt-6 pl-6 pr-6"
        ref={(el) => {
          cardsRef.current[status.statusId] = el
        }}
      >
        <StatusCard status={status.data} domain={status.domain}>
          <CardHeader>
            <StatusCardTitle />
            <StatusCardDescription>
              <span>{status.notifications.length}번 부스트됨</span>
              <span>{status.referenced.length}개의 반응</span>
            </StatusCardDescription>
            <StatusCardAction />
          </CardHeader>
          <StatusCardContent />
        </StatusCard>

        <ul className="flex flex-col items-stretch justify-center gap-4 p-6">
          {referenced.map(({ reaction, createdAt, reactedAt }) => (
            <li key={reaction.statusId}>
              <StatusCard status={reaction.data} domain={status.domain}>
                <CardHeader>
                  <StatusCardTitle />
                  <StatusCardDescriptionWithTimeout timeout={[createdAt, reactedAt]} />
                  <StatusCardAction />
                </CardHeader>
                <StatusCardContent />
              </StatusCard>
            </li>
          ))}
          {referenced.length === 0 && (
            <Card className="bg-muted">
              <CardContent>반응이 없습니다.</CardContent>
            </Card>
          )}
        </ul>
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
        <Button
          onClick={() => {
            flush()
            revalidator.revalidate()
          }}
          disabled={revalidator.state !== 'idle'}
          className={cn(current.length > 0 && 'animate-pulse')}
        >
          <RefreshCw />
          {current.length > 0 ? <span>새로고침 (+{current.length})</span> : <span>새로고침</span>}
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
