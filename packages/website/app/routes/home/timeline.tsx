import { prisma } from '@decelerator/database'
import { useCallback, useEffect, useRef, useState } from 'react'
import { redirect, useFetcher } from 'react-router'
import AutoSizer from 'react-virtualized-auto-sizer'
import { VariableSizeList as List } from 'react-window'
import InfiniteLoader from 'react-window-infinite-loader'
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
import { CardHeader } from '~/components/ui/card'
import { createAuth } from '~/lib/auth.server'
import { authClient } from '~/lib/auth-client'
import { cn } from '~/lib/utils'
import type { Route } from './+types/timeline'

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await createAuth()
  const session = await auth.api.getSession(request)
  if (!session) return redirect('/')

  const { searchParams } = new URL(request.url)
  const timestamp = searchParams.get('timestamp')
  const createdAt = timestamp ? { lt: new Date(timestamp) } : undefined

  const [result, totalCount] = await Promise.all([
    prisma.reblogNotification.findMany({
      where: { userId: session.user.mastodonId, domain: session.user.domain, reactionId: { not: null }, createdAt },
      orderBy: { createdAt: 'desc' },
      include: { reaction: true },
      take: 40,
    }),
    prisma.reblogNotification.count({
      where: { userId: session.user.mastodonId, domain: session.user.domain, reactionId: { not: null } },
    }),
  ])

  const notifications = result.flatMap(({ reaction, ...n }) => (reaction ? [{ ...n, reaction }] : []))

  return {
    totalCount,
    notifications,
  }
}

export default function HomeTimeline({ loaderData }: Route.ComponentProps) {
  const { data: session } = authClient.useSession()

  const fetcher = useFetcher<typeof loader>()
  const [notifications, setNotifications] = useState<typeof loaderData.notifications>(loaderData.notifications)
  useEffect(() => {
    const { data, state } = fetcher
    if (state === 'idle' && data) setNotifications((prev) => [...prev, ...data.notifications])
  }, [fetcher])

  const [mutualMode, setMutualMode] = useState<MutualMode>('mutual')
  const [timeout, setTimeout] = useState(1000 * 60 * 2)

  const isItemLoaded = useCallback((index: number) => index < notifications.length, [notifications.length])
  const loadMoreItems = useCallback(() => {
    if (fetcher.state !== 'idle') return

    const lastNotification = notifications.at(-1)
    if (!lastNotification) return

    return fetcher.load(`/home/timeline?timestamp=${lastNotification.createdAt.toISOString()}`)
  }, [fetcher, notifications])

  const listRef = useRef<List>(null)
  const cardsRef = useRef<Record<string, HTMLDivElement | null>>({})
  const sizesRef = useRef<Record<string, number>>({})

  const Row = ({ index }: { index: number }) => {
    const { createdAt, data: notification, reaction, fromMutual } = notifications[index]

    useEffect(() => {
      const height = cardsRef.current[notification.id]?.getBoundingClientRect().height
      if (typeof height === 'number') {
        sizesRef.current[index] = height
        listRef.current?.resetAfterIndex(index)
      }
    }, [index, notification])

    const timeoutError = reaction.createdAt.getTime() - createdAt.getTime() > timeout
    const mutualModeError = (mutualMode === 'foreigner' && fromMutual) || (mutualMode === 'mutual' && !fromMutual)

    if (timeoutError || mutualModeError) {
      return (
        <div
          ref={(el) => {
            cardsRef.current[notification.id] = el
          }}
        />
      )
    }

    return (
      <div
        className="pl-6 pr-6 pt-6"
        ref={(el) => {
          cardsRef.current[notification.id] = el
        }}
      >
        <StatusCard key={notification.id} status={reaction.data} domain={session?.user.domain}>
          <CardHeader>
            <StatusCardTitle />
            <StatusCardDescriptionWithNotification notification={notification} />
            <StatusCardAction />
          </CardHeader>
          <StatusCardContent>
            <StatusCard status={notification.status} domain={session?.user.domain}>
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
          <TimeoutSelect timeout={timeout} setTimeout={setTimeout} />
        </nav>
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
                  itemCount={notifications.length}
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
