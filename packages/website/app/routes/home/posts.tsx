import { prisma } from '@decelerator/database'
import { useAtom } from 'jotai'
import { useCallback, useEffect, useRef, useState } from 'react'
import { redirect, useFetcher, useNavigate } from 'react-router'
import AutoSizer from 'react-virtualized-auto-sizer'
import { VariableSizeList as List } from 'react-window'
import InfiniteLoader from 'react-window-infinite-loader'
import { FoodIcon } from '~/components/food-icon'
import {
  StatusCard,
  StatusCardAction,
  StatusCardContent,
  StatusCardDescription,
  StatusCardDescriptionWithTimeout,
  StatusCardTitle,
} from '~/components/masto/status-card'
import { FlushButton } from '~/components/nav/flush-button'
import { MobileSidebarTrigger } from '~/components/nav/mobile-sidebar-trigger'
import { filterMutualMode, MutualSelect } from '~/components/nav/mutual-select'
import { ScrollToTopButton } from '~/components/nav/scroll-to-top-button'
import { TimelineSortBySelect } from '~/components/nav/timeline-sort-by-select'
import { filterTimeout, TimeoutSelect } from '~/components/nav/timeout-select'
import { CardHeader } from '~/components/ui/card'
import { createAuth } from '~/lib/auth.server'
import { boostMap } from '~/lib/masto'
import { mutualModeAtom, timelineSortByAtom, timeoutAtom } from '~/stores/filter'
import type { Route } from './+types/posts'

export async function loader({ request, params }: Route.LoaderArgs) {
  const auth = await createAuth()
  const session = await auth.api.getSession(request)
  if (!session) return redirect('/')

  const { domain, mastodonId: userId } = session.user
  const app = await prisma.app.findUnique({ where: { domain } })
  if (!app) return redirect('/')

  const { searchParams } = new URL(request.url)
  const timestamp = searchParams.get('timestamp')
  const createdAt = timestamp ? { lt: new Date(timestamp) } : undefined

  const sort = params.sortBy ?? 'createdAt'
  const [data, totalCount] = await Promise.all([
    prisma.statusIndex.findMany({
      where: { domain, accountId: userId, referenced: { some: {} }, createdAt },
      orderBy: sort === 'boost' ? [{ referenced: { _count: 'desc' } }, { createdAt: 'desc' }] : { createdAt: 'desc' },
      take: 40,
      include: { referenced: { include: { reaction: true } } },
    }),
    prisma.statusIndex.count({
      where: { domain, accountId: userId, referenced: { some: {} } },
    }),
  ])
  return { data, totalCount, domain: app.domain, software: app.software, timestamp }
}

export default function HomePosts({ loaderData }: Route.ComponentProps) {
  const { data, totalCount, domain, software, timestamp } = loaderData

  const navigate = useNavigate()
  const fetcher = useFetcher<typeof loader>()

  const [statuses, setStatuses] = useState<typeof data>(data)
  useEffect(() => {
    const { data, state } = fetcher
    if (state === 'idle' && data) setStatuses((prev) => [...prev, ...data.data])
  }, [fetcher])

  // timestamp가 없다는 건 첫 로드 또는 새로고침한 경우이므로 리스트 초기화
  useEffect(() => {
    if (!timestamp) setStatuses(data)
  }, [timestamp, data])

  const isItemLoaded = useCallback((index: number) => index < statuses.length, [statuses.length])
  const loadMoreItems = useCallback(async () => {
    if (fetcher.state !== 'idle') return

    const lastStatus = statuses.at(-1)
    if (!lastStatus) return

    return await fetcher.load(`/home/posts?timestamp=${lastStatus.createdAt.toISOString()}`)
  }, [fetcher, statuses])

  const [timeout, setTimeout] = useAtom(timeoutAtom)
  const [mutualMode, setMutualMode] = useAtom(mutualModeAtom)
  const [sortBy, setSortBy] = useAtom(timelineSortByAtom)

  useEffect(() => {
    if (sortBy) navigate(`/home/posts/${sortBy}`)
  }, [sortBy, navigate])

  const listRef = useRef<List>(null)
  const infiniteLoaderRef = useRef<InfiniteLoader>(null)

  const cardsRef = useRef(new WeakMap<(typeof data)[number], HTMLElement | null>())
  const sizesRef = useRef(new WeakMap<(typeof data)[number], number>())

  const Row = ({ index, status }: { index: number; status: (typeof data)[number] }) => {
    const referenced = status.referenced.filter(
      ({ createdAt, reactedAt, fromMutual }) => filterTimeout(timeout, createdAt, reactedAt) && filterMutualMode(mutualMode, fromMutual),
    )

    useEffect(() => {
      const height = cardsRef.current.get(status)?.getBoundingClientRect().height
      if (typeof height === 'number') {
        sizesRef.current.set(status, height)
        listRef.current?.resetAfterIndex(index)
      }
    }, [status, index])

    const resize = useCallback(() => {
      const height = cardsRef.current.get(status)?.getBoundingClientRect().height
      if (typeof height === 'number') {
        sizesRef.current.set(status, height)
        listRef.current?.resetAfterIndex(index)
      }
    }, [status, index])

    return (
      <div
        key={status.statusId}
        className="pt-6 pl-6 pr-6"
        ref={(el) => {
          cardsRef.current.set(status, el)
        }}
      >
        <StatusCard status={status.data} domain={domain} software={software} resize={resize} className="border-2 border-accent-foreground">
          <CardHeader>
            <StatusCardTitle />
            <StatusCardDescription>
              {status.referenced.length > 0 && (
                <span>
                  {status.referenced.length}번 {boostMap[software]}됨
                </span>
              )}
            </StatusCardDescription>
            <StatusCardAction />
          </CardHeader>
          <StatusCardContent />
        </StatusCard>

        {referenced.length > 0 && (
          <ul className="flex flex-col items-stretch justify-center gap-4 p-6">
            {referenced.map(({ reaction, createdAt, reactedAt }) => (
              <li key={reaction.statusId}>
                <StatusCard status={reaction.data} domain={domain} software={software} resize={resize}>
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
          <TimelineSortBySelect sortBy={sortBy} setSortBy={setSortBy} />
        </nav>
        <FlushButton listRef={listRef} infiniteLoaderRef={infiniteLoaderRef} />
      </header>
      <ScrollToTopButton listRef={listRef} />
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
                  itemCount={statuses.length}
                  itemSize={(index) => sizesRef.current.get(statuses[index]) ?? 100}
                  onItemsRendered={onItemsRendered}
                >
                  {({ index, style }) => (
                    <div style={style}>
                      <Row index={index} status={statuses[index]} />
                    </div>
                  )}
                </List>
              )}
            </InfiniteLoader>
          )}
        </AutoSizer>
        {statuses.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 h-full">
            <FoodIcon className="size-10" />
            <span className="text-lg">아직 {boostMap[software]}된 게시글이 없습니다.</span>
          </div>
        )}
      </div>
    </div>
  )
}
