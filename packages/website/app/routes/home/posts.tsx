import { prisma } from '@decelerator/database'
import { useAtom } from 'jotai/react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { redirect, useFetcher } from 'react-router'
import AutoSizer from 'react-virtualized-auto-sizer'
import { VariableSizeList as List } from 'react-window'
import InfiniteLoader from 'react-window-infinite-loader'
import { FlushButton } from '~/components/masto/flush-button'
import { MutualSelect } from '~/components/masto/mutual-select'
import {
  StatusCard,
  StatusCardAction,
  StatusCardContent,
  StatusCardDescription,
  StatusCardDescriptionWithTimeout,
  StatusCardTitle,
} from '~/components/masto/status-card'
import { TimeoutSelect } from '~/components/masto/timeout-select'
import { MobileSidebarTrigger } from '~/components/mobile-sidebar-trigger'
import { CardHeader } from '~/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { createAuth } from '~/lib/auth.server'
import { mutualModeAtom, type TimelineSortBy, timelineSortByAtom, timeoutAtom } from '~/stores/filter'
import type { Route } from './+types/posts'

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await createAuth()
  const session = await auth.api.getSession(request)
  if (!session) return redirect('/')

  const { domain, mastodonId: userId } = session.user
  const app = await prisma.app.findUnique({ where: { domain } })
  if (!app) return redirect('/')

  const { searchParams } = new URL(request.url)
  const timestamp = searchParams.get('timestamp')
  const createdAt = timestamp ? { lt: new Date(timestamp) } : undefined

  const [statuses, totalCount] = await Promise.all([
    prisma.statusIndex.findMany({
      where: { domain, accountId: userId, referenced: { some: {} }, createdAt },
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: { referenced: { include: { reaction: true } } },
    }),
    prisma.statusIndex.count({
      where: { domain, accountId: userId, referenced: { some: {} } },
    }),
  ])
  return { statuses, totalCount, domain: app.domain, software: app.software }
}

export default function HomePosts({ loaderData }: Route.ComponentProps) {
  const { statuses, totalCount, domain, software } = loaderData

  const fetcher = useFetcher<typeof loader>()
  const isItemLoaded = useCallback((index: number) => index < statuses.length, [statuses.length])
  const loadMoreItems = useCallback(() => {
    if (fetcher.state !== 'idle') return

    const lastStatus = statuses.at(-1)
    if (!lastStatus) return

    return fetcher.load(`/home/posts?timestamp=${lastStatus.createdAt.toISOString()}`)
  }, [fetcher, statuses])

  const [sortBy, setSortBy] = useAtom(timelineSortByAtom)
  const [timeout, setTimeout] = useAtom(timeoutAtom)
  const [mutualMode, setMutualMode] = useAtom(mutualModeAtom)

  const listRef = useRef<List>(null)
  const infiniteLoaderRef = useRef<InfiniteLoader>(null)

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
        <StatusCard status={status.data} domain={domain} software={software} className="border-2 border-accent-foreground">
          <CardHeader>
            <StatusCardTitle />
            <StatusCardDescription>
              {referenced.length > 0 ? <span>{referenced.length}개의 반응</span> : <span>반응 없음</span>}
            </StatusCardDescription>
            <StatusCardAction />
          </CardHeader>
          <StatusCardContent />
        </StatusCard>

        {referenced.length > 0 && (
          <ul className="flex flex-col items-stretch justify-center gap-4 p-6">
            {referenced.map(({ reaction, createdAt, reactedAt }) => (
              <li key={reaction.statusId}>
                <StatusCard status={reaction.data} domain={domain} software={software}>
                  <CardHeader>
                    <StatusCardTitle />
                    <StatusCardDescriptionWithTimeout timeout={[createdAt, reactedAt]} />
                    <StatusCardAction />
                  </CardHeader>
                  <StatusCardContent />
                </StatusCard>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-stretch flex-auto">
      <header className="flex items-center justify-between bg-background z-20 p-6 shadow">
        <nav className="flex items-center gap-2">
          <MobileSidebarTrigger />
          <MutualSelect mutualMode={mutualMode} setMutualMode={setMutualMode} />
          <TimeoutSelect timeout={timeout} setTimeout={setTimeout} software={software} />
          <Select value={sortBy} onValueChange={(s) => setSortBy(s as TimelineSortBy)}>
            <SelectTrigger>
              <SelectValue placeholder="정렬" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">최신순</SelectItem>
              <SelectItem value="boost">인기순</SelectItem>
            </SelectContent>
          </Select>
        </nav>
        <FlushButton infiniteLoaderRef={infiniteLoaderRef} />
      </header>
      <div className="flex-auto">
        <AutoSizer>
          {({ width, height }) => (
            <InfiniteLoader ref={infiniteLoaderRef} isItemLoaded={isItemLoaded} itemCount={totalCount} loadMoreItems={loadMoreItems}>
              {({ onItemsRendered, ref }) => (
                <List
                  ref={(el) => {
                    listRef.current = el
                    ref(el)
                  }}
                  width={width}
                  height={height}
                  itemCount={posts.length}
                  itemSize={(index) => sizesRef.current[index] ?? 100}
                  onItemsRendered={onItemsRendered}
                >
                  {({ index, style }) => (
                    <div key={index} style={style}>
                      <Row index={index} />
                    </div>
                  )}
                </List>
              )}
            </InfiniteLoader>
          )}
        </AutoSizer>
      </div>
    </div>
  )
}
