import { prisma } from '@decelerator/database'
import { RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { redirect, useRevalidator } from 'react-router'
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
import { CardHeader } from '~/components/ui/card'
import { createAuth } from '~/lib/auth.server'
import { cn } from '~/lib/utils'
import type { Route } from './+types/timeline'

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await createAuth()
  const session = await auth.api.getSession(request)
  if (!session) return redirect('/')

  const notifications = await prisma.reblogNotification.findMany({
    where: { userId: session.user.mastodonId, domain: session.user.domain, reactionId: { not: null } },
    orderBy: { createdAt: 'desc' },
    include: { reaction: true },
  })

  return {
    notifications: notifications.filter(
      (n) => n.reaction && n.reaction.createdAt.getTime() - n.createdAt.getTime() < 1000 * 60 * 2, // 2분 이내에 작성된 반응만 필터링
    ),
  }
}

export default function HomeTimeline({ loaderData }: Route.ComponentProps) {
  const revalidator = useRevalidator()
  const notifications = useMemo(
    () => loaderData.notifications.flatMap(({ reaction, ...data }) => (reaction ? [{ ...data, reaction }] : [])),
    [loaderData.notifications],
  )

  const listRef = useRef<List>(null)
  const cardsRef = useRef<Record<string, HTMLDivElement | null>>({})
  const sizesRef = useRef<Record<string, number>>({})

  const Row = ({ index }: { index: number }) => {
    const { data: notification, reaction, fromMutual } = notifications[index]

    useEffect(() => {
      const height = cardsRef.current[notification.id]?.getBoundingClientRect().height
      if (height) {
        sizesRef.current[index] = height
        listRef.current?.resetAfterIndex(index)
      }
    }, [index, notification])

    return (
      <div
        className="pl-6 pr-6 pt-6"
        ref={(el) => {
          cardsRef.current[notification.id] = el
        }}
      >
        <StatusCard key={notification.id} status={reaction.data} className={cn(fromMutual ? '' : 'border-2 border-red-500')}>
          <CardHeader>
            <StatusCardTitle />
            <StatusCardDescriptionWithNotification notification={notification} />
            <StatusCardAction />
          </CardHeader>
          <StatusCardContent>
            <StatusCard status={notification.status}>
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
          <Button onClick={() => revalidator.revalidate()} disabled={revalidator.state !== 'idle'}>
            <RefreshCw />
            <span>새로고침</span>
          </Button>
        </nav>
      </header>
      <div className="flex-auto">
        <AutoSizer>
          {({ width, height }) => (
            <List
              ref={listRef}
              width={width}
              height={height}
              itemCount={notifications.length}
              itemSize={(index) => sizesRef.current[index] ?? 100}
            >
              {({ index, style }) => (
                <div style={style}>
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
