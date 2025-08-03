import { prisma } from '@decelerator/database'
import { useAtom } from 'jotai'
import { useCallback, useEffect, useRef, useState } from 'react'
import { redirect, useFetcher } from 'react-router'
import AutoSizer from 'react-virtualized-auto-sizer'
import { VariableSizeList as List } from 'react-window'
import InfiniteLoader from 'react-window-infinite-loader'
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
import { filterTimeout, TimeoutSelect } from '~/components/nav/timeout-select'
import { CardHeader } from '~/components/ui/card'
import { createAuth } from '~/lib/auth.server'
import { mutualModeAtom, timeoutAtom } from '~/stores/filter'
import type { Route } from './+types/timeline'

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

  const [data, totalCount] = await Promise.all([
    prisma.userReaction.findMany({
      where: { domain, status: { accountId: userId }, createdAt },
      orderBy: { createdAt: 'desc' },
      include: { status: true, reaction: true },
      take: 40,
    }),
    prisma.userReaction.count({
      where: { domain, status: { accountId: userId } },
    }),
  ])

  return {
    data,
    totalCount,
    domain: app.domain,
    software: app.software,
    timestamp,
  }
}

export default function HomeTimeline({ loaderData }: Route.ComponentProps) {
  const { data, totalCount, domain, software, timestamp } = loaderData
  const fetcher = useFetcher<typeof loader>()

  const [userReactions, setUserReactions] = useState<typeof data>(data)
  useEffect(() => {
    const { data, state } = fetcher
    if (state === 'idle' && data) setUserReactions((prev) => [...prev, ...data.data])
  }, [fetcher])

  // timestamp가 없다는 건 첫 로드 또는 새로고침한 경우이므로 리스트 초기화
  useEffect(() => {
    if (!timestamp) setUserReactions(data)
  }, [timestamp, data])

  const isItemLoaded = useCallback((index: number) => index < userReactions.length, [userReactions.length])
  const loadMoreItems = useCallback(async () => {
    if (fetcher.state !== 'idle') return

    const lastNotification = userReactions.at(-1)
    if (!lastNotification) return

    return await fetcher.load(`/home/timeline?timestamp=${lastNotification.createdAt.toISOString()}`)
  }, [fetcher, userReactions])

  const [mutualMode, setMutualMode] = useAtom(mutualModeAtom)
  const [timeout, setTimeout] = useAtom(timeoutAtom)

  const listRef = useRef<List>(null)
  const infiniteLoaderRef = useRef<InfiniteLoader>(null)

  const cardsRef = useRef(new WeakMap<(typeof data)[number], HTMLElement | null>())
  const sizesRef = useRef(new WeakMap<(typeof data)[number], number>())

  const Row = ({ index, userReaction }: { index: number; userReaction: (typeof data)[number] }) => {
    const { createdAt, reactedAt, notificationId, status, reaction, fromMutual } = userReaction

    useEffect(() => {
      const height = cardsRef.current.get(userReaction)?.getBoundingClientRect().height
      if (typeof height === 'number') {
        sizesRef.current.set(userReaction, height)
        listRef.current?.resetAfterIndex(index)
      }
    }, [index, userReaction])

    const resize = useCallback(() => {
      const height = cardsRef.current.get(userReaction)?.getBoundingClientRect().height
      if (typeof height === 'number') {
        sizesRef.current.set(userReaction, height)
        listRef.current?.resetAfterIndex(index)
      }
    }, [index, userReaction])

    if (!filterTimeout(timeout, createdAt, reactedAt) || !filterMutualMode(mutualMode, fromMutual)) {
      return (
        <div
          ref={(el) => {
            cardsRef.current.set(userReaction, el)
          }}
        />
      )
    }

    return (
      <div
        className="pl-6 pr-6 pt-6"
        ref={(el) => {
          cardsRef.current.set(userReaction, el)
        }}
      >
        <StatusCard key={notificationId} status={reaction.data} domain={domain} software={software} resize={resize}>
          <CardHeader>
            <StatusCardTitle />
            <StatusCardDescriptionWithTimeout timeout={[createdAt, reactedAt]} />
            <StatusCardAction />
          </CardHeader>
          <StatusCardContent>
            <StatusCard status={status.data} domain={domain} software={software} resize={resize}>
              <CardHeader>
                <StatusCardTitle />
                <StatusCardDescription />
                <StatusCardAction />
              </CardHeader>
              <StatusCardContent />
            </StatusCard>
          </StatusCardContent>
        </StatusCard>
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
                  itemCount={userReactions.length}
                  itemSize={(index) => sizesRef.current.get(userReactions[index]) ?? 100}
                  onItemsRendered={onItemsRendered}
                >
                  {({ index, style }) => (
                    <div style={style}>
                      <Row index={index} userReaction={userReactions[index]} />
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
