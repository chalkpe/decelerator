import { prisma } from '@decelerator/database'
import { useAtom } from 'jotai/react'
import { useCallback, useEffect, useRef, useState } from 'react'
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
  }
}

export default function HomeTimeline({ loaderData }: Route.ComponentProps) {
  const fetcher = useFetcher<typeof loader>()
  const [userReactions, setUserReactions] = useState<typeof loaderData.data>(loaderData.data)
  useEffect(() => {
    const { data, state } = fetcher
    if (state === 'idle' && data) setUserReactions((prev) => [...prev, ...data.data])
  }, [fetcher])

  const [mutualMode, setMutualMode] = useAtom(mutualModeAtom)
  const [timeout, setTimeout] = useAtom(timeoutAtom)

  const isItemLoaded = useCallback((index: number) => index < userReactions.length, [userReactions.length])
  const loadMoreItems = useCallback(() => {
    if (fetcher.state !== 'idle') return

    const lastNotification = userReactions.at(-1)
    if (!lastNotification) return

    return fetcher.load(`/home/timeline?timestamp=${lastNotification.createdAt.toISOString()}`)
  }, [fetcher, userReactions])

  const listRef = useRef<List>(null)
  const cardsRef = useRef<Record<string, HTMLDivElement | null>>({})
  const sizesRef = useRef<Record<string, number>>({})

  const Row = ({ index }: { index: number }) => {
    const { createdAt, reactedAt, notificationId, status, reaction, fromMutual } = userReactions[index]

    useEffect(() => {
      const height = cardsRef.current[notificationId]?.getBoundingClientRect().height
      if (typeof height === 'number') {
        sizesRef.current[index] = height
        listRef.current?.resetAfterIndex(index)
      }
    }, [index, notificationId])

    const timeoutError = reactedAt.getTime() - createdAt.getTime() > timeout
    const mutualModeError = (mutualMode === 'foreigner' && fromMutual) || (mutualMode === 'mutual' && !fromMutual)

    if (timeoutError || mutualModeError) {
      return (
        <div
          ref={(el) => {
            cardsRef.current[notificationId] = el
          }}
        />
      )
    }

    return (
      <div
        className="pl-6 pr-6 pt-6"
        ref={(el) => {
          cardsRef.current[notificationId] = el
        }}
      >
        <StatusCard key={notificationId} status={reaction.data} domain={loaderData.domain} software={loaderData.software}>
          <CardHeader>
            <StatusCardTitle />
            <StatusCardDescriptionWithTimeout timeout={[createdAt, reactedAt]} />
            <StatusCardAction />
          </CardHeader>
          <StatusCardContent>
            <StatusCard status={status.data} domain={loaderData.domain} software={loaderData.software}>
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
          <MutualSelect mutualMode={mutualMode} setMutualMode={setMutualMode} />
          <TimeoutSelect timeout={timeout} setTimeout={setTimeout} software={loaderData.software} />
        </nav>
        <FlushButton />
      </header>
      <div className="flex-auto">
        <AutoSizer>
          {({ width, height }) => (
            <InfiniteLoader isItemLoaded={isItemLoaded} itemCount={loaderData.totalCount} loadMoreItems={loadMoreItems}>
              {({ onItemsRendered, ref }) => (
                <List
                  ref={(el) => {
                    listRef.current = el
                    ref(el)
                  }}
                  width={width}
                  height={height}
                  itemCount={userReactions.length}
                  itemSize={(index) => sizesRef.current[index] ?? 100}
                  onItemsRendered={onItemsRendered}
                >
                  {({ index, style }) => (
                    <div style={style}>
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
