import { prisma } from '@decelerator/database'
import { RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { redirect, useFetcher, useRevalidator } from 'react-router'
import AutoSizer from 'react-virtualized-auto-sizer'
import { VariableSizeList as List } from 'react-window'
import InfiniteLoader from 'react-window-infinite-loader'
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
import { CardHeader } from '~/components/ui/card'
import { createAuth } from '~/lib/auth.server'
import { authClient } from '~/lib/auth-client'
import type { Route } from './+types/timeline'

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await createAuth()
  const session = await auth.api.getSession(request)
  if (!session) return redirect('/')

  const { domain, mastodonId: userId } = session.user

  const { searchParams } = new URL(request.url)
  const timestamp = searchParams.get('timestamp')
  const createdAt = timestamp ? { lt: new Date(timestamp) } : undefined

  const [data, totalCount] = await Promise.all([
    prisma.userReaction.findMany({
      where: { domain, status: { accountId: userId }, createdAt },
      orderBy: { createdAt: 'desc' },
      include: { reaction: true, notification: true },
      take: 40,
    }),
    prisma.userReaction.count({
      where: { domain, status: { accountId: userId } },
    }),
  ])

  return {
    data,
    totalCount,
  }
}

export default function HomeTimeline({ loaderData }: Route.ComponentProps) {
  const { data: session } = authClient.useSession()
  const revalidator = useRevalidator()

  const fetcher = useFetcher<typeof loader>()
  const [userReactions, setUserReactions] = useState<typeof loaderData.data>(loaderData.data)
  useEffect(() => {
    const { data, state } = fetcher
    if (state === 'idle' && data) setUserReactions((prev) => [...prev, ...data.data])
  }, [fetcher])

  const [mutualMode, setMutualMode] = useState<MutualMode>('mutual')
  const [timeout, setTimeout] = useState(1000 * 60 * 2)

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
    const { createdAt, reactedAt, notification, reaction, fromMutual } = userReactions[index]

    useEffect(() => {
      const height = cardsRef.current[notification.notificationId]?.getBoundingClientRect().height
      if (typeof height === 'number') {
        sizesRef.current[index] = height
        listRef.current?.resetAfterIndex(index)
      }
    }, [index, notification])

    const timeoutError = reactedAt.getTime() - createdAt.getTime() > timeout
    const mutualModeError = (mutualMode === 'foreigner' && fromMutual) || (mutualMode === 'mutual' && !fromMutual)

    if (timeoutError || mutualModeError) {
      return (
        <div
          ref={(el) => {
            cardsRef.current[notification.notificationId] = el
          }}
        />
      )
    }

    return (
      <div
        className="pl-6 pr-6 pt-6"
        ref={(el) => {
          cardsRef.current[notification.notificationId] = el
        }}
      >
        <StatusCard key={notification.notificationId} status={reaction.data} domain={session?.user.domain}>
          <CardHeader>
            <StatusCardTitle />
            <StatusCardDescriptionWithTimeout timeout={[createdAt, reactedAt]} />
            <StatusCardAction />
          </CardHeader>
          <StatusCardContent>
            <StatusCard status={notification.data.status} domain={session?.user.domain}>
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
        <Button onClick={() => revalidator.revalidate()} disabled={revalidator.state !== 'idle'}>
          <RefreshCw />
          <span>새로고침</span>
        </Button>
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
